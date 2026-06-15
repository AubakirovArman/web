'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { SiteHeader } from '@/components/shared/site-header';
import { FadeIn } from '@/components/shared/motion';
import { useRules } from '@/lib/hooks/useRules';
import { npas, parameters } from '@/lib/data/seed';
import { documentTypes as seedDocumentTypes, useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, BookOpen, FileText, RotateCcw, SlidersHorizontal, ClipboardCheck, Package, ExternalLink, ChevronRight, Sparkles, Plus, Pencil, Trash2 } from 'lucide-react';
import { DocumentType, DocumentTypeRequirement, Rule, RuleSource, Severity } from '@/lib/types';
import { checkDefinitions } from '@/lib/checks/registry';
import { getNpaReferenceDocumentId, getRuleSources } from '@/lib/reference/rule-sources';

const severityLabels: Record<Severity, string> = {
  critical: 'Критично',
  serious: 'Серьезно',
  warning: 'Предупреждение',
  unknown: 'Неизвестно',
};

interface NpaGemmaPreview {
  previewId: string;
  promptVersion: string;
  sourceKind?: 'reference' | 'upload';
  createdAt?: string;
  document: {
    id: string;
    title: string;
    domain: string;
    fileName: string;
    number?: string | null;
    date?: string | null;
    sectionsTotal: number;
    payloadChars: number;
    sampleSections: Array<{
      id: string;
      type?: string | null;
      number?: string | null;
      title?: string | null;
      text: string;
    }>;
  };
  extraction: {
    area: string;
    act?: Record<string, unknown>;
    procedures: string[];
    document_types: Record<string, unknown>[];
    requirements: Record<string, unknown>[];
    change_types: Record<string, unknown>[];
    applicant_parameters: Record<string, unknown>[];
    parameter_groups: Record<string, unknown>[];
    parameter_dependencies: Record<string, unknown>[];
    quality_notes: string[];
    meta?: Record<string, unknown>;
  };
  summary: {
    area: string;
    procedures: string[];
    document_types: number;
    requirements: number;
    applicant_parameters: number;
    parameter_groups: number;
    parameter_dependencies: number;
    change_types: number;
  };
}

interface GemmaJobState {
  title: string;
  stage: string;
  progress: number;
  status: 'running' | 'done' | 'error';
  error?: string;
}

interface DocumentTypeEditorState {
  mode: 'create' | 'edit';
  values: DocumentType;
}

