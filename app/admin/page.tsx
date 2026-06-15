'use client';

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
import { toast } from 'sonner';
import { ArrowLeft, BookOpen, FileText, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Severity } from '@/lib/types';

const severityLabels: Record<Severity, string> = {
  critical: 'Критично',
  serious: 'Серьезно',
  warning: 'Предупреждение',
  unknown: 'Неизвестно',
};

export default function AdminPage() {
  const { rules, toggleRuleActive, updateDocSeverity, resetRules } = useRules();

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
            <TabsList className="mb-6">
              <TabsTrigger value="rules">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Правила
              </TabsTrigger>
              <TabsTrigger value="docs">
                <FileText className="mr-2 h-4 w-4" />
                Документы
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
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="secondary">{doc.acceptedFormats.join(', ')}</Badge>
                    <Badge variant="outline">{doc.direction}</Badge>
                  </div>
                </div>
              ))}
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
