'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, ClipboardCopy, RotateCcw, Save, ShieldCheck, ShieldX, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import type { Application, ExpertConclusion, ExpertVerdict } from '@/lib/types';

const VERDICTS: Array<{ key: ExpertVerdict; label: string; hint: string; className: string; icon: typeof ThumbsUp }> = [
  { key: 'approve', label: 'Принять', hint: 'замечаний нет / устранены', className: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', icon: ThumbsUp },
  { key: 'revision', label: 'На доработку', hint: 'есть замечания к устранению', className: 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300', icon: RotateCcw },
  { key: 'reject', label: 'Отказать', hint: 'критические несоответствия', className: 'border-destructive/50 bg-destructive/10 text-destructive', icon: ThumbsDown },
];
const VERDICT_LABEL: Record<ExpertVerdict, string> = { approve: 'Принять', revision: 'На доработку', reject: 'Отказать' };

export function ExpertConclusionPanel({
  app,
  onSave,
}: {
  app: Application;
  onSave: (conclusion: ExpertConclusion | null) => void;
}) {
  const existing = app.expertConclusion;
  const [verdict, setVerdict] = useState<ExpertVerdict | null>(existing?.verdict ?? null);
  const [note, setNote] = useState(existing?.note ?? '');

  // Агрегация: авто-замечания по тяжести + решения эксперта по проверкам.
  const agg = useMemo(() => {
    const decisions = Object.entries(app.expertCheckDecisions || {});
    const failedDecisions = decisions.filter(([, d]) => d.status === 'failed');
    const passedDecisions = decisions.filter(([, d]) => d.status === 'passed');
    const bySeverity = { critical: 0, serious: 0, warning: 0, unknown: 0 } as Record<string, number>;
    for (const f of app.findings || []) bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
    // Подтверждённые экспертом несоответствия (решение «не согласен / дефект»).
    const confirmed = failedDecisions.map(([key, d]) => ({ key, comment: d.comment || '' }));
    return { failedCount: failedDecisions.length, passedCount: passedDecisions.length, bySeverity, confirmed };
  }, [app.expertCheckDecisions, app.findings]);

  const dirty = verdict !== (existing?.verdict ?? null) || note !== (existing?.note ?? '');

  const save = () => {
    if (!verdict) {
      toast.error('Выберите вердикт');
      return;
    }
    onSave({ verdict, note: note.trim() || undefined, decidedAt: new Date().toISOString() });
    toast.success('Заключение сохранено');
  };

  const copyText = async () => {
    const lines: string[] = [];
    lines.push('ЗАКЛЮЧЕНИЕ ЭКСПЕРТА');
    if (verdict) lines.push(`Вердикт: ${VERDICT_LABEL[verdict]}`);
    if (note.trim()) lines.push(`Примечание: ${note.trim()}`);
    lines.push('');
    lines.push(`Автопроверка: критических ${agg.bySeverity.critical}, серьёзных ${agg.bySeverity.serious}, предупреждений ${agg.bySeverity.warning}.`);
    lines.push(`Решения эксперта: подтверждено дефектов ${agg.failedCount}, принято ${agg.passedCount}.`);
    if (agg.confirmed.length) {
      lines.push('');
      lines.push('Подтверждённые несоответствия:');
      agg.confirmed.forEach((c, i) => lines.push(`${i + 1}. ${c.comment || c.key}`));
    }
    if ((app.findings || []).length) {
      lines.push('');
      lines.push('Замечания автопроверки:');
      app.findings.forEach((f, i) => lines.push(`${i + 1}. [${f.severity}] ${f.title}${f.recommendation ? ` — ${f.recommendation}` : ''}`));
    }
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Заключение скопировано');
    } catch {
      toast.success('Заключение сформировано');
    }
  };

  return (
    <div className="mt-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Итоговое заключение эксперта</h2>
        </div>
        {existing && (
          <Badge variant="outline" className={VERDICTS.find((v) => v.key === existing.verdict)?.className}>
            Текущий вердикт: {VERDICT_LABEL[existing.verdict]}
            {existing.decidedAt ? ` · ${new Date(existing.decidedAt).toLocaleDateString('ru-RU')}` : ''}
          </Badge>
        )}
      </div>

      {/* Агрегаты */}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1">Критических: <b>{agg.bySeverity.critical}</b></span>
        <span className="rounded-md border border-amber-500/40 bg-amber-500/5 px-2 py-1">Серьёзных: <b>{agg.bySeverity.serious}</b></span>
        <span className="rounded-md border px-2 py-1">Предупреждений: <b>{agg.bySeverity.warning}</b></span>
        <span className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1"><ShieldX className="h-3.5 w-3.5 text-destructive" />Подтверждено дефектов: <b>{agg.failedCount}</b></span>
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 px-2 py-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />Принято экспертом: <b>{agg.passedCount}</b></span>
      </div>

      {/* Подтверждённые несоответствия */}
      {agg.confirmed.length > 0 && (
        <div className="mt-3 rounded-lg border bg-muted/20 p-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Подтверждённые экспертом несоответствия ({agg.confirmed.length})</p>
          <ul className="space-y-1 text-sm">
            {agg.confirmed.map((c, i) => (
              <li key={c.key} className="flex gap-2"><span className="text-destructive">{i + 1}.</span><span>{c.comment || <span className="text-muted-foreground">без комментария</span>}</span></li>
            ))}
          </ul>
        </div>
      )}

      {/* Вердикт */}
      <div className="mt-4">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Вердикт</p>
        <div className="flex flex-wrap gap-2">
          {VERDICTS.map((v) => {
            const Icon = v.icon;
            const active = verdict === v.key;
            return (
              <button key={v.key} type="button" onClick={() => setVerdict(v.key)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${active ? v.className : 'hover:bg-accent'}`}>
                <Icon className="h-4 w-4" />
                <span>{v.label}</span>
                <span className="hidden text-[11px] font-normal text-muted-foreground sm:inline">· {v.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-3 text-sm"
        placeholder="Примечание к заключению (обоснование вердикта, что доработать)…" />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save} disabled={!verdict || !dirty}><Save className="mr-1 h-4 w-4" />Сохранить заключение</Button>
        <Button size="sm" variant="outline" onClick={copyText}><ClipboardCopy className="mr-1 h-4 w-4" />Скопировать заключение</Button>
        {existing && (
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { onSave(null); setVerdict(null); setNote(''); toast.success('Заключение снято'); }}>
            Снять заключение
          </Button>
        )}
      </div>
    </div>
  );
}
