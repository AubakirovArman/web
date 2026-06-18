import { Application } from '@/lib/types';

export function getStringValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.join(', ');
  return value || '';
}

export function parseJson<T>(value: string, fallback: T): T {
  try {
    const parsed = JSON.parse(value || '');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function formatUnitLabel(unit: string): string {
  const labels: Record<string, string> = {
    mg: 'мг',
    g: 'г',
    mcg: 'мкг',
    ml: 'мл',
    percent: '%',
    iu: 'МЕ',
    'mg-ml': 'мг/мл',
    hours: 'часов',
    days: 'дней',
    months: 'месяцев',
  };
  return labels[unit] || unit;
}

export function buildDosageValue(values: Application['values']): string {
  const amount = getStringValue(values['param-dosage-amount']).trim();
  const unit = getStringValue(values['param-dosage-unit']).trim();
  return [amount, unit ? formatUnitLabel(unit) : ''].filter(Boolean).join(' ');
}

export function getDisplayTradeName(values: Application['values']): string {
  return (
    getStringValue(values['param-trade-name-ru']).trim() ||
    getStringValue(values['param-trade-name-kz']).trim() ||
    getStringValue(values['param-trade-name-en']).trim()
  );
}
