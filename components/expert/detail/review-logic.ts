import { checkDefinitions, getCheckDefinition } from '@/lib/checks/registry';
import { getLsDocumentRequirementByDocumentTypeId } from '@/lib/data/ls-document-checks-mapping';
import { Application, CheckMethod, DocumentRequirementCheckResult, DocumentType, Finding, RequiredDoc, Rule, RuleCondition, UploadedFile } from '@/lib/types';
import { DocumentReviewRow, NpaFindingFilter, ReviewCheckCell, ReviewStatus } from '@/components/expert/detail/review-types';
import { formatConditions, shortCheckName } from '@/components/expert/detail/condition-formatters';
export { formatConditions, labelFor, matchesConditions, shortCheckName } from '@/components/expert/detail/condition-formatters';

export function npaFilterLabel(filter: NpaFindingFilter) {
  const labels: Record<NpaFindingFilter, string> = {
    all: 'Все',
    critical: 'Критичные',
    serious: 'Серьёзные',
    warning: 'Предупреждения',
    unknown: 'Неизвестные',
  };
  return labels[filter];
}

export function buildDocumentReviewRows(
  app: Application,
  requiredDocs: RequiredDoc[],
  activeRules: Rule[],
  documentTypesCatalog: DocumentType[],
): DocumentReviewRow[] {
  const consumedFileIds = new Set<string>();

  const rows: DocumentReviewRow[] = requiredDocs.flatMap((req) => {
    const docType = documentTypesCatalog.find((doc) => doc.id === req.documentTypeId);
    const alternativeDocType = req.alternativeDocumentTypeId ? documentTypesCatalog.find((doc) => doc.id === req.alternativeDocumentTypeId) : undefined;
    const files = findUploadedFilesForRuntimeDocument(app, req, docType, documentTypesCatalog, consumedFileIds);
    files.forEach((item) => consumedFileIds.add(item.id));
    const file = files[0];
    const matchedDocType = docType || (file ? documentTypesCatalog.find((doc) => doc.id === file.documentTypeId) : undefined);
    const docName = matchedDocType?.name || docType?.name || req.documentTypeId;
    const activatingRule = activeRules.find((rule) => rule.requiredDocuments.some((doc) => doc.documentTypeId === req.documentTypeId));
    const matrixRule = getLsDocumentRequirementByDocumentTypeId(req.documentTypeId);
    const fileGroups = groupFilesByActualSectionCode(files, matchedDocType);

    return fileGroups.map((group, groupIndex) => {
      const groupFile = group.files[0];
      const rowFindings = app.findings.filter((finding) => findingMatchesAnyFile(finding, docName, group.files, req.documentTypeId));
      const checks = buildCheckCells(app, req, matchedDocType?.id || req.documentTypeId, docName, groupFile, rowFindings, documentTypesCatalog);
      const sectionCode = group.sectionCode || documentCode(matchedDocType);

      return {
        key: sectionCode ? `${req.documentTypeId}:${sectionCode}` : `${req.documentTypeId}:${groupIndex}`,
        documentTypeId: matchedDocType?.id || req.documentTypeId,
        name: docName,
        required: true,
        severity: req.severityIfMissing,
        formats: matchedDocType?.acceptedFormats || docType?.acceptedFormats || [],
        file: groupFile,
        files: group.files,
        sectionCode,
        bundleKey: sectionCode ? `section:${sectionCode}` : `document-type:${matchedDocType?.id || req.documentTypeId}`,
        checks,
        findings: rowFindings,
        overall: getOverallStatus(checks),
        ruleName: activatingRule?.name || (matrixRule ? `Матрица досье: ${matrixRule.docCode || matrixRule.modulePart}` : docType?.requirednessExplanation ? 'Правило из БД' : undefined),
        conditionText: activatingRule ? formatConditions(activatingRule.conditions, app.values) : matrixRule?.triggerExpression || docType?.requiredWhenExpression,
        alternativeName: alternativeDocType?.name,
      };
    });
  });

  const coveredDocTypeIds = new Set(requiredDocs.flatMap((req) => [req.documentTypeId, req.alternativeDocumentTypeId].filter(Boolean) as string[]));
  const additionalGroups = new Map<string, UploadedFile[]>();
  for (const file of app.files) {
    if (consumedFileIds.has(file.id)) continue;
    const docType = documentTypesCatalog.find((doc) => doc.id === file.documentTypeId);
    const groupKey = documentBundleKey(file, docType);
    const bucket = additionalGroups.get(groupKey) || [];
    bucket.push(file);
    additionalGroups.set(groupKey, bucket);
  }

  for (const [groupKey, files] of additionalGroups.entries()) {
    const file = files[0];
    const docType = documentTypesCatalog.find((doc) => doc.id === file.documentTypeId);
    const docName = docType?.name || file.documentTypeId;
    const rowFindings = app.findings.filter((finding) => findingMatchesAnyFile(finding, docName, files, file.documentTypeId));
    const checks = buildCheckCells(app, undefined, file.documentTypeId, docName, file, rowFindings, documentTypesCatalog);
    const sectionCode = normalizeCode(file.dossierSectionCode) || documentCode(docType);
    rows.push({
      key: groupKey,
      documentTypeId: file.documentTypeId,
      name: docName,
      required: false,
      formats: docType?.acceptedFormats || [],
      file,
      files,
      sectionCode,
      bundleKey: sectionCode ? `section:${sectionCode}` : `document-type:${file.documentTypeId}`,
      checks,
      findings: rowFindings,
      overall: getOverallStatus(checks),
      ruleName: coveredDocTypeIds.has(file.documentTypeId) ? 'Дополнительный файл к обязательному типу' : 'Дополнительный документ',
    });
  }

  return mergeRowsByExactSectionCode(rows);
}

