'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { parameters, npas } from '@/lib/data/seed';
import type { DocumentType, Rule, RuleSource } from '@/lib/types';
import { getRuleSources } from '@/lib/reference/rule-sources';
import { severityLabels } from '@/lib/admin/admin-page-types';
import { buildReferenceHref } from '@/lib/admin/document-type-logic';

export function RuleSourceSummary({ source }: { source?: RuleSource }) {
  if (!source) {
    return <p className="mt-2 text-xs text-muted-foreground">Источник не задан</p>;
  }

  const npa = source.npaId ? npas.find((item) => item.id === source.npaId) : undefined;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {npa && <Badge variant="secondary">{npa.number}</Badge>}
      {source.sourceDocumentId && <Badge variant="outline">{source.sourceDocumentId}</Badge>}
      <span className="min-w-0 truncate">
        {source.sourceSection || npa?.name || source.sourceQuote || 'Источник правила'}
      </span>
    </div>
  );
}

export function RuleSourceStrip({ sources, onOpenDetails }: { sources: RuleSource[]; onOpenDetails: () => void }) {
  if (!sources.length) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        Источник правила пока не задан. Откройте детали правила и добавьте связь с НПА.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-muted/25 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium text-foreground">Источник правила</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {sources.map((source, index) => {
            const npa = source.npaId ? npas.find((item) => item.id === source.npaId) : undefined;
            return (
              <Badge key={`${source.sourceDocumentId || source.npaId || index}-${index}`} variant="outline">
                {npa?.number || source.sourceDocumentId || source.sourceSection || 'Источник'}
              </Badge>
            );
          })}
        </div>
      </div>
      <Button size="sm" variant="ghost" onClick={onOpenDetails}>
        Все основания
      </Button>
    </div>
  );
}

export function RuleSourceDialog({
  rule,
  documentTypes,
  onClose,
}: {
  rule: Rule | null;
  documentTypes: DocumentType[];
  onClose: () => void;
}) {
  const sources = rule ? getRuleSources(rule) : [];

  return (
    <Dialog open={!!rule} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[92vw] xl:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{rule?.name || 'Источник правила'}</DialogTitle>
          <DialogDescription>
            Связка правила с НПА, документом справочника и цитатой. Из этого окна можно сразу открыть источник.
          </DialogDescription>
        </DialogHeader>

        {rule && (
          <div className="space-y-5">
            <div className="grid gap-3 xl:grid-cols-[1fr_1.2fr]">
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Условия срабатывания</p>
                <div className="space-y-1 text-sm">
                  {rule.conditions.map((condition) => {
                    const param = parameters.find((item) => item.id === condition.parameterId);
                    return (
                      <p key={`${condition.parameterId}-${condition.operator}-${condition.value}`}>
                        {param?.label || condition.parameterId} {condition.operator} {condition.value || ''}
                      </p>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Требуемые документы</p>
                <div className="space-y-1 text-sm">
                  {rule.requiredDocuments.map((req) => {
                    const doc = documentTypes.find((item) => item.id === req.documentTypeId);
                    const altDoc = req.alternativeDocumentTypeId
                      ? documentTypes.find((item) => item.id === req.alternativeDocumentTypeId)
                      : undefined;
                    return (
                      <p key={req.documentTypeId}>
                        {doc?.name || req.documentTypeId}
                        {altDoc ? ` или ${altDoc.name}` : ''} · {severityLabels[req.severityIfMissing]}
                      </p>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Источники и переходы в справочник</p>
              {sources.length === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Для этого правила пока не задан источник.
                </div>
              )}
              {sources.map((source, index) => {
                const npa = source.npaId ? npas.find((item) => item.id === source.npaId) : undefined;
                const referenceHref = buildReferenceHref(source);
                return (
                  <div key={`${source.sourceDocumentId || source.npaId || index}-${index}`} className="rounded-xl border bg-background p-4">
                    <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {npa && <Badge variant="secondary">{npa.number}</Badge>}
                          {source.sourceDocumentId && <Badge variant="outline">{source.sourceDocumentId}</Badge>}
                          {source.sourcePage && <Badge variant="outline">стр. {source.sourcePage}</Badge>}
                        </div>
                        {source.sourceSection && (
                          <p className="text-sm font-medium">{source.sourceSection}</p>
                        )}
                      </div>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={referenceHref}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Открыть источник
                        </Link>
                      </Button>
                    </div>
                    {source.sourceQuote && (
                      <blockquote className="mt-2 whitespace-pre-wrap rounded-lg border-l-4 border-primary/50 bg-muted/50 p-4 text-sm leading-7 text-muted-foreground">
                        {source.sourceQuote}
                      </blockquote>
                    )}
                    {source.explanation && (
                      <p className="mt-2 text-sm text-muted-foreground">{source.explanation}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
