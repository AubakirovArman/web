'use client';

import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { NewDossierDocumentType } from '@/lib/data/ls-dossier-document-types-new';
import { getLsDocumentRequirementForItem, getLsRequirednessText, getLsValidationChecksText } from '@/lib/data/ls-document-checks-mapping';
import { extractProcedureHint, extractTypeHint, formatNewDossierSection, splitRequirementText } from '@/lib/admin/new-dossier-document-type-utils';
import { DetailMeta, RequirednessBadge } from '@/components/admin/new-dossier-document-type-primitives';

export function NewDossierDocumentTypeDetail({
  item,
  onBack,
  onEdit,
  onDelete,
}: {
  item: NewDossierDocumentType;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const requirement = getLsDocumentRequirementForItem(item);
  const validationChecks = splitRequirementText(item.validationChecks || getLsValidationChecksText(item));
  const linkedParams = item.linkedApplicationParams?.length
    ? item.linkedApplicationParams
    : requirement?.applicationParamsWithTitles?.length
    ? requirement.applicationParamsWithTitles
    : requirement?.applicationParams || [];
  const requiredWhenExpression = item.requiredWhenExpression || requirement?.triggerExpression || '';
  const requirednessText = item.requirednessExplanation || getLsRequirednessText(item);
  const requirementSources = item.requirementSources || [];
  const fallbackSourceReference = item.npaReferences?.[0] || requirement?.sourceReference || '';

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              К документам
            </Button>
            <span className="font-mono text-sm font-semibold">{item.code || '—'}</span>
            <span className="min-w-0 font-semibold">{item.name}</span>
            <Badge variant="secondary">{item.direction}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" />
              Изменить
            </Button>
            <Button variant="ghost" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              Удалить
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid gap-3 border-b bg-muted/20 p-4 md:grid-cols-4">
          <DetailMeta label="Код" value={item.code || '—'} mono />
          <DetailMeta label="Область" value={item.direction} />
          <DetailMeta label="Раздел" value={formatNewDossierSection(item)} />
          <DetailMeta label="Форматы" value={item.acceptedFormats.join(', ') || 'pdf'} />
        </div>
        <Tabs defaultValue="requirements">
          <TabsList className="mx-4 mt-3 flex h-auto justify-start gap-2 bg-transparent p-0">
            <TabsTrigger value="requirements" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              Проверяемые требования ({validationChecks.length})
            </TabsTrigger>
            <TabsTrigger value="gemma" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              Идёт в Gemma ({item.checkProfileRequirements?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="requiredness" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              Информация и обязательность
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requirements" className="space-y-3 p-4">
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Код</th>
                    <th className="px-3 py-2">Что проверяется</th>
                    <th className="px-3 py-2">Когда активируется</th>
                    <th className="px-3 py-2">Источник</th>
                  </tr>
                </thead>
                <tbody>
                  {validationChecks.length > 0 ? (
                    validationChecks.map((check, index) => (
                      <tr key={`${item.id}-check-${index}`} className="border-b last:border-b-0">
                        <td className="px-3 py-3 align-top font-mono text-xs">{item.code || item.groupCode || '—'}</td>
                        <td className="px-3 py-3 align-top">{check}</td>
                        <td className="px-3 py-3 align-top">
                          <div className="max-w-md text-xs text-muted-foreground">{requiredWhenExpression || '—'}</div>
                        </td>
                        <td className="px-3 py-3 align-top text-muted-foreground">
                          {requirementSources[index]?.sourceReference || fallbackSourceReference || '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                        Требования пока не привязаны.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="gemma" className="space-y-3 p-4">
            <p className="text-xs text-muted-foreground">
              Эти требования реально уходят в Gemma при проверке заявки (из <span className="font-mono">document_check_profile</span> и{' '}
              <span className="font-mono">checker_routing</span>). Колонка «Текст» — это и есть то, что читает Gemma.
            </p>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="w-28 px-3 py-2">Тип</th>
                    <th className="px-3 py-2">Текст требования (идёт в Gemma)</th>
                    <th className="w-28 px-3 py-2">Критичность</th>
                    <th className="px-3 py-2">Условие применимости</th>
                  </tr>
                </thead>
                <tbody>
                  {(item.checkProfileRequirements || []).length > 0 ? (
                    (item.checkProfileRequirements || []).map((req) => (
                      <tr key={req.id} className="border-b align-top last:border-b-0">
                        <td className="px-3 py-3">
                          <Badge variant="outline">
                            {{ required: 'Обязательное', conditional: 'Условное', cross_document: 'Сверка', routing: 'Маршрут' }[req.kind] || req.kind}
                          </Badge>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{req.text}</div>
                          {req.title && <div className="mt-1 text-xs text-muted-foreground">{req.title}</div>}
                          {req.sourceReference && (
                            <div className="mt-1 text-[11px] text-muted-foreground">Источник: {req.sourceReference}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{req.criticality || '—'}</td>
                        <td className="px-3 py-3">
                          <div className="max-w-sm text-xs text-muted-foreground">{req.applicabilityCondition || '—'}</div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                        Профиль проверки Gemma для этого раздела пуст.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="requiredness" className="space-y-3 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border bg-background p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <RequirednessBadge item={item} hasRule={!!requirement} />
                  <Badge variant="outline">{item.active ? 'Активен' : 'Выключен'}</Badge>
                  <Badge variant="outline">{item.kind === 'document' ? 'Документ' : item.kind === 'section' ? 'Раздел' : 'Исключен'}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{item.description || item.name}</p>
              </div>
              <div className="rounded-xl border bg-background p-4">
                <p className="text-sm font-medium">Условие обязательности</p>
                <p className="mt-2 text-sm text-muted-foreground">{requirednessText}</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Обязательность</th>
                    <th className="px-3 py-2">Процедура</th>
                    <th className="px-3 py-2">Тип / класс</th>
                    <th className="px-3 py-2">Поля заявки</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-3"><RequirednessBadge item={item} hasRule={!!requirement} /></td>
                    <td className="px-3 py-3">{extractProcedureHint(requiredWhenExpression)}</td>
                    <td className="px-3 py-3">{extractTypeHint(requiredWhenExpression)}</td>
                    <td className="px-3 py-3 text-muted-foreground">{linkedParams.length ? `${linkedParams.length} связанных полей` : '—'}</td>
                  </tr>
                  {linkedParams.length > 0 && (
                    <tr>
                      <td className="px-3 py-3 align-top text-muted-foreground">Поля заявки</td>
                      <td colSpan={3} className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {linkedParams.map((param) => (
                            <Badge key={param} variant="outline">{param}</Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                  {fallbackSourceReference && (
                    <tr>
                      <td className="px-3 py-3 align-top text-muted-foreground">Источник</td>
                      <td colSpan={3} className="px-3 py-3 text-muted-foreground">{fallbackSourceReference}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
