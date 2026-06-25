import { DocumentReviewRow, ReviewCheckCell, ReviewStatus } from '@/components/expert/detail/review-types';
import stageMapData from '@/lib/data/requirement-stage-map.json';

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

// ---- Достоверная карта этапов (из аудита НПА, подтверждена слепой панелью судей) ----
// Ключ — нормализованный текст требования. lab сворачивается в specialized (в UI два этапа).
const STAGE_BY_TEXT: Record<string, string> = (stageMapData as { byText?: Record<string, string> }).byText || {};

function normRequirement(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Текст требования вытаскиваем так же, как он кладётся в description в buildCheckCells:
// requirementText идёт первым, далее служебные блоки «Условие:/Автоматическая проверка:/...».
function extractRequirementText(check: ReviewCheckCell): string {
  return String(check.description || check.name || '')
    .split('\nАвтоматическая проверка:')[0]
    .split('\nКомментарий:')[0]
    .split('\nОснование:')[0]
    .split('\nЦитата НПА:')[0]
    .split('\nУсловие:')[0];
}

// Возвращает этап из достоверной карты или null, если требование в карте не найдено.
function mappedStage(check: ReviewCheckCell): ExpertiseStage | null {
  const key = normRequirement(extractRequirementText(check));
  let stage = key ? STAGE_BY_TEXT[key] : undefined;

  // Запасной ключ: текстовая часть имени после «— » (в UI обрезается до 120 символов),
  // ищем уникальное префиксное совпадение по карте.
  if (!stage) {
    const namePart = normRequirement(String(check.name || '').split('—').slice(1).join('—'));
    if (namePart.length >= 40) {
      const matches = Object.keys(STAGE_BY_TEXT).filter((k) => k.startsWith(namePart));
      if (matches.length === 1) stage = STAGE_BY_TEXT[matches[0]];
    }
  }

  if (!stage) return null;
  return stage === 'primary' ? 'primary' : 'specialized'; // lab + specialized_* → specialized
}

// Маркеры ФОРМАЛЬНОГО (первичного) уровня — ЗАПАСНАЯ эвристика для требований,
// которых нет в достоверной карте (например МИ или новые правила).
// Слепая панель подтвердила: «наличие/представлено/указано/есть ли» = первичный этап.
const PRESENCE_MARKERS = [
  'наличие', 'представлен', 'указан', 'есть ли', 'есть описание', 'приведен',
  'найти в заявлении', 'перечислен', 'приложен', 'комплектност', 'заполнен',
];
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
 *  - содержательные проверки: сначала берём ДОСТОВЕРНУЮ метку из аудита по тексту требования;
 *    если требования нет в карте — запасная эвристика (наличие/формат/сверки → primary, иначе specialized).
 */
export function checkStage(check: ReviewCheckCell): ExpertiseStage {
  if (!isContentCheck(check)) return 'primary';

  // 1) Достоверная классификация из аудита (приоритет).
  const mapped = mappedStage(check);
  if (mapped) return mapped;

  // 2) Запасная эвристика по ключевым словам.
  const text = [check.name, check.description, check.remark].filter(Boolean).join(' ').toLowerCase();
  if (PRESENCE_MARKERS.some((k) => text.includes(k))) return 'primary';
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