export default function AdminPage() {
  const { rules, toggleRuleActive, updateDocSeverity, resetRules, importRules, exportRules } = useRules();
  const { store, setDocumentTypes } = useStore();
  const documentTypes = store.documentTypes;
  const [rulesJson, setRulesJson] = useState('');
  const [sourceRule, setSourceRule] = useState<Rule | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType | null>(null);
  const [documentTypeEditor, setDocumentTypeEditor] = useState<DocumentTypeEditorState | null>(null);
  const [gemmaPreview, setGemmaPreview] = useState<NpaGemmaPreview | null>(null);
  const [gemmaPreviewLoadingId, setGemmaPreviewLoadingId] = useState<string | null>(null);
  const [gemmaJob, setGemmaJob] = useState<GemmaJobState | null>(null);
  const [gemmaPreviews, setGemmaPreviews] = useState<NpaGemmaPreview[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ndda-gemma-previews') || '[]') as NpaGemmaPreview[];
      if (Array.isArray(saved)) setGemmaPreviews(saved.slice(0, 6));
    } catch {
      setGemmaPreviews([]);
    }
  }, []);

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

  const openCreateDocumentType = () => {
    setDocumentTypeEditor({
      mode: 'create',
      values: createBlankDocumentType(documentTypes),
    });
  };

  const openEditDocumentType = (doc: DocumentType) => {
    setDocumentTypeEditor({
      mode: 'edit',
      values: cloneDocumentType(doc),
    });
  };

  const handleSaveDocumentType = (values: DocumentType) => {
    const normalized = normalizeDocumentType(values);
    if (!normalized.id || !normalized.name || normalized.acceptedFormats.length === 0) {
      toast.error('Заполните ID, название и хотя бы один формат');
      return;
    }
    const duplicate = documentTypes.some(
      (doc) => doc.id === normalized.id && (documentTypeEditor?.mode !== 'edit' || doc.id !== documentTypeEditor.values.id),
    );
    if (duplicate) {
      toast.error('Тип документа с таким ID уже существует');
      return;
    }

    if (documentTypeEditor?.mode === 'edit') {
      setDocumentTypes(documentTypes.map((doc) => (doc.id === documentTypeEditor.values.id ? normalized : doc)));
      if (selectedDocumentType?.id === documentTypeEditor.values.id) setSelectedDocumentType(normalized);
      toast.success('Тип документа обновлен');
    } else {
      setDocumentTypes([normalized, ...documentTypes]);
      toast.success('Тип документа создан');
    }
    setDocumentTypeEditor(null);
  };

  const handleDeleteDocumentType = (doc: DocumentType) => {
    const references = countDocumentTypeRuleReferences(rules, doc.id);
    if (references > 0) {
      toast.error(`Нельзя удалить: тип документа используется в ${references} правил(ах)`);
      return;
    }
    setDocumentTypes(documentTypes.filter((item) => item.id !== doc.id));
    if (selectedDocumentType?.id === doc.id) setSelectedDocumentType(null);
    toast.success('Тип документа удален');
  };

  const handleResetDocumentTypes = () => {
    setDocumentTypes(seedDocumentTypes);
    setSelectedDocumentType(null);
    toast.success('Типы документов сброшены к исходным');
  };

  const handleApplyGemmaMappings = (preview: NpaGemmaPreview, mappings: Record<string, string>) => {
    const importedAt = new Date().toISOString();
    const nextByDocumentId = new Map<string, DocumentTypeRequirement[]>();

    preview.extraction.document_types.forEach((gemmaDoc, index) => {
      const mappingKey = getGemmaDocumentKey(gemmaDoc, index);
      const targetDocumentTypeId = mappings[mappingKey];
      if (!targetDocumentTypeId) return;

      const relatedRequirements = preview.extraction.requirements.filter((requirement) =>
        requirementBelongsToGemmaDocument(requirement, gemmaDoc),
      );
      const requirementsToImport = buildRequirementsFromGemma(
        preview,
        gemmaDoc,
        relatedRequirements,
        importedAt,
      );
      nextByDocumentId.set(targetDocumentTypeId, [
        ...(nextByDocumentId.get(targetDocumentTypeId) || []),
        ...requirementsToImport,
      ]);
    });

    if (nextByDocumentId.size === 0) {
      toast.error('Выберите хотя бы один тип документа для заливки');
      return;
    }

    let importedCount = 0;
    const nextDocumentTypes = documentTypes.map((doc) => {
      const incoming = nextByDocumentId.get(doc.id);
      if (!incoming?.length) return doc;
      importedCount += incoming.length;
      const sourceReference = buildGemmaSourceReference(preview);
      return {
        ...doc,
        npaReferences: uniqueList([...(doc.npaReferences || []), sourceReference]),
        importedRequirements: mergeImportedRequirements(doc.importedRequirements || [], incoming),
      };
    });

    setDocumentTypes(nextDocumentTypes);
    if (selectedDocumentType) {
      setSelectedDocumentType(nextDocumentTypes.find((doc) => doc.id === selectedDocumentType.id) || selectedDocumentType);
    }
    toast.success(`Залито требований: ${importedCount}`);
  };

  const rememberGemmaPreview = (preview: NpaGemmaPreview) => {
    const normalized = compactGemmaPreview(preview);
    setGemmaPreview(normalized);
    setGemmaPreviews((current) => {
      const next = [normalized, ...current.filter((item) => item.previewId !== normalized.previewId)].slice(0, 6);
      try {
        localStorage.setItem('ndda-gemma-previews', JSON.stringify(next));
      } catch {
        toast.error('Не удалось сохранить историю предпросмотров в браузере');
      }
      return next;
    });
  };

  const handleGemmaPreview = async (documentId: string, title?: string) => {
    setGemmaPreviewLoadingId(documentId);
    setGemmaPreview(null);
    setGemmaJob({
      title: title || documentId,
      stage: 'Подготовка структурированного НПА из справочника',
      progress: 18,
      status: 'running',
    });
    const timer = window.setInterval(() => {
      setGemmaJob((job) => {
        if (!job || job.status !== 'running') return job;
        const nextProgress = Math.min(job.progress + 4, 88);
        return {
          ...job,
          progress: nextProgress,
          stage: nextProgress < 42 ? 'Сбор пунктов и подпунктов' : 'Gemma анализирует требования и параметры',
        };
      });
    }, 1200);
    try {
      const response = await fetch('/api/admin/npa-gemma-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Не удалось обработать НПА через Gemma');
      }
      rememberGemmaPreview(payload as NpaGemmaPreview);
      setGemmaJob({
        title: title || documentId,
        stage: 'Готово. Проверьте извлеченные документы, правила и параметры',
        progress: 100,
        status: 'done',
      });
    } catch (error) {
      setGemmaJob({
        title: title || documentId,
        stage: 'Ошибка обработки',
        progress: 100,
        status: 'error',
        error: error instanceof Error ? error.message : 'Не удалось обработать НПА через Gemma',
      });
      toast.error(error instanceof Error ? error.message : 'Не удалось обработать НПА через Gemma');
    } finally {
      window.clearInterval(timer);
      setGemmaPreviewLoadingId(null);
    }
  };

  const handleGemmaUpload = async () => {
    if (!uploadFile) {
      toast.error('Выберите файл .doc или .docx');
      return;
    }
    const jobId = `upload:${uploadFile.name}`;
    setGemmaPreviewLoadingId(jobId);
    setGemmaPreview(null);
    setGemmaJob({
      title: uploadFile.name,
      stage: 'Загрузка файла и подготовка парсера',
      progress: 12,
      status: 'running',
    });
    const timer = window.setInterval(() => {
      setGemmaJob((job) => {
        if (!job || job.status !== 'running') return job;
        const nextProgress = Math.min(job.progress + 3, 86);
        return {
          ...job,
          progress: nextProgress,
          stage: nextProgress < 35 ? 'LibreOffice/mammoth извлекает текст' : 'Gemma извлекает требования из НПА',
        };
      });
    }, 1200);
    try {
      const form = new FormData();
      form.append('file', uploadFile);
      const response = await fetch('/api/admin/npa-gemma-preview', {
        method: 'POST',
        body: form,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Не удалось обработать загруженный НПА через Gemma');
      }
      rememberGemmaPreview(payload as NpaGemmaPreview);
      setGemmaJob({
        title: uploadFile.name,
        stage: 'Готово. Результат сохранен в истории предпросмотров',
        progress: 100,
        status: 'done',
      });
    } catch (error) {
      setGemmaJob({
        title: uploadFile.name,
        stage: 'Ошибка обработки',
        progress: 100,
        status: 'error',
        error: error instanceof Error ? error.message : 'Не удалось обработать загруженный НПА через Gemma',
      });
      toast.error(error instanceof Error ? error.message : 'Не удалось обработать загруженный НПА через Gemma');
    } finally {
      window.clearInterval(timer);
      setGemmaPreviewLoadingId(null);
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
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <CardTitle className="text-base">Правила комплектности</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Список свернут по умолчанию: раскрывайте только нужное правило и его пакет документов.
                      </p>
                    </div>
                    <Badge variant="outline">{rules.length} правил</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" className="gap-2">
                    {rules.map((rule) => {
                      const sources = getRuleSources(rule);
                      const primarySource = sources[0];
                      return (
                        <AccordionItem
                          key={rule.id}
                          value={rule.id}
                          className={`mb-2 rounded-xl border bg-background px-4 ${rule.active === false ? 'opacity-60' : ''}`}
                        >
                          <AccordionTrigger className="items-center gap-4 py-3 hover:no-underline">
                            <div className="grid w-full gap-2 pr-3 md:grid-cols-[1fr_auto] md:items-center">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="truncate text-sm font-semibold">{rule.name}</span>
                                  <Badge variant={rule.active === false ? 'outline' : 'secondary'}>
                                    {rule.active === false ? 'Выкл' : 'Вкл'}
                                  </Badge>
                                  <Badge variant="outline">{rule.requiredDocuments.length} док.</Badge>
                                  {sources.length > 0 && <Badge variant="outline">{sources.length} ист.</Badge>}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <span>{formatRuleConditions(rule)}</span>
                                  {primarySource?.sourceSection && <span>· {primarySource.sourceSection}</span>}
                                </div>
                              </div>
                              <div className="hidden flex-wrap justify-end gap-2 md:flex">
                                <Badge variant="outline">{rule.id}</Badge>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4">
                            <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
                              <div className="space-y-2">
                                {rule.requiredDocuments.map((req) => {
                                  const doc = documentTypes.find((d) => d.id === req.documentTypeId);
                                  return (
                                    <div
                                      key={req.documentTypeId}
                                      className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                                    >
                                      <div className="min-w-0">
                                        <p className="font-medium">{doc?.name || req.documentTypeId}</p>
                                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                          {req.alternativeDocumentTypeId && (
                                            <span>
                                              альт. {documentTypes.find((d) => d.id === req.alternativeDocumentTypeId)?.name}
                                            </span>
                                          )}
                                          {req.checks?.length ? <span>checks: {req.checks.join(', ')}</span> : null}
                                        </div>
                                      </div>
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
                                  );
                                })}
                              </div>
                              <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
                                <div className="flex flex-wrap gap-2">
                                  {primarySource?.sourceDocumentId && (
                                    <Button size="sm" variant="outline" asChild>
                                      <Link href={buildReferenceHref(primarySource)}>
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        Источник
                                      </Link>
                                    </Button>
                                  )}
                                  <Button size="sm" variant="secondary" onClick={() => setSourceRule(rule)}>
                                    Детали
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={rule.active === false ? 'secondary' : 'default'}
                                    onClick={() => toggleRuleActive(rule.id)}
                                  >
                                    {rule.active === false ? 'Включить' : 'Выключить'}
                                  </Button>
                                </div>
                                <RuleSourceStrip sources={sources} onOpenDetails={() => setSourceRule(rule)} />
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="docs" className="space-y-3">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                      <CardTitle className="text-base">Типы документов</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Создавайте новые типы документов, редактируйте форматы, проверки, источники и признаки обработки.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={handleResetDocumentTypes}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Сбросить типы
                      </Button>
                      <Button onClick={openCreateDocumentType}>
                        <Plus className="mr-2 h-4 w-4" />
                        Создать тип документа
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">{documentTypes.length} типов</Badge>
                  <Badge variant="outline">ЛС: {documentTypes.filter((doc) => doc.direction === 'LS').length}</Badge>
                  <Badge variant="outline">МИ: {documentTypes.filter((doc) => doc.direction === 'MI').length}</Badge>
                  <Badge variant="outline">Общие: {documentTypes.filter((doc) => doc.direction === 'both').length}</Badge>
                </CardContent>
              </Card>

              {selectedDocumentType ? (
                <DocumentTypeDetailPanel
                  documentType={selectedDocumentType}
                  documentTypes={documentTypes}
                  rules={rules}
                  onBack={() => setSelectedDocumentType(null)}
                  onEdit={openEditDocumentType}
                  onDelete={handleDeleteDocumentType}
                  onOpenRuleSource={setSourceRule}
                />
              ) : (
                documentTypes.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex w-full flex-col gap-4 rounded-lg border bg-card p-4 transition hover:border-primary/40 hover:bg-muted/30 xl:flex-row xl:items-center xl:justify-between"
                  >
                    <button type="button" onClick={() => setSelectedDocumentType(doc)} className="min-w-0 flex-1 text-left">
                      <p className="font-medium">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.description}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        checks: {(doc.checkIds || []).join(', ') || '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        extracted: {(doc.expectedExtractedFields || []).join(', ') || '—'}
                      </p>
                    </button>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                      <button type="button" onClick={() => setSelectedDocumentType(doc)} className="flex items-center gap-2">
                        <Badge variant="secondary">{doc.acceptedFormats.join(', ')}</Badge>
                        <Badge variant="outline">{doc.direction}</Badge>
                        {doc.needsOcr && <Badge variant="outline">OCR</Badge>}
                        {doc.isPhysicalSample && <Badge variant="outline">sample</Badge>}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <Button size="sm" variant="outline" onClick={() => openEditDocumentType(doc)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Изменить
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteDocumentType(doc)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Удалить
                      </Button>
                    </div>
                  </div>
                ))
              )}
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
              <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-background to-muted/40">
                <CardHeader>
                  <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                      <CardTitle className="text-base">Обработка НПА через Gemma</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Загрузите `.doc` или `.docx`, система извлечет пункты/подпункты и подготовит предпросмотр требований.
                      </p>
                    </div>
                    <Badge variant="secondary">DOC / DOCX</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-center">
                    <Input
                      type="file"
                      accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                    />
                    <Button
                      disabled={!uploadFile || !!gemmaPreviewLoadingId}
                      onClick={handleGemmaUpload}
                      className="xl:min-w-56"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      {gemmaPreviewLoadingId?.startsWith('upload:') ? 'Обработка...' : 'Загрузить и обработать'}
                    </Button>
                  </div>
                  {uploadFile && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{uploadFile.name}</Badge>
                      <span>{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Результаты предпросмотра сохраняются в браузере администратора. Запись в базу правил подключим отдельным шагом после согласования маппинга.
                  </p>
                </CardContent>
              </Card>

              {gemmaPreviews.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Последние предпросмотры Gemma</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {gemmaPreviews.map((preview) => (
                      <button
                        key={preview.previewId}
                        type="button"
                        onClick={() => {
                          setGemmaPreview(preview);
                          setGemmaJob({
                            title: preview.document.title,
                            stage: 'Результат загружен из истории',
                            progress: 100,
                            status: 'done',
                          });
                        }}
                        className="flex w-full flex-col gap-2 rounded-lg border bg-background p-3 text-left transition hover:border-primary/40 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{preview.document.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {preview.document.fileName} · {preview.summary.document_types} типов документов · {preview.summary.requirements} требований
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Badge variant="outline">{preview.sourceKind === 'upload' ? 'Загрузка' : 'Справочник'}</Badge>
                          <Badge variant="secondary">{preview.summary.area}</Badge>
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}

              {npas.map((npa) => {
                const referenceDocumentId = getNpaReferenceDocumentId(npa.id);
                return (
                <div key={npa.id} className="rounded-lg border bg-card p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{npa.name}</p>
                        <Badge variant="outline">{npa.direction}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {npa.number} от {npa.date}
                      </p>
                      {referenceDocumentId && (
                        <p className="mt-1 text-xs text-muted-foreground">Справочник: {referenceDocumentId}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {referenceDocumentId && (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/reference?doc=${referenceDocumentId}`}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Открыть
                          </Link>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!referenceDocumentId || gemmaPreviewLoadingId === referenceDocumentId}
                        onClick={() => referenceDocumentId && handleGemmaPreview(referenceDocumentId, npa.name)}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        {gemmaPreviewLoadingId === referenceDocumentId ? 'Обработка...' : 'Обработать через Gemma'}
                      </Button>
                    </div>
                  </div>
                </div>
                );
              })}
            </TabsContent>
          </Tabs>
          <RuleSourceDialog rule={sourceRule} documentTypes={documentTypes} onClose={() => setSourceRule(null)} />
          <DocumentTypeEditorDialog
            state={documentTypeEditor}
            onChange={setDocumentTypeEditor}
            onSave={handleSaveDocumentType}
            onClose={() => setDocumentTypeEditor(null)}
          />
          <NpaGemmaPreviewDialog
            job={gemmaJob}
            preview={gemmaPreview}
            documentTypes={documentTypes}
            onApplyMappings={handleApplyGemmaMappings}
            onClose={() => {
              setGemmaPreview(null);
              setGemmaJob(null);
            }}
          />
        </div>
      </main>
    </div>
  );
}

function DocumentTypeEditorDialog({
  state,
  onChange,
  onSave,
  onClose,
}: {
  state: DocumentTypeEditorState | null;
  onChange: (state: DocumentTypeEditorState | null) => void;
  onSave: (values: DocumentType) => void;
  onClose: () => void;
}) {
  const values = state?.values;
  const update = (patch: Partial<DocumentType>) => {
    if (!state) return;
    onChange({ ...state, values: { ...state.values, ...patch } });
  };

  return (
    <Dialog open={!!state} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[92vw] xl:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{state?.mode === 'edit' ? 'Редактировать тип документа' : 'Создать тип документа'}</DialogTitle>
          <DialogDescription>
            Тип документа используется в правилах комплектности, проверках и загрузке файлов заявителя.
          </DialogDescription>
        </DialogHeader>

        {values && (
          <div className="space-y-5">
            <div className="grid gap-4 xl:grid-cols-2">
              <AdminField label="ID типа документа" hint={state.mode === 'edit' ? 'ID существующего типа не меняем, чтобы не сломать правила.' : 'Например: doc-custom-smPC'}>
                <Input value={values.id} disabled={state.mode === 'edit'} onChange={(event) => update({ id: slugifyDocumentTypeId(event.target.value) })} />
              </AdminField>
              <AdminField label="Название">
                <Input value={values.name} onChange={(event) => update({ name: event.target.value })} />
              </AdminField>
            </div>

            <AdminField label="Описание">
              <Textarea
                value={values.description || ''}
                onChange={(event) => update({ description: event.target.value })}
                className="min-h-24"
              />
            </AdminField>

            <div className="grid gap-4 xl:grid-cols-3">
              <AdminField label="Направление">
                <Select value={values.direction} onValueChange={(direction) => update({ direction: direction as DocumentType['direction'] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Общий</SelectItem>
                    <SelectItem value="LS">ЛС</SelectItem>
                    <SelectItem value="MI">МИ</SelectItem>
                  </SelectContent>
                </Select>
              </AdminField>
              <AdminField label="Форматы" hint="Через запятую: pdf, docx, jpg">
                <Input
                  value={(values.acceptedFormats || []).join(', ')}
                  onChange={(event) => update({ acceptedFormats: parseListInput(event.target.value).map((item) => item.toLowerCase()) })}
                />
              </AdminField>
              <AdminField label="Языки" hint="Например: ru, kz">
                <Input
                  value={(values.requiredLanguages || []).join(', ')}
                  onChange={(event) => update({ requiredLanguages: parseListInput(event.target.value) })}
                />
              </AdminField>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <AdminField label="Checks" hint="ID проверок через запятую">
                <Textarea
                  value={(values.checkIds || []).join(', ')}
                  onChange={(event) => update({ checkIds: parseListInput(event.target.value) })}
                  className="min-h-28 font-mono text-xs"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Доступные checks: {checkDefinitions.map((check) => check.id).join(', ')}
                </p>
              </AdminField>
              <AdminField label="Извлекаемые поля" hint="tradeName, inn, shelfLife и т.п.">
                <Textarea
                  value={(values.expectedExtractedFields || []).join(', ')}
                  onChange={(event) => update({ expectedExtractedFields: parseListInput(event.target.value) })}
                  className="min-h-28 font-mono text-xs"
                />
              </AdminField>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <AdminField label="Ссылки на НПА" hint="Можно через строки или запятые">
                <Textarea
                  value={(values.npaReferences || []).join('\n')}
                  onChange={(event) => update({ npaReferences: parseListInput(event.target.value) })}
                  className="min-h-28"
                />
              </AdminField>
              <AdminField label="Пояснение обязательности">
                <Textarea
                  value={values.requirednessExplanation || ''}
                  onChange={(event) => update({ requirednessExplanation: event.target.value })}
                  className="min-h-28"
                />
              </AdminField>
            </div>

            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 xl:grid-cols-3">
              <AdminCheckbox label="Требуется OCR" checked={!!values.needsOcr} onChange={(checked) => update({ needsOcr: checked })} />
              <AdminCheckbox label="Физический образец" checked={!!values.isPhysicalSample} onChange={(checked) => update({ isPhysicalSample: checked })} />
              <AdminCheckbox label="Проверять шрифт" checked={!!values.canCheckFont} onChange={(checked) => update({ canCheckFont: checked })} />
              <AdminCheckbox label="Проверять срок действия" checked={!!values.canCheckExpiry} onChange={(checked) => update({ canCheckExpiry: checked })} />
              <AdminCheckbox label="Проверять подпись" checked={!!values.canCheckSignature} onChange={(checked) => update({ canCheckSignature: checked })} />
              <AdminCheckbox label="Проверять печать" checked={!!values.canCheckSeal} onChange={(checked) => update({ canCheckSeal: checked })} />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Отмена</Button>
              <Button onClick={() => onSave(values)}>
                {state.mode === 'edit' ? 'Сохранить изменения' : 'Создать тип документа'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdminField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function AdminCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4" />
      {label}
    </label>
  );
}

function DocumentTypeDetailPanel({
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
            <TabsTrigger value="imported">Gemma-требования</TabsTrigger>
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
              <EmptyAdminBlock text="Импортированных требований Gemma для этого типа документа пока нет." />
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

function NpaGemmaPreviewDialog({
  job,
  preview,
  documentTypes,
  onApplyMappings,
  onClose,
}: {
  job: GemmaJobState | null;
  preview: NpaGemmaPreview | null;
  documentTypes: DocumentType[];
  onApplyMappings: (preview: NpaGemmaPreview, mappings: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [documentMappings, setDocumentMappings] = useState<Record<string, string>>({});

  useEffect(() => {
    setDocumentMappings({});
  }, [preview?.previewId]);

  const mappedCount = Object.values(documentMappings).filter(Boolean).length;

  return (
    <Dialog open={!!job || !!preview} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-[94vw] xl:max-w-7xl">
        <DialogHeader>
          <DialogTitle>{job?.title || 'Предпросмотр обработки НПА через Gemma'}</DialogTitle>
          <DialogDescription>
            Результат пока не записывается в правила. Это экран проверки извлеченных типов документов, требований и параметров.
          </DialogDescription>
        </DialogHeader>

        {job && (
          <div className={`rounded-xl border p-4 ${job.status === 'error' ? 'border-destructive/40 bg-destructive/5' : 'bg-muted/20'}`}>
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">{job.stage}</p>
                {job.error && <p className="mt-1 text-sm text-destructive">{job.error}</p>}
              </div>
              <Badge variant={job.status === 'error' ? 'destructive' : job.status === 'done' ? 'secondary' : 'outline'}>
                {job.status === 'running' ? 'В процессе' : job.status === 'done' ? 'Готово' : 'Ошибка'}
              </Badge>
            </div>
            <Progress value={job.progress} className="h-2" />
          </div>
        )}

        {preview && (
          <div className="grid min-h-0 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="max-h-[68vh] overflow-y-auto rounded-xl border bg-muted/20 p-4">
              <div className="mb-4 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{preview.document.domain}</Badge>
                  <Badge variant="outline">{preview.document.id}</Badge>
                  <Badge variant="outline">{preview.document.sectionsTotal} блоков</Badge>
                  <Badge variant="outline">{preview.document.payloadChars.toLocaleString('ru-RU')} символов в Gemma</Badge>
                </div>
                <p className="font-medium">{preview.document.title}</p>
                <p className="text-xs text-muted-foreground">{preview.document.fileName}</p>
              </div>
              <div className="space-y-3">
                {preview.document.sampleSections.map((section) => (
                  <div key={section.id} className="rounded-lg border bg-background p-3">
                    <div className="mb-2 flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">{section.type || 'section'}</Badge>
                      {section.number && <Badge variant="outline">п. {section.number}</Badge>}
                    </div>
                    {section.title && <p className="text-sm font-medium">{section.title}</p>}
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-muted-foreground">{section.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="max-h-[68vh] overflow-y-auto rounded-xl border bg-background p-4">
              <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <PreviewMetric label="Область" value={preview.summary.area} />
                <PreviewMetric label="Типы документов" value={String(preview.summary.document_types)} />
                <PreviewMetric label="Требования" value={String(preview.summary.requirements)} />
                <PreviewMetric label="Параметры" value={String(preview.summary.applicant_parameters)} />
              </div>

              <Tabs defaultValue="documents" className="space-y-4">
                <TabsList className="flex h-auto flex-wrap justify-start gap-2">
                  <TabsTrigger value="documents">Типы документов</TabsTrigger>
                  <TabsTrigger value="requirements">Требования</TabsTrigger>
                  <TabsTrigger value="parameters">Параметры</TabsTrigger>
                  <TabsTrigger value="dependencies">Зависимости</TabsTrigger>
                  <TabsTrigger value="notes">Заметки</TabsTrigger>
                </TabsList>
                <TabsContent value="documents">
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">Сопоставление с нашими типами документов</p>
                        <p className="text-xs text-muted-foreground">
                          Выберите, к какому типу документа относится найденный Gemma блок, затем нажмите заливку.
                        </p>
                      </div>
                      <Button
                        disabled={!mappedCount}
                        onClick={() => preview && onApplyMappings(preview, documentMappings)}
                      >
                        Залить выбранное
                      </Button>
                    </div>
                    <GemmaDocumentTypeMappingList
                      items={preview.extraction.document_types}
                      requirements={preview.extraction.requirements}
                      documentTypes={documentTypes}
                      mappings={documentMappings}
                      onChange={(key, documentTypeId) =>
                        setDocumentMappings((current) => ({ ...current, [key]: documentTypeId }))
                      }
                    />
                  </div>
                </TabsContent>
                <TabsContent value="requirements">
                  <GemmaObjectList
                    items={preview.extraction.requirements}
                    emptyLabel="Gemma не нашла требования."
                    fields={[
                      ['document_code', 'Код документа'],
                      ['document_name', 'Документ'],
                      ['procedure', 'Процедура'],
                      ['check_type', 'Тип проверки'],
                      ['requirement_text', 'Требование'],
                      ['criticality', 'Критичность'],
                      ['applicability_condition', 'Условие'],
                      ['source_point', 'Пункт'],
                    ]}
                  />
                </TabsContent>
                <TabsContent value="parameters">
                  <GemmaObjectList
                    items={preview.extraction.applicant_parameters}
                    emptyLabel="Gemma не нашла параметры заявки."
                    fields={[
                      ['key', 'Ключ'],
                      ['label', 'Параметр'],
                      ['value_type', 'Тип значения'],
                      ['options', 'Варианты'],
                      ['why_needed', 'Зачем нужен'],
                      ['source_point', 'Пункт'],
                    ]}
                  />
                </TabsContent>
                <TabsContent value="dependencies">
                  <GemmaObjectList
                    items={preview.extraction.parameter_dependencies}
                    emptyLabel="Gemma не нашла зависимости параметров."
                    fields={[
                      ['conditions', 'Условия'],
                      ['logic_operator', 'Логика'],
                      ['target_kind', 'Цель'],
                      ['target_key', 'Ключ цели'],
                      ['effect_type', 'Эффект'],
                      ['effect_text', 'Описание эффекта'],
                      ['source_point', 'Пункт'],
                    ]}
                  />
                </TabsContent>
                <TabsContent value="notes" className="space-y-3">
                  {preview.extraction.quality_notes.length === 0 && <EmptyAdminBlock text="Заметок качества нет." />}
                  {preview.extraction.quality_notes.map((note, index) => (
                    <div key={`${note}-${index}`} className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                      {note}
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GemmaDocumentTypeMappingList({
  items,
  requirements,
  documentTypes,
  mappings,
  onChange,
}: {
  items: Record<string, unknown>[];
  requirements: Record<string, unknown>[];
  documentTypes: DocumentType[];
  mappings: Record<string, string>;
  onChange: (key: string, documentTypeId: string) => void;
}) {
  if (!items.length) return <EmptyAdminBlock text="Gemma не нашла типы документов." />;

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const key = getGemmaDocumentKey(item, index);
        const relatedRequirements = requirements.filter((requirement) => requirementBelongsToGemmaDocument(requirement, item));
        return (
          <div key={key} className="rounded-xl border bg-muted/20 p-4">
            <div className="grid gap-4 xl:grid-cols-[1fr_18rem]">
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-2">
                  {renderGemmaValue(item.code) && <Badge variant="secondary">{renderGemmaValue(item.code)}</Badge>}
                  {renderGemmaValue(item.procedure) && <Badge variant="outline">{renderGemmaValue(item.procedure)}</Badge>}
                  {renderGemmaValue(item.requiredness) && <Badge variant="outline">{renderGemmaValue(item.requiredness)}</Badge>}
                  <Badge variant="outline">{relatedRequirements.length} треб.</Badge>
                </div>
                <p className="font-medium">{renderGemmaValue(item.name) || `Тип документа ${index + 1}`}</p>
                {renderGemmaValue(item.applicability_condition) && (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Условие: </span>
                    {renderGemmaValue(item.applicability_condition)}
                  </p>
                )}
                {renderGemmaValue(item.source_point) && (
                  <p className="text-xs text-muted-foreground">Источник: {renderGemmaValue(item.source_point)}</p>
                )}
                {renderGemmaValue(item.quote) && (
                  <blockquote className="rounded-lg border-l-4 border-primary/50 bg-background p-3 text-sm text-muted-foreground">
                    {renderGemmaValue(item.quote)}
                  </blockquote>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">Наш тип документа</p>
                <Select
                  value={mappings[key] || '__none'}
                  onValueChange={(value) => onChange(key, value === '__none' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Не заливать</SelectItem>
                    {documentTypes.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {mappings[key] && (
                  <p className="text-xs text-muted-foreground">
                    Требования будут добавлены в выбранный тип документа.
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GemmaObjectList({
  items,
  fields,
  emptyLabel,
}: {
  items: Record<string, unknown>[];
  fields: Array<[string, string]>;
  emptyLabel: string;
}) {
  if (!items.length) return <EmptyAdminBlock text={emptyLabel} />;

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="rounded-xl border bg-muted/20 p-4">
          <div className="space-y-2 text-sm">
            {fields.map(([key, label]) => {
              const value = renderGemmaValue(item[key]);
              if (!value) return null;
              return (
                <p key={key}>
                  <span className="font-medium">{label}: </span>
                  <span className="text-muted-foreground">{value}</span>
                </p>
              );
            })}
          </div>
          {renderGemmaValue(item.quote) && (
            <blockquote className="mt-3 rounded-lg border-l-4 border-primary/50 bg-background p-3 text-sm text-muted-foreground">
              {renderGemmaValue(item.quote)}
            </blockquote>
          )}
        </div>
      ))}
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function EmptyAdminBlock({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{text}</div>;
}

function createBlankDocumentType(existing: DocumentType[]): DocumentType {
  const base = `doc-custom-${Date.now().toString(36)}`;
  let id = base;
  let index = 2;
  while (existing.some((doc) => doc.id === id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  return {
    id,
    name: '',
    description: '',
    acceptedFormats: ['pdf', 'docx'],
    direction: 'both',
    requiredLanguages: [],
    expectedExtractedFields: [],
    checkIds: ['required_document_presence_check', 'file_format_check'],
    npaReferences: [],
    importedRequirements: [],
    needsOcr: true,
    canCheckFont: true,
    canCheckExpiry: false,
    canCheckSignature: true,
    canCheckSeal: true,
    isPhysicalSample: false,
    requirednessExplanation: '',
  };
}

function cloneDocumentType(doc: DocumentType): DocumentType {
  return {
    ...doc,
    acceptedFormats: [...(doc.acceptedFormats || [])],
    requiredLanguages: [...(doc.requiredLanguages || [])],
    expectedExtractedFields: [...(doc.expectedExtractedFields || [])],
    checkIds: [...(doc.checkIds || [])],
    npaReferences: [...(doc.npaReferences || [])],
    importedRequirements: [...(doc.importedRequirements || [])],
  };
}

function normalizeDocumentType(doc: DocumentType): DocumentType {
  const acceptedFormats = uniqueList(doc.acceptedFormats || []).map((item) => item.toLowerCase());
  return {
    ...doc,
    id: slugifyDocumentTypeId(doc.id),
    name: doc.name.trim(),
    description: doc.description?.trim() || undefined,
    acceptedFormats,
    requiredLanguages: uniqueList(doc.requiredLanguages || []),
    expectedExtractedFields: uniqueList(doc.expectedExtractedFields || []),
    checkIds: uniqueList(doc.checkIds || []),
    npaReferences: uniqueList(doc.npaReferences || []),
    requirednessExplanation: doc.requirednessExplanation?.trim() || undefined,
    needsOcr: doc.needsOcr ?? acceptedFormats.some((format) => ['pdf', 'jpg', 'jpeg', 'png'].includes(format)),
    canCheckFont: doc.canCheckFont ?? acceptedFormats.some((format) => ['doc', 'docx'].includes(format)),
    canCheckSignature: doc.canCheckSignature ?? acceptedFormats.includes('pdf'),
    canCheckSeal: doc.canCheckSeal ?? acceptedFormats.some((format) => ['pdf', 'jpg', 'jpeg', 'png'].includes(format)),
  };
}

function countDocumentTypeRuleReferences(rules: Rule[], documentTypeId: string) {
  return rules.filter((rule) =>
    rule.requiredDocuments.some(
      (req) => req.documentTypeId === documentTypeId || req.alternativeDocumentTypeId === documentTypeId,
    ),
  ).length;
}

function parseListInput(value: string) {
  return uniqueList(value.split(/[\n,;]/));
}

function uniqueList(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function slugifyDocumentTypeId(value: string) {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned.startsWith('doc-') || !cleaned ? cleaned || 'doc-custom' : `doc-${cleaned}`;
}

function getGemmaDocumentKey(item: Record<string, unknown>, index: number) {
  const code = renderGemmaValue(item.code);
  const name = renderGemmaValue(item.name);
  return `${code || 'no-code'}::${name || `doc-${index}`}`;
}

function requirementBelongsToGemmaDocument(requirement: Record<string, unknown>, gemmaDoc: Record<string, unknown>) {
  const docCode = normalizeGemmaCompareValue(requirement.document_code);
  const gemmaCode = normalizeGemmaCompareValue(gemmaDoc.code);
  if (docCode && gemmaCode && docCode === gemmaCode) return true;

  const docName = normalizeGemmaCompareValue(requirement.document_name);
  const gemmaName = normalizeGemmaCompareValue(gemmaDoc.name);
  if (!docName || !gemmaName) return false;
  return docName.includes(gemmaName) || gemmaName.includes(docName);
}

function buildRequirementsFromGemma(
  preview: NpaGemmaPreview,
  gemmaDoc: Record<string, unknown>,
  requirements: Record<string, unknown>[],
  importedAt: string,
): DocumentTypeRequirement[] {
  const sourceDocumentCode = renderGemmaValue(gemmaDoc.code);
  const sourceDocumentName = renderGemmaValue(gemmaDoc.name);
  const rows = requirements.length
    ? requirements
    : [
        {
          document_code: sourceDocumentCode,
          document_name: sourceDocumentName,
          procedure: renderGemmaValue(gemmaDoc.procedure),
          requirement_text: [
            renderGemmaValue(gemmaDoc.requiredness),
            renderGemmaValue(gemmaDoc.applicability_condition),
          ].filter(Boolean).join(': '),
          source_point: renderGemmaValue(gemmaDoc.source_point),
          quote: renderGemmaValue(gemmaDoc.quote),
        },
      ];

  const result: DocumentTypeRequirement[] = [];
  rows.forEach((row, index) => {
    const requirementText = renderGemmaValue(row['requirement_text']) || renderGemmaValue(row['check_subject']);
    if (!requirementText) return;
    result.push({
        id: `gemma-${preview.previewId}-${sourceDocumentCode || sourceDocumentName || 'doc'}-${index}`,
        source: 'gemma' as const,
        previewId: preview.previewId,
        sourceDocumentCode: renderGemmaValue(row['document_code']) || sourceDocumentCode,
        sourceDocumentName: renderGemmaValue(row['document_name']) || sourceDocumentName,
        procedure: renderGemmaValue(row['procedure']),
        checkSubject: renderGemmaValue(row['check_subject']),
        checkType: renderGemmaValue(row['check_type']),
        requirementText,
        criticality: renderGemmaValue(row['criticality']),
        applicabilityCondition: renderGemmaValue(row['applicability_condition']),
        sourcePoint: renderGemmaValue(row['source_point']),
        quote: renderGemmaValue(row['quote']),
        importedAt,
    });
  });
  return result;
}

function mergeImportedRequirements(existing: DocumentTypeRequirement[], incoming: DocumentTypeRequirement[]) {
  const map = new Map<string, DocumentTypeRequirement>();
  for (const requirement of [...existing, ...incoming]) {
    const key = [
      requirement.sourceDocumentCode || '',
      requirement.sourceDocumentName || '',
      requirement.sourcePoint || '',
      requirement.requirementText,
    ].join('|');
    if (!map.has(key)) map.set(key, requirement);
  }
  return Array.from(map.values());
}

function buildGemmaSourceReference(preview: NpaGemmaPreview) {
  const act = preview.extraction.act || {};
  const actTitle = renderGemmaValue(act.title);
  const actNumber = renderGemmaValue(act.number);
  const actDate = renderGemmaValue(act.date);
  return ['Gemma', actTitle || preview.document.title, actNumber, actDate].filter(Boolean).join(' · ');
}

function normalizeGemmaCompareValue(value: unknown) {
  return renderGemmaValue(value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function compactGemmaPreview(preview: NpaGemmaPreview): NpaGemmaPreview {
  return {
    ...preview,
    document: {
      ...preview.document,
      sampleSections: preview.document.sampleSections.slice(0, 30).map((section) => ({
        ...section,
        text: section.text.slice(0, 350),
      })),
    },
  };
}

function findDocumentRequirement(rule: Rule, documentTypeId: string) {
  return rule.requiredDocuments.find(
    (req) => req.documentTypeId === documentTypeId || req.alternativeDocumentTypeId === documentTypeId,
  );
}

function formatRuleConditions(rule: Rule) {
  if (!rule.conditions.length) return 'всегда';
  return rule.conditions
    .map((condition) => {
      const param = parameters.find((item) => item.id === condition.parameterId);
      return `${param?.label || condition.parameterId} ${condition.operator} ${condition.value || ''}`.trim();
    })
    .join(' AND ');
}

function uniqueRuleSources(sources: RuleSource[]) {
  const map = new Map<string, RuleSource>();
  for (const source of sources) {
    const key = [
      source.npaId || '',
      source.sourceDocumentId || '',
      source.sourceSection || '',
      source.sourceQuote || '',
    ].join('|');
    if (!map.has(key)) map.set(key, source);
  }
  return Array.from(map.values());
}

function renderGemmaValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (Array.isArray(value)) return value.map(renderGemmaValue).filter(Boolean).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function RuleSourceSummary({ source }: { source?: RuleSource }) {
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

function RuleSourceStrip({ sources, onOpenDetails }: { sources: RuleSource[]; onOpenDetails: () => void }) {
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

function buildReferenceHref(source: RuleSource) {
  const params = new URLSearchParams();
  if (source.sourceDocumentId) params.set('doc', source.sourceDocumentId);
  const query = source.sourceQuote || source.sourceSection || '';
  if (query) params.set('q', query);
  const base = `/reference${params.toString() ? `?${params.toString()}` : ''}`;
  return source.sourceAnchor ? `${base}#${source.sourceAnchor}` : base;
}

function RuleSourceDialog({
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