function mergeRowsByExactSectionCode(rows: DocumentReviewRow[]): DocumentReviewRow[] {
  const merged = new Map<string, DocumentReviewRow>();

  for (const row of rows) {
    const sectionCode = normalizeCode(row.sectionCode || row.file?.dossierSectionCode);
    const key = sectionCode ? `section:${sectionCode}` : row.key;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...row,
        key,
        sectionCode: sectionCode || row.sectionCode,
        bundleKey: sectionCode ? `section:${sectionCode}` : row.bundleKey,
        files: uniqueFiles(row.files || (row.file ? [row.file] : [])),
      });
      continue;
    }

    const files = uniqueFiles([...(existing.files || []), ...(row.files || (row.file ? [row.file] : []))]);
    const checks = mergeChecks(existing.checks, row.checks);
    const findings = uniqueById([...existing.findings, ...row.findings]);
    const names = uniqueText(splitJoined(existing.name).concat(splitJoined(row.name)));
    const documentTypeIds = uniqueText(splitJoined(existing.documentTypeId).concat(splitJoined(row.documentTypeId)));

    merged.set(key, {
      ...existing,
      documentTypeId: documentTypeIds.join(', '),
      name: names.join('; '),
      required: existing.required || row.required,
      severity: maxSeverity([existing.severity, row.severity].filter(Boolean).map((severity) => ({ severity } as Finding))),
      formats: uniqueText([...existing.formats, ...row.formats]),
      file: files[0],
      files,
      checks,
      findings,
      overall: getOverallStatus(checks),
      ruleName: uniqueText([existing.ruleName, row.ruleName].filter(Boolean) as string[]).join('; ') || undefined,
      conditionText: uniqueText([existing.conditionText, row.conditionText].filter(Boolean) as string[]).join('\n') || undefined,
      alternativeName: uniqueText([existing.alternativeName, row.alternativeName].filter(Boolean) as string[]).join('; ') || undefined,
    });
  }

  return Array.from(merged.values());
}

