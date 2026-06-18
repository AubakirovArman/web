'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DocumentType, Rule } from '@/lib/types';
import { checkDefinitions } from '@/lib/checks/registry';
import { severityLabels } from '@/lib/admin/admin-page-types';
import { buildApplicationCheckMapRows } from '@/lib/admin/check-map-logic';

export function ApplicationCheckMapPanel({
  rules,
  documentTypes,
  onOpenDocument,
  onOpenCheck,
}: {
  rules: Rule[];
  documentTypes: DocumentType[];
  onOpenDocument: (doc: DocumentType) => void;
  onOpenCheck: (checkId: string) => void;
}) {
  const rows = buildApplicationCheckMapRows(rules, documentTypes);
  const groups = rows.reduce<Record<string, typeof rows>>((acc, row) => {
    const key = `${row.objectLabel} · ${row.procedureLabel}`;
    acc[key] = acc[key] || [];
    acc[key].push(row);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <CardTitle className="text-base">Карта проверки заявок</CardTitle>
            <p className="text-sm text-muted-foreground">
              Какая процедура включает какие документы и какие проверки будут запускаться по каждому документу.
            </p>
          </div>
          <Badge variant="outline">{rows.length} связей</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="space-y-2">
          {Object.entries(groups).map(([groupName, groupRows]) => (
            <AccordionItem key={groupName} value={groupName} className="rounded-xl border bg-background px-4">
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex w-full items-center justify-between gap-3 pr-3 text-left">
                  <span className="font-medium">{groupName}</span>
                  <Badge variant="outline">{groupRows.length} строк</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Правило</th>
                        <th className="px-3 py-2 font-medium">Документ</th>
                        <th className="px-3 py-2 font-medium">Форматы</th>
                        <th className="px-3 py-2 font-medium">Критичность</th>
                        <th className="px-3 py-2 font-medium">Проверки</th>
                        <th className="px-3 py-2 font-medium">Условие</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupRows.map((row) => (
                        <tr key={`${row.ruleId}-${row.documentTypeId}`} className="border-b last:border-b-0">
                          <td className="px-3 py-3 align-top">
                            <div className="font-medium">{row.ruleName}</div>
                            <div className="text-xs text-muted-foreground">{row.ruleId}</div>
                          </td>
                          <td className="px-3 py-3 align-top">
                            {row.document ? (
                              <button className="text-left font-medium text-primary hover:underline" onClick={() => onOpenDocument(row.document!)}>
                                {row.document.name}
                              </button>
                            ) : (
                              <span>{row.documentTypeId}</span>
                            )}
                            {row.alternativeDocumentName && (
                              <div className="mt-1 text-xs text-muted-foreground">Альтернатива: {row.alternativeDocumentName}</div>
                            )}
                          </td>
                          <td className="px-3 py-3 align-top">
                            <div className="flex flex-wrap gap-1">
                              {row.formats.map((format) => (
                                <Badge key={format} variant="secondary">
                                  {format}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top">{severityLabels[row.severity]}</td>
                          <td className="px-3 py-3 align-top">
                            <div className="flex max-w-[320px] flex-wrap gap-1.5">
                              {row.checkIds.map((checkId) => (
                                <button
                                  key={checkId}
                                  type="button"
                                  onClick={() => onOpenCheck(checkId)}
                                  className="rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
                                >
                                  {checkDefinitions.find((check) => check.id === checkId)?.name || checkId}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-3 align-top text-xs text-muted-foreground">{row.conditions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

