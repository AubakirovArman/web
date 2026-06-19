import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, Metric } from './reference-common';
import { EntityList } from './reference-entity-list';
import { FullText } from './reference-full-text';
import { kindLabels, statusLabels } from './reference-utils';
import type { ReferenceExperimentDocument } from './reference-types';

export function DocumentDetail({ document, onBack }: { document: ReferenceExperimentDocument; onBack: () => void }) {
  const intelligence = document.intelligence;
  const counts = {
    requirements: intelligence?.requirements?.length || 0,
    documentTypes: intelligence?.document_types?.length || 0,
    parameters: intelligence?.applicant_parameters?.length || 0,
    dependencies: intelligence?.dependencies?.length || 0,
  };

  return (
    <div className="min-w-0 space-y-4">
      <Card className="border-teal-200/70 bg-gradient-to-br from-background to-teal-50/40 dark:to-teal-950/20">
        <CardHeader>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <Button variant="ghost" size="sm" className="-ml-2 mb-3" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />Назад к таблице</Button>
              <div className="mb-2 flex flex-wrap gap-2"><Badge variant="secondary">{document.domain}</Badge><Badge variant="outline">{kindLabels[document.kind] || document.kind}</Badge><Badge variant="outline">{document.number || 'без номера'}</Badge><Badge variant="outline">~{document.tokenEstimate.toLocaleString('ru-RU')} токенов</Badge></div>
              <CardTitle className="text-xl leading-7">{document.title}</CardTitle>
              <p className="mt-2 text-xs text-muted-foreground">{document.fileName}</p>
            </div>
            <Badge variant={document.status === 'processed' ? 'default' : document.status === 'error' ? 'destructive' : 'outline'}>{statusLabels[document.status]}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {document.status === 'pending' && <EmptyState title="Документ еще не обработан автоматически" text="Он уже включен в экспериментальный список. Запустите скрипт с большим --max-documents или --all." />}
          {document.status === 'error' && <EmptyState title="Ошибка обработки" text={document.error || 'Автоматическая проверка не вернула результат.'} />}
          {intelligence && <><div className="grid gap-3 md:grid-cols-4"><Metric label="Требования" value={String(counts.requirements)} /><Metric label="Типы документов" value={String(counts.documentTypes)} /><Metric label="Параметры" value={String(counts.parameters)} /><Metric label="Зависимости" value={String(counts.dependencies)} /></div><div className="rounded-xl border bg-background/70 p-4"><p className="text-sm font-semibold">О чем документ</p><p className="mt-2 text-sm leading-7 text-muted-foreground">{intelligence.summary.detailed || intelligence.summary.short}</p>{intelligence.summary.project_relevance && <p className="mt-3 text-sm leading-7"><span className="font-medium">Для проекта: </span>{intelligence.summary.project_relevance}</p>}</div></>}
        </CardContent>
      </Card>

      {intelligence && (
        <Tabs defaultValue="requirements" className="space-y-4">
          <TabsList className="flex h-auto flex-wrap justify-start gap-2"><TabsTrigger value="requirements">Требования</TabsTrigger><TabsTrigger value="documents">Типы документов</TabsTrigger><TabsTrigger value="parameters">Параметры</TabsTrigger><TabsTrigger value="dependencies">Зависимости</TabsTrigger><TabsTrigger value="checks">Проверки</TabsTrigger><TabsTrigger value="text">Полный текст</TabsTrigger></TabsList>
          <TabsContent value="requirements"><EntityList empty="Автоматический анализ не нашел требований к документам." items={intelligence.requirements} fields={[["title", "Требование"], ["requirement_text", "Описание"], ["applies_to_document", "Документ"], ["procedure", "Процедура"], ["condition", "Условие"], ["criticality", "Критичность"], ["why_it_matters", "Почему важно"], ["source_point", "Пункт"]]} /></TabsContent>
          <TabsContent value="documents"><EntityList empty="Автоматический анализ не нашел типы документов." items={intelligence.document_types} fields={[["code", "Код"], ["name", "Тип документа"], ["mapped_guess", "Похоже на наш тип"], ["procedure", "Процедура"], ["requiredness", "Обязательность"], ["condition", "Условие"], ["why_needed", "Зачем нужен"], ["source_point", "Пункт"]]} /></TabsContent>
          <TabsContent value="parameters"><EntityList empty="Автоматический анализ не нашел параметры заявки." items={intelligence.applicant_parameters} fields={[["key", "Ключ"], ["label", "Параметр"], ["type", "Тип"], ["options", "Варианты"], ["why_needed", "Зачем нужен"], ["source_point", "Пункт"]]} /></TabsContent>
          <TabsContent value="dependencies"><EntityList empty="Автоматический анализ не нашел зависимостей." items={intelligence.dependencies} fields={[["condition_text", "Если"], ["if_parameters", "Параметры"], ["then_required_documents", "Тогда документы"], ["then_checks", "Тогда проверки"], ["explanation", "Объяснение"], ["source_point", "Пункт"]]} /></TabsContent>
          <TabsContent value="checks"><EntityList empty="Автоматический анализ не нашел проверок." items={intelligence.checks} fields={[["name", "Проверка"], ["check_type", "Тип"], ["target_document", "Документ"], ["automation_hint", "Как автоматизировать"], ["source_point", "Пункт"]]} /></TabsContent>
          <TabsContent value="text"><FullText document={document} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
