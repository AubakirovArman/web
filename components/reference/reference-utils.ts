import type { ExperimentStatus, IntelligenceItem, ReferenceExperimentSection } from './reference-types';

export const statusLabels: Record<ExperimentStatus, string> = {
  processed: 'Обработан',
  pending: 'Ожидает автоматической проверки',
  error: 'Ошибка',
};

export const kindLabels: Record<string, string> = {
  order: 'Приказ',
  decision: 'Решение',
  agreement: 'Соглашение',
  code: 'Кодекс',
  form: 'Форма',
  classifier: 'Классификатор',
  dossier: 'Досье',
  other: 'Другое',
};

export function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (Array.isArray(value)) return value.map(renderValue).filter(Boolean).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function findSectionHighlights(section: ReferenceExperimentSection, highlights: IntelligenceItem[]) {
  return highlights.filter((highlight) => {
    const quote = renderValue(highlight.quote).toLowerCase();
    const sourcePoint = renderValue(highlight.source_point).toLowerCase();
    const sectionHint = renderValue(highlight.section_hint).toLowerCase();
    const haystack = [section.title, section.headingNumber, section.text].filter(Boolean).join(' ').toLowerCase();
    return Boolean(
      (quote && haystack.includes(quote.slice(0, Math.min(80, quote.length)))) ||
      (sourcePoint && haystack.includes(sourcePoint)) ||
      (sectionHint && haystack.includes(sectionHint)),
    );
  });
}
