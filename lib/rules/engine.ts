import { Application, ChecklistItem, Finding, RequiredDoc, RuleCondition, Severity } from '@/lib/types';
import { documentTypes, npas, rules as seedRules } from '@/lib/data/seed';
import { Rule } from '@/lib/types';

export function getRequiredDocuments(
  app: Application,
  rules: Rule[] = seedRules
): RequiredDoc[] {
  const result: RequiredDoc[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    if (rule.active === false) continue;
    if (!matchesConditions(app.values, rule.conditions)) continue;
    for (const req of rule.requiredDocuments) {
      if (seen.has(req.documentTypeId)) continue;
      seen.add(req.documentTypeId);
      result.push({
        documentTypeId: req.documentTypeId,
        severityIfMissing: req.severityIfMissing,
        alternativeDocumentTypeId: req.alternativeDocumentTypeId,
        checks: req.checks,
      });
    }
  }
  return result;
}

function matchesConditions(values: Application['values'], conditions: RuleCondition[]): boolean {
  return conditions.every((c) => {
    const v = values[c.parameterId];
    const target = c.value;
    switch (c.operator) {
      case 'equals':
        return v === target;
      case 'notEquals':
        return v !== target;
      case 'notEmpty':
        return typeof v === 'string' ? v.trim().length > 0 : Array.isArray(v) ? v.length > 0 : false;
      case 'includes':
        if (typeof v === 'string') return v.toLowerCase().includes((target || '').toLowerCase());
        if (Array.isArray(v)) return v.some((x) => x.toLowerCase().includes((target || '').toLowerCase()));
        return false;
      default:
        return false;
    }
  });
}

export function buildChecklist(app: Application, rules: Rule[] = seedRules): ChecklistItem[] {
  const required = getRequiredDocuments(app, rules);
  return required.map((req) => {
    const file = findUploadedRequiredFile(app, req);
    return {
      documentTypeId: req.documentTypeId,
      required: true,
      uploaded: !!file,
      fileId: file?.id,
      severityIfMissing: req.severityIfMissing,
      alternativeDocumentTypeId: req.alternativeDocumentTypeId,
      matchedDocumentTypeId: file?.documentTypeId,
      checks: req.checks,
    };
  });
}

function findUploadedRequiredFile(app: Application, req: RequiredDoc) {
  return app.files.find(
    (f) => f.documentTypeId === req.documentTypeId || f.documentTypeId === req.alternativeDocumentTypeId
  );
}

export function evaluateMissingDocuments(app: Application, rules: Rule[] = seedRules): Finding[] {
  const checklist = buildChecklist(app, rules);
  const findings: Finding[] = [];
  for (const item of checklist) {
    if (item.uploaded) continue;
    const docType = documentTypes.find((d) => d.id === item.documentTypeId);
    const altDocType = item.alternativeDocumentTypeId
      ? documentTypes.find((d) => d.id === item.alternativeDocumentTypeId)
      : undefined;
    const rule = rules.find((r) => r.requiredDocuments.some((d) => d.documentTypeId === item.documentTypeId));
    const npa = rule?.sourceNpaId ? npas.find((n) => n.id === rule.sourceNpaId) : undefined;
    const alternatives = altDocType ? ` Допустимая альтернатива: «${altDocType.name}».` : '';
    const formats = [
      docType?.acceptedFormats.join(', '),
      altDocType ? `${altDocType.name}: ${altDocType.acceptedFormats.join(', ')}` : undefined,
    ]
      .filter(Boolean)
      .join('; ');

    findings.push({
      id: `missing-${item.documentTypeId}-${Date.now()}`,
      severity: item.severityIfMissing,
      category: 'Комплектность',
      title: `Отсутствует документ: ${docType?.name || item.documentTypeId}`,
      description: `Документ «${docType?.name || item.documentTypeId}» отмечен как обязательный для данного типа заявки, но не загружен.${alternatives}`,
      documents: [docType?.name || item.documentTypeId, altDocType?.name].filter(Boolean) as string[],
      recommendation: `Загрузите ${docType?.name || item.documentTypeId}${altDocType ? ` или ${altDocType.name}` : ''} в формате ${formats || 'PDF'}.`,
      npaReference: npa ? `${npa.number} от ${npa.date}` : undefined,
      checkerId: 'required_document_presence_check',
      confidence: 1,
      status: 'open',
    });
  }
  return findings;
}