function splitJoined(value: string) {
  return String(value || '')
    .split(/\s*,\s*|\s*;\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueFiles(files: UploadedFile[]) {
  return Array.from(new Map(files.map((file) => [file.id, file])).values());
}

function uniqueText(values: string[]) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function uniqueById<T extends { id?: string }>(items: T[]) {
  return Array.from(new Map(items.map((item, index) => [item.id || String(index), item])).values());
}

function mergeChecks(left: ReviewCheckCell[], right: ReviewCheckCell[]) {
  const checks = new Map<string, ReviewCheckCell>();
  for (const check of [...left, ...right]) {
    const key = semanticCheckDedupeKey(check);
    const existing = checks.get(key);
    if (!existing) {
      checks.set(key, check);
      continue;
    }

    const findings = uniqueById([...existing.findings, ...check.findings]);
    checks.set(key, {
      ...existing,
      status: mergeDuplicateStatus(existing.status, check.status),
      severity: maxSeverity([existing.severity, check.severity].filter(Boolean).map((severity) => ({ severity } as Finding))),
      findings,
      description: uniqueText([existing.description, check.description].filter(Boolean) as string[]).join('\n') || undefined,
      npaReferences: uniqueText([...(existing.npaReferences || []), ...(check.npaReferences || [])]),
    });
  }
  return Array.from(checks.values());
}

function semanticCheckDedupeKey(check: ReviewCheckCell) {
  if (check.id.startsWith('npa-requirement-') || check.id.startsWith('fallback-gemma-')) {
    const source = String(check.description || check.name || '')
      .split('\nАвтоматическая проверка:')[0]
      .split('\nКомментарий:')[0]
      .split('\nОснование:')[0]
      .split('\nЦитата НПА:')[0];
    return `semantic:${normalizeRequirementText(source || check.name)}`;
  }
  return check.id;
}

function mergeDuplicateStatus(left: ReviewStatus, right: ReviewStatus): ReviewStatus {
  if (left === 'failed' || right === 'failed') return 'failed';
  if (left === 'passed' || right === 'passed') return 'passed';
  if (left === 'warning' || right === 'warning') return 'warning';
  return 'skipped';
}

function findUploadedFilesForRuntimeDocument(
  app: Application,
  req: RequiredDoc,
  docType: DocumentType | undefined,
  documentTypesCatalog: DocumentType[],
  consumedFileIds: Set<string>,
): UploadedFile[] {
  const exact = app.files.filter((file) =>
    !consumedFileIds.has(file.id) &&
    (file.documentTypeId === req.documentTypeId || file.documentTypeId === req.alternativeDocumentTypeId) &&
    fileCanRepresentDocumentType(file, docType)
  );
  if (exact.length > 0) return exact;

  const firstMatch = findUploadedFileForRuntimeDocument(app, req, docType, documentTypesCatalog, consumedFileIds);
  if (!firstMatch || !docType) return firstMatch ? [firstMatch] : [];

  const code = documentCode(docType);
  if (!code) return [firstMatch];

  return app.files
    .filter((file) => !consumedFileIds.has(file.id))
    .map((file) => ({ file, score: runtimeFileMatchScore(file, docType, code, false) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.file);
}

function groupFilesByActualSectionCode(files: UploadedFile[], docType?: DocumentType): Array<{ sectionCode?: string; files: UploadedFile[] }> {
  if (files.length === 0) {
    return [{ sectionCode: documentCode(docType), files: [] }];
  }

  const groups = new Map<string, UploadedFile[]>();
  for (const file of files) {
    const sectionCode = normalizeCode(file.dossierSectionCode) || documentCode(docType) || file.documentTypeId;
    const bucket = groups.get(sectionCode) || [];
    bucket.push(file);
    groups.set(sectionCode, bucket);
  }

  return Array.from(groups.entries()).map(([sectionCode, groupedFiles]) => ({
    sectionCode,
    files: groupedFiles,
  }));
}

function buildCheckCells(
  app: Application,
  req: RequiredDoc | undefined,
  documentTypeId: string,
  docName: string,
  file: UploadedFile | undefined,
  rowFindings: Finding[],
  documentTypesCatalog: DocumentType[],
): ReviewCheckCell[] {
  const docType = documentTypesCatalog.find((doc) => doc.id === documentTypeId);
  const importedRequirements = docType?.importedRequirements || [];
  const checkIds = unique([
    'required_document_presence_check',
    'file_format_check',
    'ocr_quality_check',
    docType?.expectedExtractedFields?.length ? 'expected_extracted_fields_check' : '',
    docType?.canCheckExpiry || docType?.expectedExtractedFields?.includes('validUntil') ? 'document_expiry_check' : '',
    ...(req?.checks || []),
    ...(docType?.checkIds || []),
  ]).filter((checkId) => !(importedRequirements.length > 0 && checkId === 'npa_imported_requirement_check'));

  const baseChecks: ReviewCheckCell[] = checkIds.map((checkId) => {
    const definition = getCheckDefinition(checkId) || checkDefinitions.find((check) => check.id === checkId);
    if (checkId === 'required_document_presence_check') {
      return {
        id: checkId,
        name: definition?.name || 'Наличие документа',
        status: file ? 'passed' : 'failed',
        severity: file ? undefined : req?.severityIfMissing || 'critical',
        method: definition?.method || 'rule',
        findings: file ? [] : rowFindings,
        description: definition?.description,
        remark: file ? undefined : buildFindingRemark(rowFindings) || 'Файл не загружен. Заявитель должен приложить документ для этого кода раздела.',
        npaReferences: definition?.npaReferences,
      };
    }

    if (!file) {
      return {
        id: checkId,
        name: definition?.name || shortCheckName(checkId),
        status: 'skipped',
        method: definition?.method || 'manual',
        findings: [],
        description: 'Проверка будет выполнена после загрузки документа.',
        remark: 'Проверка пропущена, потому что файл для данного типа документа не загружен.',
        npaReferences: definition?.npaReferences,
      };
    }

    const relatedFindings = rowFindings.filter((finding) => finding.checkerId === checkId);
    const status = relatedFindings.length ? statusFromFindings(relatedFindings) : 'passed';
    return {
      id: checkId,
      name: definition?.name || shortCheckName(checkId),
      status,
      method: definition?.method || 'manual',
      severity: maxSeverity(relatedFindings),
      findings: relatedFindings,
      description: definition?.description,
      remark: status === 'passed' ? undefined : buildFindingRemark(relatedFindings) || fallbackRemarkForStatus(status),
      npaReferences: definition?.npaReferences,
    };
  });

  const importedRequirementIds = new Set(importedRequirements.map((requirement) => requirement.id));
  const importedRequirementChecks: ReviewCheckCell[] = importedRequirements.map((requirement, index) => {
    const gemmaResult = file?.npaRequirementResults?.find((result) => currentNpaResultMatchesRequirement(result, requirement));
    const relatedFindings = gemmaResult ? rowFindings.filter((finding) =>
      finding.checkerId === 'npa_imported_requirement_check' &&
      finding.evidence?.some((evidence) => npaEvidenceMatchesRequirement(evidence.field, file?.id, requirement.id))
    ) : [];

    return {
      id: `npa-requirement-${requirement.id || index}`,
      name: readableRequirementCheckName(requirement, index),
      status: file ? npaRequirementStatus(gemmaResult, relatedFindings) : 'skipped',
      method: gemmaResult ? 'llm' : 'manual',
      severity: file ? maxSeverity(relatedFindings) || severityFromRequirementCriticality(requirement.criticality) : undefined,
      findings: relatedFindings,
      description: [
        requirement.requirementText,
        requirement.applicabilityCondition ? `Условие: ${requirement.applicabilityCondition}` : '',
        gemmaResult?.status ? `Автоматическая проверка: ${npaStatusLabel(gemmaResult.status)}` : '',
        gemmaResult?.comment ? `Комментарий: ${gemmaResult.comment}` : '',
        gemmaResult?.evidence ? `Основание: ${gemmaResult.evidence}` : '',
        requirement.quote ? `Цитата НПА: ${requirement.quote}` : '',
      ].filter(Boolean).join('\n'),
      remark: buildNpaRequirementRemark(file ? npaRequirementStatus(gemmaResult, relatedFindings) : 'skipped', gemmaResult, relatedFindings, requirement.requirementText),
      npaReferences: [
        requirement.sourcePoint,
        requirement.sourceDocumentName,
      ].filter(Boolean) as string[],
    };
  });

  const fallbackGemmaChecks: ReviewCheckCell[] = file && importedRequirements.length === 0 ? (file.npaRequirementResults || [])
    .filter((result) => !importedRequirementIds.has(result.requirementId))
    .map((result, index) => {
      const relatedFindings = rowFindings.filter((finding) =>
        finding.checkerId === 'npa_imported_requirement_check' &&
        finding.evidence?.some((evidence) => npaEvidenceMatchesRequirement(evidence.field, file.id, result.requirementId))
      );

      return {
        id: `fallback-gemma-${result.requirementId || index}`,
        name: result.sourcePoint ? `Автоматическая проверка: ${result.sourcePoint}` : `Автоматическая проверка ${index + 1}`,
        status: npaRequirementStatus(result, relatedFindings),
        method: 'llm',
        severity: maxSeverity(relatedFindings),
        findings: relatedFindings,
        description: [
          result.requirementText,
          result.status ? `Автоматическая проверка: ${npaStatusLabel(result.status)}` : '',
          result.comment ? `Комментарий: ${result.comment}` : '',
          result.evidence ? `Основание: ${result.evidence}` : '',
        ].filter(Boolean).join('\n'),
        remark: buildNpaRequirementRemark(npaRequirementStatus(result, relatedFindings), result, relatedFindings, result.requirementText),
        npaReferences: [result.sourcePoint, docType?.name].filter(Boolean) as string[],
      };
    }) : [];

  return [...baseChecks, ...importedRequirementChecks, ...fallbackGemmaChecks];
}

function findUploadedFileForRuntimeDocument(
  app: Application,
  req: RequiredDoc,
  docType: DocumentType | undefined,
  documentTypesCatalog: DocumentType[],
  consumedFileIds: Set<string>,
): UploadedFile | undefined {
  const exact = app.files.find((file) => file.documentTypeId === req.documentTypeId || file.documentTypeId === req.alternativeDocumentTypeId);
  if (exact && !docType) return exact;
  if (exact && docType) {
    const exactCode = documentCode(docType);
    const siblingsWithSameCode = exactCode ? documentTypesCatalog.filter((item) => documentCode(item) === exactCode) : [];
    if (siblingsWithSameCode.length <= 1 || runtimeFileMatchScore(exact, docType, exactCode, true) > 0) {
      return exact;
    }
  }
  if (!docType) return undefined;

  const code = documentCode(docType);
  if (!code) return undefined;

  const siblingsWithSameCode = documentTypesCatalog.filter((item) => documentCode(item) === code);
  const candidates = app.files
    .filter((file) => !consumedFileIds.has(file.id))
    .map((file) => ({
      file,
      score: runtimeFileMatchScore(file, docType, code, siblingsWithSameCode.length > 1),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.file;
}

function runtimeFileMatchScore(file: UploadedFile, docType: DocumentType, code: string, requireNameSignal: boolean) {
  const normalizedRequiredCode = normalizeCode(code);
  const explicitSectionCode = normalizeCode(file.dossierSectionCode);
  if (explicitSectionCode && explicitSectionCode !== normalizedRequiredCode) return 0;

  const fileCodes = extractCodes([
    explicitSectionCode || '',
    explicitSectionCode ? '' : file.name,
    explicitSectionCode ? '' : file.originalName,
    explicitSectionCode ? '' : file.relativePath,
    explicitSectionCode ? '' : file.dossierFolderName,
    explicitSectionCode ? '' : file.dossierSectionName,
  ].filter(Boolean).join(' '));
  const hasCode = fileCodes.some((fileCode) => codeCoversRequired(normalizedRequiredCode, fileCode));
  if (!hasCode) return 0;

  const fileText = normalizedSearchText([
    file.name,
    file.originalName,
    file.relativePath,
    file.dossierFolderName,
    file.dossierSectionName,
  ].filter(Boolean).join(' '));
  const docText = normalizedSearchText([
    docType.name,
    docType.description,
    docType.validationChecksText,
    ...(docType.importedRequirements || []).flatMap((requirement) => [requirement.requirementText, requirement.checkSubject]),
  ].filter(Boolean).join(' '));
  const keywordScore = matchingKeywordScore(docText, fileText);
  if (requireNameSignal && fileText.includes('gmp') && !docText.includes('gmp')) return 0;
  if (requireNameSignal && keywordScore === 0) return 0;
  return 10 + keywordScore;
}

function fileCanRepresentDocumentType(file: UploadedFile, docType?: DocumentType) {
  const explicitSectionCode = normalizeCode(file.dossierSectionCode);
  const requiredCode = documentCode(docType);
  if (!explicitSectionCode || !requiredCode) return true;
  return explicitSectionCode === requiredCode;
}

function documentCode(docType?: DocumentType) {
  return normalizeCode(docType?.docCode || docType?.importedRequirements?.find((requirement) => requirement.sourceDocumentCode)?.sourceDocumentCode);
}

function documentBundleKey(file: UploadedFile, docType?: DocumentType) {
  const code = normalizeCode(file.dossierSectionCode) || documentCode(docType);
  return code ? `section:${code}` : `document-type:${file.documentTypeId}`;
}

function extractCodes(value: string) {
  const matches = value.match(/\b[1-5](?:\.\d+)+(?:\.[SPР])?(?:\.\d+)*\.?/gi) || [];
  return Array.from(new Set(matches.map(normalizeCode).filter(Boolean))).sort((a, b) => b.length - a.length);
}

function normalizeCode(value: unknown) {
  return String(value || '')
    .toUpperCase()
    .replace(/Р/g, 'P')
    .replace(/\s+/g, '')
    .replace(/\.$/, '');
}

function codeCoversRequired(requiredCode: string, fileCode: string) {
  if (!requiredCode || !fileCode) return false;
  return normalizeCode(requiredCode) === normalizeCode(fileCode);
}

function normalizedSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\w\u0400-\u04ff\d.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchingKeywordScore(docText: string, fileText: string) {
  const keywords = ['gmp', 'cpp', 'сертификат', 'фармацевтический', 'регистрац', 'доверенность', 'оплат', 'заявлен', 'охлп', 'инструкц', 'маркиров', 'макет'];
  return keywords.filter((keyword) => docText.includes(keyword) && fileText.includes(keyword)).length;
}

function readableRequirementCheckName(
  requirement: NonNullable<DocumentType['importedRequirements']>[number],
  index: number,
): string {
  const typeLabel = requirement.checkType === 'conditional'
    ? 'Условная проверка'
    : requirement.checkType === 'cross_document'
      ? 'Междокументная проверка'
      : 'Проверка условия';
  const code = requirement.sourceDocumentCode || requirement.sourcePoint;
  const text = firstMeaningfulLine(requirement.requirementText);
  return [typeLabel, code ? `${code}` : String(index + 1), text ? `— ${text}` : ''].filter(Boolean).join(' ');
}

function firstMeaningfulLine(value?: string): string {
  const line = String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .find(Boolean) || '';
  return line
    .replace(/^требуемая документация:\s*/i, '')
    .replace(/^условия?:\s*/i, '')
    .slice(0, 120);
}

function npaEvidenceMatchesRequirement(field: string | undefined, fileId: string | undefined, requirementId: string): boolean {
  if (!field) return false;
  if (fileId && field === `${fileId}:${requirementId}`) return true;
  if (field.endsWith(`:${requirementId}`)) return true;
  return field === requirementId;
}

function currentNpaResultMatchesRequirement(
  result: DocumentRequirementCheckResult,
  requirement: NonNullable<DocumentType['importedRequirements']>[number],
): boolean {
  if (result.requirementId !== requirement.id) return false;
  if (!result.requirementText) return true;
  return normalizeRequirementText(result.requirementText) === normalizeRequirementText(requirement.requirementText);
}

function normalizeRequirementText(value: string | undefined) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
}

function npaRequirementStatus(
  result: DocumentRequirementCheckResult | undefined,
  findings: Finding[]
): ReviewStatus {
  if (!result) return 'warning';
  if (result.status === 'passed') return 'passed';
  if (result.status === 'failed') return 'failed';
  if (result.status === 'not_applicable' || result.status === 'skipped') return 'skipped';
  return findings.length ? statusFromFindings(findings) : 'warning';
}

function buildNpaRequirementRemark(
  status: ReviewStatus,
  result: DocumentRequirementCheckResult | undefined,
  findings: Finding[],
  requirementText?: string,
): string | undefined {
  const findingRemark = buildFindingRemark(findings);
  if (findingRemark) return findingRemark;
  if (status === 'passed') return undefined;

  if (!result) {
    return status === 'skipped'
      ? 'Требование не применяется к текущей заявке или не требует проверки по загруженному пакету.'
      : 'По этому условию нет сохранённого результата автоматической проверки. Нужно запустить проверку документа или проверить условие вручную.';
  }

  const lines: string[] = [];
  if (status === 'failed') lines.push('Требование не подтверждено по загруженному пакету документов.');
  else if (status === 'warning') lines.push('Требование не удалось проверить однозначно.');
  else if (status === 'skipped') lines.push('Требование не применимо к текущей заявке или пакету документов.');

  if (result.comment) lines.push(`Причина: ${result.comment}`);
  else if (status === 'failed') lines.push('Причина: в извлечённом тексте/изображениях не найдено подтверждение требования.');
  else if (status === 'warning') lines.push('Причина: недостаточно данных или уверенности для автоматического вывода.');

  if (result.evidence) lines.push(`Основание: ${result.evidence}`);
  if (typeof result.confidence === 'number') lines.push(`Уверенность модели: ${Math.round(result.confidence * 100)}%.`);
  if (requirementText) lines.push(`Проверяемое условие: ${firstMeaningfulLine(requirementText)}`);
  return lines.join('\n');
}

function buildFindingRemark(findings: Finding[]): string | undefined {
  if (findings.length === 0) return undefined;
  return findings
    .map((finding) => [
      finding.title,
      finding.description,
      finding.recommendation ? `Рекомендация: ${finding.recommendation}` : '',
      finding.evidence?.[0]?.text ? `Основание: ${finding.evidence[0].text}` : '',
    ].filter(Boolean).join('\n'))
    .join('\n\n');
}

function fallbackRemarkForStatus(status: ReviewStatus): string | undefined {
  if (status === 'passed') return undefined;
  if (status === 'failed') return 'Проверка не пройдена. Детальная причина не была сохранена в результатах проверки, требуется ручной просмотр документа.';
  if (status === 'warning') return 'Проверка требует внимания эксперта. Автоматическая проверка не смогла подтвердить условие однозначно.';
  return 'Требование не применимо к текущей заявке или документу.';
}

function npaStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    passed: 'выполнено',
    failed: 'не выполнено',
    uncertain: 'не удалось проверить однозначно',
    not_applicable: 'не применимо',
    skipped: 'пропущено',
  };
  return labels[status] || status;
}

function severityFromRequirementCriticality(value?: string): Finding['severity'] {
  const text = String(value || '').toLowerCase();
  if (text.includes('крит') || text.includes('critical')) return 'critical';
  if (text.includes('знач') || text.includes('serious') || text.includes('significant')) return 'serious';
  if (text.includes('неяс') || text.includes('unknown')) return 'unknown';
  return 'warning';
}

export function summarizeRows(rows: DocumentReviewRow[], findings: Finding[]) {
  return {
    totalDocuments: rows.length,
    presentDocuments: rows.filter((row) => !!row.file).length,
    passedDocuments: rows.filter((row) => row.overall === 'passed').length,
    failedDocuments: rows.filter((row) => row.overall === 'failed').length,
    warningDocuments: rows.filter((row) => row.overall === 'warning').length,
    criticalFindings: findings.filter((finding) => finding.severity === 'critical').length,
    seriousFindings: findings.filter((finding) => finding.severity === 'serious').length,
  };
}

export function summarizeNpaGemmaResults(files: UploadedFile[]) {
  const results = uniqueNpaResults(files);
  return {
    total: results.length,
    passed: results.filter((result) => result.status === 'passed').length,
    failed: results.filter((result) => result.status === 'failed').length,
    uncertain: results.filter((result) => result.status === 'uncertain').length,
  };
}

export function buildNpaGemmaReviewSummary(app: Application, documentTypesCatalog: DocumentType[]) {
  const documentNames = new Map(documentTypesCatalog.map((documentType) => [documentType.id, documentType.name]));
  const filesById = new Map(app.files.map((file) => [file.id, file]));
  const results = uniqueNpaResults(app.files);
  const byStatus = results.reduce<Record<string, number>>((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, {});

  const problemMap = new Map<string, {
    documentTypeId: string;
    name: string;
    total: number;
    critical: number;
    serious: number;
    warning: number;
    unknown: number;
  }>();

  for (const finding of app.findings.filter((item) => item.checkerId === 'npa_imported_requirement_check')) {
    const scopedEvidence = finding.evidence?.find((evidence) => String(evidence.field || '').includes(':'));
    const fileId = String(scopedEvidence?.field || '').split(':')[0];
    const file = filesById.get(fileId);
    const documentTypeId = file?.documentTypeId || finding.evidence?.[0]?.documentTypeId || finding.documents[0] || 'unknown';
    const existing = problemMap.get(documentTypeId) || {
      documentTypeId,
      name: documentNames.get(documentTypeId) || finding.documents[0] || documentTypeId,
      total: 0,
      critical: 0,
      serious: 0,
      warning: 0,
      unknown: 0,
    };
    existing.total += 1;
    existing[finding.severity] += 1;
    problemMap.set(documentTypeId, existing);
  }

  return {
    totalResults: results.length,
    byStatus,
    topProblemDocuments: Array.from(problemMap.values()).sort((a, b) => b.total - a.total),
  };
}

function uniqueNpaResults(files: UploadedFile[]) {
  const byKey = new Map<string, DocumentRequirementCheckResult>();
  for (const file of files) {
    for (const result of file.npaRequirementResults || []) {
      byKey.set(`${result.bundleKey || file.id}:${result.requirementId}`, result);
    }
  }
  return Array.from(byKey.values());
}

function getOverallStatus(checks: ReviewCheckCell[]): ReviewStatus {
  if (checks.some((check) => check.status === 'failed')) return 'failed';
  if (checks.some((check) => check.status === 'warning')) return 'warning';
  const semanticChecks = checks.filter(isSemanticReviewCheck);
  if (semanticChecks.length > 0 && semanticChecks.every((check) => check.status === 'skipped')) {
    return checks.some((check) => check.status === 'passed') ? 'passed' : 'skipped';
  }
  if (checks.every((check) => check.status === 'skipped')) return 'skipped';
  return 'passed';
}

function isSemanticReviewCheck(check: ReviewCheckCell) {
  return check.id.startsWith('npa-requirement-') || check.id.startsWith('fallback-gemma-');
}

function statusFromFindings(findings: Finding[]): ReviewStatus {
  if (findings.some((finding) => finding.severity === 'critical' || finding.severity === 'serious')) return 'failed';
  if (findings.length > 0) return 'warning';
  return 'passed';
}

function maxSeverity(findings: Finding[]): Finding['severity'] | undefined {
  const order: Record<Finding['severity'], number> = { critical: 4, serious: 3, warning: 2, unknown: 1 };
  return findings.sort((a, b) => order[b.severity] - order[a.severity])[0]?.severity;
}

function findingMatchesDocument(finding: Finding, docName: string, file: UploadedFile | undefined, documentTypeId: string): boolean {
  const targets = [docName, file?.name, documentTypeId].filter(Boolean).map((item) => normalize(String(item)));
  if (file) {
    const scopedEvidence = finding.evidence?.filter((evidence) => evidence.field?.includes(':')) || [];
    if (scopedEvidence.length > 0) {
      if (scopedEvidence.some((evidence) => evidenceMatchesFileOrSection(evidence.field, file))) return true;
      if (finding.evidence?.some((evidence) => evidence.documentTypeId === documentTypeId)) return true;
      return false;
    }
  }
  if (finding.evidence?.some((evidence) => evidence.documentTypeId === documentTypeId)) return true;
  return finding.documents.some((document) => {
    const normalizedDocument = normalize(document);
    return targets.some((target) => normalizedDocument.includes(target) || target.includes(normalizedDocument));
  });
}

function evidenceMatchesFileOrSection(field: string | undefined, file: UploadedFile): boolean {
  if (!field) return false;
  if (field.startsWith(`${file.id}:`)) return true;
  if (file.documentTypeId && field.startsWith(`document-type:${file.documentTypeId}:`)) return true;

  const sectionCode = normalizeCode(file.dossierSectionCode);
  if (!sectionCode) return false;
  const normalizedField = normalizeCodeEvidenceField(field);
  return normalizedField.startsWith(`SECTION:${sectionCode}:`) || normalizedField.includes(`:${sectionCode}:`);
}

function normalizeCodeEvidenceField(value: string) {
  return String(value || '')
    .toUpperCase()
    .replace(/Р/g, 'P')
    .replace(/\s+/g, '');
}

function findingMatchesAnyFile(finding: Finding, docName: string, files: UploadedFile[], documentTypeId: string): boolean {
  if (files.length === 0) return findingMatchesDocument(finding, docName, undefined, documentTypeId);
  return files.some((file) => findingMatchesDocument(finding, docName, file, documentTypeId));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '');
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
