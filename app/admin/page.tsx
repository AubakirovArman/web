'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/shared/site-header';
import { FadeIn } from '@/components/shared/motion';
import { useRules } from '@/lib/hooks/useRules';
import { documentTypes, npas, parameters } from '@/lib/data/seed';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, BookOpen, FileText, RotateCcw, SlidersHorizontal, ClipboardCheck, Package } from 'lucide-react';
import { Rule, Severity } from '@/lib/types';
import { checkDefinitions } from '@/lib/checks/registry';

const severityLabels: Record<Severity, string> = {
  critical: 'Критично',
  serious: 'Серьезно',
  warning: 'Предупреждение',
  unknown: 'Неизвестно',
};

export default function AdminPage() {
  const { rules, toggleRuleActive, updateDocSeverity, resetRules, importRules, exportRules } = useRules();
  const [rulesJson, setRulesJson] = useState('');

  const handleExportRules = () => {
    const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), rules: exportRules() }, null, 2);
    setRulesJson(payload);
    navigator.clipboard.writeText(payload).catch(() => undefined);
    toast.success('Rule package сформирован');
  };

  const handleImportRules = () => {
    try {
      const payload = JSON.parse(rulesJson) as { rules?: Rule[] } | Rule[];
      const nextRules = Array.isArray(payload) ? payload : payload.rules;
      if (!Array.isArray(nextRules)) throw new Error('JSON должен содержать массив rules');
      importRules(nextRules);
      toast.success('Rule package импортирован');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось импортировать правила');
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 bg-muted/20 py-6">
        <div className="container mx-auto max-w-6xl px-4">
          <FadeIn>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Панель администратора</h1>
                <p className="text-sm text-muted-foreground">Управление правилами, документами и справочниками</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => { resetRules(); toast.success('Правила сброшены к исходным'); }}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Сбросить
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    На главную
                  </Link>
                </Button>
              </div>
            </div>
          </FadeIn>

          <Tabs defaultValue="rules">
            <TabsList className="mb-6 flex h-auto flex-wrap justify-start gap-2">
              <TabsTrigger value="rules">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Правила
              </TabsTrigger>
              <TabsTrigger value="docs">
                <FileText className="mr-2 h-4 w-4" />
                Документы
              </TabsTrigger>
              <TabsTrigger value="checks">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Проверки
              </TabsTrigger>
              <TabsTrigger value="packages">
                <Package className="mr-2 h-4 w-4" />
                Rule package
              </TabsTrigger>
              <TabsTrigger value="npas">
                <BookOpen className="mr-2 h-4 w-4" />
                НПА
              </TabsTrigger>
            </TabsList>

            <TabsContent value="rules" className="space-y-4">
              {rules.map((rule) => (
                <Card key={rule.id} className={rule.active === false ? 'opacity-60' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{rule.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{rule.id}</Badge>
                        <Button
                          size="sm"
                          variant={rule.active === false ? 'secondary' : 'default'}
                          onClick={() => toggleRuleActive(rule.id)}
                        >
                          {rule.active === false ? 'Выключено' : 'Включено'}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Условия:{' '}
                      {rule.conditions
                        .map((c) => {
                          const param = parameters.find((p) => p.id === c.parameterId);
                          return `${param?.label || c.parameterId} ${c.operator} ${c.value || ''}`;
                        })
                        .join(' AND ')}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {rule.requiredDocuments.map((req) => {
                        const doc = documentTypes.find((d) => d.id === req.documentTypeId);
                        return (
                          <li
                            key={req.documentTypeId}
                            className="flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span>{doc?.name || req.documentTypeId}</span>
                            <div className="flex items-center gap-2">
                              {req.alternativeDocumentTypeId && (
                                <span className="text-xs text-muted-foreground">
                                  альт. {documentTypes.find((d) => d.id === req.alternativeDocumentTypeId)?.name}
                                </span>
                              )}
                              {req.checks?.length ? (
                                <span className="text-xs text-muted-foreground">checks: {req.checks.join(', ')}</span>
                              ) : null}
                              <Select
                                value={req.severityIfMissing}
                                onValueChange={(v) => updateDocSeverity(rule.id, req.documentTypeId, v as Severity)}
                              >
                                <SelectTrigger className="w-36">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(['critical', 'serious', 'warning', 'unknown'] as Severity[]).map((sev) => (
                                    <SelectItem key={sev} value={sev}>
                                      {severityLabels[sev]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <Separator className="my-3" />
                    <p className="text-xs text-muted-foreground">
                      НПА: {npas.find((n) => n.id === rule.sourceNpaId)?.number || '—'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="docs" className="space-y-3">
              {documentTypes.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
                  <div>
                    <p className="font-medium">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      checks: {(doc.checkIds || []).join(', ') || '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      extracted: {(doc.expectedExtractedFields || []).join(', ') || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="secondary">{doc.acceptedFormats.join(', ')}</Badge>
                    <Badge variant="outline">{doc.direction}</Badge>
                    {doc.needsOcr && <Badge variant="outline">OCR</Badge>}
                    {doc.isPhysicalSample && <Badge variant="outline">sample</Badge>}
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="checks" className="space-y-3">
              {checkDefinitions.map((check) => (
                <Card key={check.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{check.name}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">{check.description}</p>
                      </div>
                      <Badge variant="outline">{check.method}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary">{check.id}</Badge>
                    <Badge variant="outline">{check.category}</Badge>
                    <Badge variant="outline">{severityLabels[check.defaultSeverity]}</Badge>
                    <Badge variant="outline">{check.appliesTo.join(', ')}</Badge>
                    {(check.npaReferences || []).map((npa) => (
                      <Badge key={npa} variant="outline">
                        {npa}
                      </Badge>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="packages" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Экспорт / импорт правил</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleExportRules}>Экспортировать JSON</Button>
                    <Button variant="outline" onClick={handleImportRules}>
                      Импортировать JSON
                    </Button>
                  </div>
                  <Textarea
                    value={rulesJson}
                    onChange={(event) => setRulesJson(event.target.value)}
                    placeholder="Вставьте rule package JSON или нажмите экспорт"
                    className="min-h-80 font-mono text-xs"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="npas" className="space-y-3">
              {npas.map((npa) => (
                <div key={npa.id} className="rounded-lg border bg-card p-4">
                  <div className="flex items-start justify-between">
                    <p className="font-medium">{npa.name}</p>
                    <Badge variant="outline">{npa.direction}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {npa.number} от {npa.date}
                  </p>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
