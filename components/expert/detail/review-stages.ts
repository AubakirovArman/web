import { DocumentReviewRow, ReviewCheckCell, ReviewStatus } from '@/components/expert/detail/review-types';

export type ExpertiseStage = 'primary' | 'specialized';

export const STAGE_LABELS: Record<ExpertiseStage, string> = {
  primary: 'Первичная экспертиза',
  specialized: 'Специализированная',
};

export const STAGE_HINTS: Record<ExpertiseStage, string> = {
  primary: 'Формальная проверка по памятке: тип документа, название ЛС, условия предоставления, комплектность и наличие.',
  specialized: 'Содержательная (научная) оценка требований по существу.',
};

// Содержательная проверка из НПА (глубокая оценка Gemma) либо fallback-проверка
export function isContentCheck(check: Pick<ReviewCheckCell, 'id'>): boolean {
  return check.id.startsWith('npa-requirement-') || check.id.startsWith('fallback-gemma-');
}

// Точные маркеры ФОРМАЛЬНОГО (первичного) уровня: сверки-консистентности, применимость,
// наличие требуемой документации, формат/заверение. Подобраны так, чтобы НЕ сметать в primary
// содержательные требования (которые часто содержат «соответствует», «состав» и т.п.).
const PRIMARY_MARKERS = [
  'сверить', 'сверк',
  'соответствует информации', 'соответствует данным', 'соответствие данным',
  'соответствовать данным', 'соответствовать информации',
  'наличие требуемой документации', 'требуемая документация',
  'условия/применимость', 'применимость из памятки',
  'формат файла', 'формат макета', 'формате', 'масштаб 1:1',
  'нотариальн', 'апостил', 'заверен', 'количество страниц', 'все страниц', 'все части',
];

/**
 * Этап проверки:
 *  - технические/комплектность/формат → primary;
 *  - содержательные NPA-проверки формального характера (сверки/применимость/наличие/формат) → primary;
 *  - содержательная оценка требования по существу → specialized.
 */
export function checkStage(check: ReviewCheckCell): ExpertiseStage {
  if (!isContentCheck(check)) return 'primary';
  const text = [check.name, check.description, check.remark].filter(Boolean).join(' ').toLowerCase();
  if (PRIMARY_MARKERS.some((k) => text.includes(k))) return 'primary';
  return 'specialized';
}

export function checksForStage(row: DocumentReviewRow, stage: ExpertiseStage): ReviewCheckCell[] {
  return row.checks.filter((check) => checkStage(check) === stage);
}

// Итог по набору проверок (failed > warning > passed > skipped)
export function overallForChecks(checks: ReviewCheckCell[]): ReviewStatus {
  if (checks.some((c) => c.status === 'failed')) return 'failed';
  if (checks.some((c) => c.status === 'warning')) return 'warning';
  if (checks.some((c) => c.status === 'passed')) return 'passed';
  return 'skipped';
}
