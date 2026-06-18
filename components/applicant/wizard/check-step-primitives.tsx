'use client';

import { CheckCircle2, XCircle } from 'lucide-react';

export function CompactMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: 'critical' | 'serious' | 'warning' | 'neutral';
}) {
  const styles = {
    critical: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-100',
    serious: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-100',
    warning: 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-900/60 dark:bg-yellow-950/20 dark:text-yellow-100',
    neutral: 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-950/20 dark:text-slate-100',
  };

  return (
    <div className={`rounded-xl border p-4 ${styles[tone]}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs font-medium uppercase tracking-wide opacity-75">{label}</div>
    </div>
  );
}

export function StatusPill({ ok, okText, failText }: { ok: boolean; okText: string; failText: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        ok
          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100'
          : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-100'
      }`}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {ok ? okText : failText}
    </span>
  );
}
