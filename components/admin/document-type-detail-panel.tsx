'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { DocumentType, Rule } from '@/lib/types';
import { npas } from '@/lib/data/seed';
import { checkDefinitions } from '@/lib/checks/registry';
import { getRuleSources } from '@/lib/reference/rule-sources';
import { buildReferenceHref, findDocumentRequirement, formatRuleConditions, uniqueRuleSources } from '@/lib/admin/document-type-logic';
import { severityLabels } from '@/lib/admin/admin-page-types';
import { EmptyAdminBlock } from '@/components/admin/empty-admin-block';
import { RuleSourceStrip, RuleSourceSummary } from '@/components/admin/rule-source';

export function DocumentTypeDetailPanel({
  documentType,
  documentTypes,
  rules,
  onBack,
  onEdit,
  onDelete,
  onOpenRuleSource,
}: {
  documentType: DocumentType;
  documentTypes: DocumentType[];
  rules: Rule[];
  onBack: () => void;
  onEdit: (doc: DocumentType) => void;
  onDelete: (doc: DocumentType) => void;
  onOpenRuleSource: (rule: Rule) => void;
}) {
  const relatedRules = rules.filter((rule) =>
    rule.requiredDocuments.some(
      (req) => req.documentTypeId === documentType.id || req.alternativeDocumentTypeId === documentType.id,
    ),
  );
  const checkIds = Array.from(
    new Set([
      ...(documentType.checkIds || []),
      ...relatedRules.flatMap((rule) =>
        rule.requiredDocuments
          .filter((req) => req.documentTypeId === documentType.id || req.alternativeDocumentTypeId === documentType.id)
          .flatMap((req) => req.checks || []),
      ),
    ]),
  );
  const checks = checkDefinitions.filter((check) => checkIds.includes(check.id));
  const sources = uniqueRuleSources(relatedRules.flatMap((rule) => getRuleSources(rule)));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <Button variant="ghost" size="sm" className="-ml-3 mb-2" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              К списку документов
            </Button>
            <CardTitle className="text-xl">{documentType.name}</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">{documentType.description}</p>
          </div>
          <div className="flex shrink-0 flex-col gap-3">
            <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
              <Badge variant="secondary">{documentType.id}</Badge>
              <Badge variant="outline">{documentType.direction}</Badge>
              <Badge variant="outline">{documentType.acceptedFormats.join(', ')}</Badge>
              {documentType.needsOcr && <Badge variant="outline">OCR</Badge>}
              {documentType.isPhysicalSample && <Badge variant="outline">sample</Badge>}
            </div>
            <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
              <Button size="sm" variant="outline" onClick={() => onEdit(documentType)}>
                <Pencil className="mr-2 h-4 w-4" />
                Изменить
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onDelete(documentType)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Удалить
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="requirements" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start gap-2">
            <TabsTrigger value="requirements">Правила</TabsTrigger>
            <TabsTrigger value="conditions">Условия обязательности</TabsTrigger>
            <TabsTrigger value="checks">Проверки</TabsTrigger>
            <TabsTrigger value="imported">Требования</TabsTrigger>
            <TabsTrigger value="sources">Источники НПА</TabsTrigger>
          </TabsList>

          <TabsContent value="requirements" className="space-y-3">
            {relatedRules.length === 0 && <EmptyAdminBlock text="К этому типу документа пока не привязаны правила." />}
            {relatedRules.map((rule) => {
              const req = findDocumentRequirement(rule, documentType.id);
              const primarySource = getRuleSources(rule)[0];
              return (
                <div key={rule.id} className="rounded-xl border bg-background p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant={rule.active === false ? 'outline' : 'secondary'}>
                          {rule.active === false ? 'Выключено' : 'Активно'}
                        </Badge>
                        <Badge variant="outline">{rule.id}</Badge>
                        {req && <Badge variant="outline">{severityLabels[req.severityIfMissing]}</Badge>}
                      </div>
                      <p className="font-medium">{rule.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{formatRuleConditions(rule)}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {primarySource?.sourceDocumentId && (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={buildReferenceHref(primarySource)}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Источник
                          </Link>
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => onOpenRuleSource(rule)}>
                        Детали
                      </Button>
                    </div>
                  </div>
                  {req?.checks?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {req.checks.map((checkId) => (
                        <Badge key={checkId} variant="outline">
                          {checkId}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="conditions" className="space-y-3">
            {relatedRules.length === 0 && <EmptyAdminBlock text="Условия обязательности пока не заданы." />}
            {relatedRules.map((rule) => {
              const req = findDocumentRequirement(rule, documentType.id);
              const altDoc = req?.alternativeDocumentTypeId
                ? documentTypes.find((doc) => doc.id === req.alternativeDocumentTypeId)
                : undefined;
              return (
                <div key={rule.id} className="rounded-xl border bg-background p-4">
                  <p className="font-medium">{rule.name}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Документ требуется, если: {formatRuleConditions(rule)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {req && <Badge variant="outline">Отсутствие: {severityLabels[req.severityIfMissing]}</Badge>}
                    {altDoc && <Badge variant="outline">Альтернатива: {altDoc.name}</Badge>}
                  </div>
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="checks" className="space-y-3">
            {checks.length === 0 && <EmptyAdminBlock text="Проверки для этого типа документа пока не заданы." />}
            {checks.map((check) => (
              <div key={check.id} className="rounded-xl border bg-background p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className="font-medium">{check.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{check.description}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Badge variant="outline">{check.method}</Badge>
                    <Badge variant="outline">{check.category}</Badge>
                    <Badge variant="outline">{severityLabels[check.defaultSeverity]}</Badge>
                  </div>
                </div>
                {(check.npaReferences || []).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(check.npaReferences || []).map((npa) => (
                      <Badge key={npa} variant="secondary">
                        {npa}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="imported" className="space-y-3">
            {!(documentType.importedRequirements || []).length && (
              <EmptyAdminBlock text="Требований для этого типа документа пока нет." />
            )}
            {(documentType.importedRequirements || []).map((requirement) => (
              <div key={requirement.id} className="rounded-xl border bg-background p-4">
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">{requirement.source}</Badge>
                  {requirement.procedure && <Badge variant="outline">{requirement.procedure}</Badge>}
                  {requirement.checkType && <Badge variant="outline">{requirement.checkType}</Badge>}
                  {requirement.criticality && <Badge variant="outline">{requirement.criticality}</Badge>}
                  {requirement.sourcePoint && <Badge variant="outline">{requirement.sourcePoint}</Badge>}
                </div>
                <p className="font-medium">{requirement.requirementText}</p>
                {requirement.applicabilityCondition && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Условие: {requirement.applicabilityCondition}
                  </p>
                )}
                {requirement.quote && (
                  <blockquote className="mt-3 rounded-lg border-l-4 border-primary/50 bg-muted/40 p-3 text-sm text-muted-foreground">
                    {requirement.quote}
                  </blockquote>
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="sources" className="space-y-3">
            {sources.length === 0 && <EmptyAdminBlock text="Источники НПА для этого типа документа пока не заданы." />}
            {sources.map((source, index) => {
              const npa = source.npaId ? npas.find((item) => item.id === source.npaId) : undefined;
              return (
                <div key={`${source.sourceDocumentId || source.npaId || index}-${index}`} className="rounded-xl border bg-background p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        {npa && <Badge variant="secondary">{npa.number}</Badge>}
                        {source.sourceDocumentId && <Badge variant="outline">{source.sourceDocumentId}</Badge>}
                        {source.sourcePage && <Badge variant="outline">стр. {source.sourcePage}</Badge>}
                      </div>
                      <p className="text-sm font-medium">{source.sourceSection || npa?.name || 'Источник'}</p>
                      {source.sourceQuote && (
                        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{source.sourceQuote}</p>
                      )}
                    </div>
                    {source.sourceDocumentId && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={buildReferenceHref(source)}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Открыть
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
