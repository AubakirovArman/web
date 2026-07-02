'use client';

import { useEffect, useMemo, useState } from 'react';
import { Application, DocumentType, UploadedFile } from '@/lib/types';
import { useApplications } from '@/lib/hooks/useApplications';
import { getLsDocumentRequirementByDocumentTypeId } from '@/lib/data/ls-document-checks-mapping';
import { findUploadedRequiredFile, getRequiredDocuments } from '@/lib/rules/engine';
import { DocumentUploader } from '@/components/applicant/document-uploader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';

export function DocsStep({
  app,
  requiredDocs,
  documentTypesCatalog,
  requirementsLoading,
  onUpload,
  onRemove,
}: {
  app: Application;
  requiredDocs: ReturnType<typeof getRequiredDocuments>;
  documentTypesCatalog: DocumentType[];
  requirementSource?: 'db' | 'legacy';
  requirementsLoading?: boolean;
  requirementDiagnostics?: string[];
  onUpload: (file: Omit<UploadedFile, 'id'>) => void;
  onRemove: (fileId: string) => void;
}) {
  const { importApplication } = useApplications();
  const [seeding, setSeeding] = useState(false);
  const [documentGroupStep, setDocumentGroupStep] = useState(0);
  const visibleRequiredDocs = useMemo(
    () => requiredDocs.filter((req) => !isWholeDossierDocument(req.documentTypeId)),
    [requiredDocs]
  );
  const visibleUploadedCount = useMemo(
    () =>
      visibleRequiredDocs.filter((req) =>
        findUploadedRequiredFile(app, req)
      ).length,
    [app.files, visibleRequiredDocs]
  );
  const visibleProgress = visibleRequiredDocs.length ? Math.round((visibleUploadedCount / visibleRequiredDocs.length) * 100) : 0;
  const documentGroups = useMemo(
    () => groupRequiredUploadDocuments(app, visibleRequiredDocs, documentTypesCatalog),
    [app, documentTypesCatalog, visibleRequiredDocs]
  );
  const currentDocumentGroup = documentGroups[documentGroupStep] || documentGroups[0];

  useEffect(() => {
    if (documentGroups.length === 0) {
      if (documentGroupStep !== 0) setDocumentGroupStep(0);
      return;
    }
    if (documentGroupStep > documentGroups.length - 1) {
      setDocumentGroupStep(documentGroups.length - 1);
    }
  }, [documentGroupStep, documentGroups.length]);

  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error || 'Seed failed');
      const data = await res.json();
      importApplication(data.app);
      toast.success('Демо-документы загружены');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="wizard-docs-step">
      <Card>
        <CardHeader>
          <CardTitle>Загрузка документов по типам</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Загружено {visibleUploadedCount} из {visibleRequiredDocs.length} обязательных типов документов
            </span>
            <span className="font-medium">{visibleProgress}%</span>
          </div>
          <Progress value={visibleProgress} />
          {app.files.length === 0 && (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
              <span className="text-sm text-muted-foreground">Хотите посмотреть, как работает проверка?</span>
              <Button variant="outline" size="sm" onClick={handleSeedDemo} disabled={seeding}>
                {seeding ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                Загрузить демо-документы
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {documentGroups.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Раздел документов: {currentDocumentGroup?.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Шаг {documentGroupStep + 1} из {documentGroups.length}. Загружено {currentDocumentGroup?.uploaded || 0} из {currentDocumentGroup?.items.length || 0} типов документов в текущем разделе.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-3">
                {documentGroups.map((group, index) => {
                  const active = index === documentGroupStep;
                  const done = group.items.length > 0 && group.uploaded >= group.items.length;
                  return (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => setDocumentGroupStep(index)}
                      className={`border px-3 py-2 text-xs transition-colors ${
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : done
                          ? 'border-primary/30 bg-primary/5 text-primary'
                          : 'border-border bg-card text-muted-foreground'
                      }`}
                    >
                      {index + 1}. {compactGroupTitle(group.title)}
                    </button>
                  );
                })}
              </div>

              {documentGroups.length > 1 && (
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setDocumentGroupStep((current) => Math.max(0, current - 1))}
                    disabled={documentGroupStep === 0}
                  >
                    Назад по документам
                  </Button>
                  <Button
                    onClick={() => setDocumentGroupStep((current) => Math.min(documentGroups.length - 1, current + 1))}
                    disabled={documentGroupStep >= documentGroups.length - 1}
                  >
                    Далее по документам
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {currentDocumentGroup && (
          <Card key={currentDocumentGroup.key}>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">{currentDocumentGroup.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{currentDocumentGroup.items.length} типов документов в текущем разделе</p>
                </div>
                <span className="border bg-background px-3 py-1 text-xs text-muted-foreground">
                  {currentDocumentGroup.uploaded}/{currentDocumentGroup.items.length} загружено
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 xl:grid-cols-2">
                {currentDocumentGroup.items.map(({ req, matrixRule }) => {
                  const docType = documentTypesCatalog.find((doc) => doc.id === req.documentTypeId);
                  const files = getPrimaryFilesForRequiredDocument(app, req);
                  const alternativeFiles = req.alternativeDocumentTypeId
                    ? app.files.filter((f) => f.documentTypeId === req.alternativeDocumentTypeId)
                    : [];
                  return (
                    <div key={req.documentTypeId} className="space-y-2">
                      <DocumentUploader
                        documentTypeId={req.documentTypeId}
                        files={files}
                        documentTypesCatalog={documentTypesCatalog}
                        requirementMeta={buildUploaderRequirementMeta(req, matrixRule, docType)}
                        onUpload={onUpload}
                        onRemove={onRemove}
                      />
                      {req.alternativeDocumentTypeId && (
                        <div className="space-y-2 border border-dashed p-2">
                          <p className="px-1 text-xs text-muted-foreground">
                            Альтернатива к обязательному документу. Если она загружена, документ считается закрытым.
                          </p>
                          <DocumentUploader
                            documentTypeId={req.alternativeDocumentTypeId}
                            files={alternativeFiles}
                            documentTypesCatalog={documentTypesCatalog}
                            onUpload={onUpload}
                            onRemove={onRemove}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
        {visibleRequiredDocs.length === 0 && (() => {
          const objectType = app.values['param-object-type'] === 'MI' ? 'MI' : 'LS';
          const procedure = String(app.values['param-procedure'] || 'registration');
          const scopeUnfilled = objectType === 'MI' || procedure !== 'registration';
          return (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                {requirementsLoading
                  ? 'Определяем необходимые документы…'
                  : scopeUnfilled
                    ? 'Для этой области/процедуры перечень документов ещё не заведён администратором. Обратитесь к администратору или выберите ЛС / Регистрация.'
                    : 'Для выбранных параметров заявки обязательные типы документов пока не определены.'}
              </CardContent>
            </Card>
          );
        })()}
      </div>
    </div>
  );
}

function isWholeDossierDocument(documentTypeId: string) {
  return ['doc-registration-dossier', 'doc-mi-registration-dossier'].includes(documentTypeId);
}

function getPrimaryFilesForRequiredDocument(app: Application, req: ReturnType<typeof getRequiredDocuments>[number]) {
  const exactFiles = app.files.filter((file) => file.documentTypeId === req.documentTypeId);
  const matchedFile = findUploadedRequiredFile(app, req);

  if (
    matchedFile &&
    matchedFile.documentTypeId !== req.alternativeDocumentTypeId &&
    !exactFiles.some((file) => file.id === matchedFile.id)
  ) {
    return [matchedFile, ...exactFiles];
  }

  return exactFiles;
}

function groupRequiredUploadDocuments(
  app: Application,
  requiredDocs: ReturnType<typeof getRequiredDocuments>,
  documentTypesCatalog: DocumentType[],
) {
  const groups = new Map<string, {
    key: string;
    title: string;
    uploaded: number;
    items: Array<{
      req: ReturnType<typeof getRequiredDocuments>[number];
      matrixRule: ReturnType<typeof getLsDocumentRequirementByDocumentTypeId>;
    }>;
  }>();

  for (const req of requiredDocs) {
    const matrixRule = getLsDocumentRequirementByDocumentTypeId(req.documentTypeId);
    const docType = documentTypesCatalog.find((doc) => doc.id === req.documentTypeId);
    const groupTitle = docType?.modulePart || matrixRule?.modulePart || inferDocumentGroupTitle(docType?.name || req.documentTypeId);
    const key = groupTitle || 'Прочие документы';
    if (!groups.has(key)) {
      groups.set(key, { key, title: key, uploaded: 0, items: [] });
    }
    const group = groups.get(key)!;
    group.items.push({ req, matrixRule });
    if (findUploadedRequiredFile(app, req)) {
      group.uploaded += 1;
    }
  }

  return Array.from(groups.values()).sort((left, right) => left.title.localeCompare(right.title, 'ru'));
}

function inferDocumentGroupTitle(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('заявлен') || lower.includes('оплат') || lower.includes('сопровод')) return 'Общая документация';
  if (lower.includes('охлп') || lower.includes('инструк') || lower.includes('листок') || lower.includes('маркиров') || lower.includes('макет')) return 'Информация о препарате и маркировка';
  if (lower.includes('gmp') || lower.includes('производ') || lower.includes('cpp') || lower.includes('сертификат')) return 'Производство и разрешительные документы';
  if (lower.includes('качество') || lower.includes('модуль 3') || lower.includes('стабил')) return 'Качество';
  if (lower.includes('биоэквивалент') || lower.includes('клиничес')) return 'Эффективность / исследования';
  if (lower.includes('фармаконадзор') || lower.includes('риск')) return 'Безопасность и фармаконадзор';
  if (lower.includes('изменен')) return 'Внесение изменений';
  return 'Прочие документы';
}

function compactGroupTitle(title: string) {
  return title
    .replace(/^Модуль\s+/i, 'Модуль ')
    .replace(/\s+Отчеты.+$/i, '')
    .replace(/\s+и\s+\(ил.*$/i, '')
    .trim();
}

function buildUploaderRequirementMeta(
  req: ReturnType<typeof getRequiredDocuments>[number],
  matrixRule: ReturnType<typeof getLsDocumentRequirementByDocumentTypeId>,
  docType?: DocumentType,
) {
  return {
    code: docType?.docCode || docType?.importedRequirements?.[0]?.sourceDocumentCode || matrixRule?.docCode,
    section: docType?.modulePart || matrixRule?.modulePart,
    requiredness: docType?.requirednessExplanation || matrixRule?.whenRequired || matrixRule?.requiredDocument,
    trigger: docType?.requiredWhenExpression || matrixRule?.triggerExpression,
    linkedParams: docType?.linkedApplicationParams?.slice(0, 8) || matrixRule?.applicationParamsWithTitles?.slice(0, 8),
    source: docType?.npaReferences?.[0] || matrixRule?.sourceReference,
    checks: docType?.validationChecksText?.split('\n').filter(Boolean) || req.checks,
    severity: req.severityIfMissing,
  };
}
