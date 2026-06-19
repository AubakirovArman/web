'use client';

import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CheckDefinition, DocumentType, Rule } from '@/lib/types';
import { getRuleSources } from '@/lib/reference/rule-sources';
import { severityLabels } from '@/lib/admin/admin-page-types';
import { buildReferenceHref, formatRuleConditions } from '@/lib/admin/document-type-logic';
import { buildRequiredFieldRows, getCheckImplementationBlueprint, getConsistencyMatrix, getDocumentsForCheck, getRequiredDocsForCheck, getRulesForCheck } from '@/lib/admin/check-map-logic';
import { CheckInfoBox } from '@/components/admin/check-info-box';
import { EmptyAdminBlock } from '@/components/admin/empty-admin-block';

export function CheckDetailPanel({
  check,
  documentTypes,
  rules,
  onBack,
  onOpenDocument,
  onOpenRuleSource,
}: {
  check: CheckDefinition;
  documentTypes: DocumentType[];
  rules: Rule[];
  onBack: () => void;
  onOpenDocument: (doc: DocumentType) => void;
  onOpenRuleSource: (rule: Rule) => void;
}) {
  const relatedDocs = getDocumentsForCheck(check, documentTypes, rules);
  const relatedRules = getRulesForCheck(check, documentTypes, rules);
  const blueprint = getCheckImplementationBlueprint(check);
  const requiredFieldRows = check.id === 'required_fields_check' ? buildRequiredFieldRows() : [];
  const consistencyRows = getConsistencyMatrix(check.id);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-primary/20">
        <CardHeader>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={onBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Назад к проверкам
              </Button>
              <CardTitle className="text-xl">{check.name}</CardTitle>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{check.description}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Badge variant="secondary">{check.method}</Badge>
              <Badge variant="outline">{check.category}</Badge>
              <Badge variant="outline">{severityLabels[check.defaultSeverity]}</Badge>
              <Badge variant="outline">{check.appliesTo.join(', ')}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <CheckInfoBox label="Что проверяет" value={blueprint.goal} />
          <CheckInfoBox label="Вход проверки" value={blueprint.input} />
          <CheckInfoBox label="Результат" value={blueprint.output} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Контракт реализации</CardTitle>
          <p className="text-sm text-muted-foreground">
            Это техническая карта для будущего runner-скрипта или ИИ-проверки по `check.id`.
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          <CheckInfoBox label="Метод" value={blueprint.method} />
          <CheckInfoBox label="Алгоритм" value={blueprint.algorithm} />
          <CheckInfoBox label="Когда нужен ИИ-анализ" value={blueprint.gemma} />
          <CheckInfoBox label="Что считается ошибкой" value={blueprint.failure} />
        </CardContent>
      </Card>

      {requiredFieldRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Обязательные поля заявления</CardTitle>
            <p className="text-sm text-muted-foreground">
              Матрица строится из профиля заявки: ЛС/МИ и три процедуры. Проверка выполняется по значениям цифровой заявки; для Word/PDF-заявления позже подключается parser/OCR/ИИ-извлечение.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Объект</th>
                    <th className="px-4 py-3 font-medium">Процедура</th>
                    <th className="px-4 py-3 font-medium">Поле</th>
                    <th className="px-4 py-3 font-medium">Проверка</th>
                    <th className="px-4 py-3 font-medium">Источник</th>
                  </tr>
                </thead>
                <tbody>
                  {requiredFieldRows.map((row) => (
                    <tr key={`${row.objectType}-${row.procedure}-${row.fieldId}`} className="border-b last:border-b-0">
                      <td className="px-4 py-3 align-top">{row.objectLabel}</td>
                      <td className="px-4 py-3 align-top">{row.procedureLabel}</td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium">{row.fieldLabel}</div>
                        <div className="text-xs text-muted-foreground">{row.fieldId}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-muted-foreground">Поле должно быть заполнено; пустое значение блокирует отправку.</td>
                      <td className="px-4 py-3 align-top text-muted-foreground">{row.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {consistencyRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Матрица совокупной проверки</CardTitle>
            <p className="text-sm text-muted-foreground">
              Такие проверки сравнивают не один файл, а несколько документов и поля заявки.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Поле/сущность</th>
                    <th className="px-4 py-3 font-medium">Где берем</th>
                    <th className="px-4 py-3 font-medium">С чем сверяем</th>
                    <th className="px-4 py-3 font-medium">Ошибка</th>
                  </tr>
                </thead>
                <tbody>
                  {consistencyRows.map((row) => (
                    <tr key={row.subject} className="border-b last:border-b-0">
                      <td className="px-4 py-3 align-top font-medium">{row.subject}</td>
                      <td className="px-4 py-3 align-top text-muted-foreground">{row.source}</td>
                      <td className="px-4 py-3 align-top text-muted-foreground">{row.compareWith}</td>
                      <td className="px-4 py-3 align-top text-muted-foreground">{row.failure}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Документы, на которые распространяется проверка</CardTitle>
          <p className="text-sm text-muted-foreground">
            Для `file_format_check` здесь видно, какому документу какие форматы разрешены. Для parser/OCR/ИИ-анализ видно, какие поля можно извлекать.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {relatedDocs.length === 0 ? (
            <div className="p-4">
              <EmptyAdminBlock text="Пока нет документов, явно связанных с этой проверкой." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Документ</th>
                    <th className="px-4 py-3 font-medium">Форматы</th>
                    <th className="px-4 py-3 font-medium">Обработка</th>
                    <th className="px-4 py-3 font-medium">Извлекаемые поля</th>
                    <th className="px-4 py-3 font-medium">Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {relatedDocs.map((doc) => (
                    <tr key={doc.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium">{doc.name}</div>
                        <div className="text-xs text-muted-foreground">{doc.id}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          {doc.acceptedFormats.map((format) => (
                            <Badge key={format} variant="secondary">
                              {format}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          {doc.needsOcr && <Badge variant="outline">OCR</Badge>}
                          {doc.canCheckFont && <Badge variant="outline">DOCX/font</Badge>}
                          {doc.canCheckExpiry && <Badge variant="outline">срок</Badge>}
                          {doc.canCheckSignature && <Badge variant="outline">подпись</Badge>}
                          {doc.canCheckSeal && <Badge variant="outline">печать</Badge>}
                          {doc.isPhysicalSample && <Badge variant="outline">образец</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                        {(doc.expectedExtractedFields || []).length ? doc.expectedExtractedFields?.join(', ') : '—'}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Button size="sm" variant="outline" onClick={() => onOpenDocument(doc)}>
                          Открыть тип
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Правила и условия, которые включают проверку</CardTitle>
          <p className="text-sm text-muted-foreground">
            Это связь “параметры заявки → правило → обязательный документ → проверка”.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {relatedRules.length === 0 ? (
            <div className="p-4">
              <EmptyAdminBlock text="Нет правил, которые явно включают эту проверку." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Правило</th>
                    <th className="px-4 py-3 font-medium">Условия</th>
                    <th className="px-4 py-3 font-medium">Документы</th>
                    <th className="px-4 py-3 font-medium">Источник</th>
                  </tr>
                </thead>
                <tbody>
                  {relatedRules.map((rule) => {
                    const docs = getRequiredDocsForCheck(check, documentTypes, rule);
                    const sources = getRuleSources(rule);
                    const primarySource = sources[0];
                    return (
                      <tr key={rule.id} className="border-b last:border-b-0">
                        <td className="px-4 py-3 align-top">
                          <div className="font-medium">{rule.name}</div>
                          <div className="text-xs text-muted-foreground">{rule.id}</div>
                        </td>
                        <td className="px-4 py-3 align-top text-muted-foreground">{formatRuleConditions(rule)}</td>
                        <td className="px-4 py-3 align-top text-muted-foreground">
                          {docs.map((doc) => documentTypes.find((item) => item.id === doc.documentTypeId)?.name || doc.documentTypeId).join(', ')}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap gap-2">
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Источники НПА</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-xs">
          {(check.npaReferences || []).length ? (
            (check.npaReferences || []).map((npa) => (
              <Badge key={npa} variant="outline">
                {npa}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">Источники будут уточняться через справочник и автоматическое извлечение.</span>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

