'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileSearch, Loader2, ShieldAlert, ShieldCheck, Stamp, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Severity = 'critical' | 'high' | 'medium' | 'low';
const sevClass: Record<Severity, string> = {
  critical: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  high: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
  medium: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  low: 'border-muted bg-muted/40 text-muted-foreground',
};
const riskClass: Record<string, string> = {
  высокий: 'bg-red-500/15 text-red-700 border-red-500/40 dark:text-red-300',
  средний: 'bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-300',
  низкий: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-300',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">{children}</CardContent>
    </Card>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2 border-b py-1 last:border-b-0">
      <span className="w-44 shrink-0 text-xs text-muted-foreground">{k}</span>
      <span className="min-w-0 flex-1 break-words">{v || '—'}</span>
    </div>
  );
}

export default function AdminTestsPage() {
  const pdfRef = useRef<HTMLInputElement>(null);
  const stampRef = useRef<HTMLInputElement>(null);
  const [useGemma, setUseGemma] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [stampResult, setStampResult] = useState<any>(null);

  const analyze = async () => {
    const file = pdfRef.current?.files?.[0];
    if (!file) return toast.error('Выберите PDF-файл');
    setAnalyzing(true);
    setReport(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('use_gemma', String(useGemma));
      const res = await fetch('/api/admin/tests/pdf-forensics', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка анализа');
      setReport(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setAnalyzing(false);
    }
  };

  const compare = async () => {
    const file = pdfRef.current?.files?.[0];
    const stamp = stampRef.current?.files?.[0];
    if (!file) return toast.error('Сначала выберите PDF выше');
    if (!stamp) return toast.error('Выберите эталон печати (изображение)');
    setComparing(true);
    setStampResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('stamp', stamp);
      fd.append('use_gemma', String(useGemma));
      const res = await fetch('/api/admin/tests/compare-stamp', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка сравнения');
      setStampResult(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setComparing(false);
    }
  };

  const m = report?.metadata;
  const susImages = (report?.images || []).filter((i: any) => i.suspicious);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSearch className="h-5 w-5" /> Проверка подлинности PDF (полигон)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Загрузите PDF — извлечём метаданные, историю правок, цифровую подпись, вставленные элементы, признаки
            скана и подделки. Это индикаторы: 100% гарантию даёт только криптографическая ЭЦП.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={pdfRef}
              type="file"
              accept="application/pdf,.pdf"
              className="text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useGemma} onChange={(e) => setUseGemma(e.target.checked)} />
              Визуальный анализ через Gemma-4
            </label>
            <Button onClick={analyze} disabled={analyzing}>
              {analyzing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
              Анализировать
            </Button>
          </div>
        </CardContent>
      </Card>

      {report && (
        <>
          {/* Сводка риска */}
          <Card className={`border ${riskClass[report.risk?.level] || ''}`}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="flex items-center gap-3">
                {report.risk?.level === 'низкий' ? <ShieldCheck className="h-8 w-8" /> : <ShieldAlert className="h-8 w-8" />}
                <div>
                  <div className="text-lg font-semibold">Риск манипуляций: {report.risk?.level} ({report.risk?.score}/100)</div>
                  <div className="text-sm opacity-80">
                    {report.filename} · {report.page_count} стр · {(report.size_bytes / 1024).toFixed(0)} КБ · PDF {report.structure?.pdf_version}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Сигналы */}
          <Section title={`Сигналы (${report.risk?.signals?.length || 0})`}>
            <div className="space-y-2">
              {(report.risk?.signals || []).map((s: any, i: number) => (
                <div key={i} className={`rounded-lg border p-2 ${sevClass[s.severity as Severity] || ''}`}>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">{s.severity}</Badge>
                    <span className="font-medium">{s.label}</span>
                  </div>
                  <div className="mt-1 text-xs opacity-90">{s.detail}</div>
                </div>
              ))}
              {!report.risk?.signals?.length && <div className="text-muted-foreground">Сигналов не найдено.</div>}
            </div>
          </Section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Метаданные и происхождение">
              <KV k="Заголовок" v={m?.info?.title} />
              <KV k="Автор" v={m?.info?.author} />
              <KV k="Создан в (Creator)" v={<span>{m?.info?.creator} <Badge variant="outline" className="ml-1 text-[10px]">{m?.creator_class}</Badge></span>} />
              <KV k="Producer" v={<span>{m?.info?.producer} <Badge variant="outline" className="ml-1 text-[10px]">{m?.producer_class}</Badge></span>} />
              <KV k="Дата создания" v={m?.creation_date} />
              <KV k="Дата изменения" v={m?.modification_date} />
              {m?.anomalies?.map((a: string, i: number) => (
                <div key={i} className="mt-1 rounded bg-red-500/10 px-2 py-1 text-xs text-red-700 dark:text-red-300">⚠ {a}</div>
              ))}
            </Section>

            <Section title="Структура и правки">
              <KV k="Версия PDF" v={report.structure?.pdf_version} />
              <KV k="Инкрементальных правок" v={String(report.structure?.incremental_updates)} />
              <KV k="Менялся после создания" v={report.structure?.modified_after_creation ? 'Да' : 'Нет'} />
              <KV k="Линеаризован" v={report.structure?.linearized ? 'Да' : 'Нет'} />
              <KV k="Зашифрован" v={report.encrypted ? 'Да' : 'Нет'} />
              <KV k="Скан-документ" v={report.scanned?.is_scanned ? `Да (${report.scanned.scanned_pages}/${report.scanned.total_pages} стр)` : 'Нет'} />
            </Section>

            <Section title="Цифровая подпись (ЭЦП)">
              <div className={`rounded-lg border p-2 ${report.signatures?.has_digital_signature ? sevClass.low : sevClass.medium}`}>
                <div className="font-medium">
                  {report.signatures?.has_digital_signature ? '✓ Найдена криптографическая ЭЦП' : '✗ ЭЦП отсутствует'}
                </div>
                <div className="mt-1 text-xs">{report.signatures?.note}</div>
                {report.signatures?.signer && <div className="mt-1 text-xs">Подписант: {report.signatures.signer}</div>}
              </div>
            </Section>

            <Section title="Шрифты">
              <div className="flex flex-wrap gap-1.5">
                {(report.fonts || []).map((f: any, i: number) => (
                  <Badge key={i} variant={f.embedded ? 'secondary' : 'outline'} className="text-[10px]">
                    {f.name}{!f.embedded && ' (не встроен)'}
                  </Badge>
                ))}
                {!report.fonts?.length && <span className="text-muted-foreground">—</span>}
              </div>
            </Section>
          </div>

          <Section title={`Изображения и вставки (${report.images?.length || 0}, подозрительных: ${susImages.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-1 pr-2">Стр</th><th className="pr-2">Размер</th><th className="pr-2">DPI</th>
                    <th className="pr-2">Формат</th><th className="pr-2">Альфа</th><th className="pr-2">Покрытие</th><th>Признаки</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.images || []).map((img: any, i: number) => (
                    <tr key={i} className={`border-b last:border-b-0 ${img.suspicious ? 'bg-red-500/5' : ''}`}>
                      <td className="py-1 pr-2">{img.page}</td>
                      <td className="pr-2">{img.width}×{img.height}</td>
                      <td className="pr-2">{img.dpi || '—'}</td>
                      <td className="pr-2">{img.format || '—'}</td>
                      <td className="pr-2">{img.has_alpha ? 'да' : '—'}</td>
                      <td className="pr-2">{(img.coverage * 100).toFixed(1)}%</td>
                      <td className="text-red-700 dark:text-red-300">{(img.reasons || []).join('; ') || '—'}</td>
                    </tr>
                  ))}
                  {!report.images?.length && <tr><td colSpan={7} className="py-3 text-center text-muted-foreground">Изображений нет.</td></tr>}
                </tbody>
              </table>
            </div>
          </Section>

          {report.gemma_visual && (
            <Section title="Визуальный анализ (Gemma-4)">
              <div className="whitespace-pre-wrap text-sm">{report.gemma_visual}</div>
            </Section>
          )}

          {/* Сравнение печати */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm"><Stamp className="h-4 w-4" /> Сравнение печати с эталоном</CardTitle>
              <p className="text-xs text-muted-foreground">Загрузите эталон печати (картинка) — найдём её в PDF выше и сравним (CV + Gemma-4).</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <input ref={stampRef} type="file" accept="image/*"
                  className="text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5 file:text-sm" />
                <Button variant="outline" onClick={compare} disabled={comparing}>
                  {comparing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Stamp className="mr-1 h-4 w-4" />}
                  Сравнить печать
                </Button>
              </div>
              {stampResult && (
                <div className="space-y-2 text-sm">
                  <KV k="CV-вердикт" v={<span>{stampResult.cv_verdict}{stampResult.best_match ? ` (лучшая стр. ${stampResult.best_match.page}, сходство ${stampResult.best_match.cv_similarity})` : ''}</span>} />
                  {stampResult.gemma_verdict && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">Вердикт Gemma-4:</div>
                      <div className="mt-1 whitespace-pre-wrap rounded-lg border bg-muted/30 p-2 text-sm">{stampResult.gemma_verdict}</div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
