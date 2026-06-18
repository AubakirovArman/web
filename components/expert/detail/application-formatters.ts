import { Application } from '@/lib/types';
import { productTypeLabels } from '@/lib/data/seed';
import { labelFor } from '@/components/expert/detail/condition-formatters';

export function displayApplicationTitle(app: Application): string {
  return (
    stringValue(app.values['param-trade-name-ru']) ||
    stringValue(app.values['param-trade-name-kz']) ||
    stringValue(app.values['param-trade-name-en']) ||
    stringValue(app.values['param-trade-name']) ||
    stringValue(app.values['param-mi-name-ru']) ||
    'Заявка'
  );
}

export function stringValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.join(', ');
  return value || '';
}

export function parseJsonValue<T>(value: string | string[] | undefined, fallback: T): T {
  try {
    return JSON.parse(stringValue(value) || '') ?? fallback;
  } catch {
    return fallback;
  }
}

export function formatLanguageTriple(values: Application['values'], prefix: string): string {
  const kz = stringValue(values[`${prefix}-kz`]);
  const ru = stringValue(values[`${prefix}-ru`]);
  const en = stringValue(values[`${prefix}-en`]);
  return [
    kz ? `каз.: ${kz}` : '',
    ru ? `рус.: ${ru}` : '',
    en ? `англ.: ${en}` : '',
  ].filter(Boolean).join(' · ');
}

export function unitLabel(unit: string): string {
  const labels: Record<string, string> = {
    mg: 'мг',
    g: 'г',
    mcg: 'мкг',
    ml: 'мл',
    l: 'л',
    percent: '%',
    iu: 'МЕ',
    'mg-ml': 'мг/мл',
    tablets: 'таблетки',
    capsules: 'капсулы',
    doses: 'дозы',
    pcs: 'шт.',
    hours: 'часов',
    days: 'дней',
    months: 'месяцев',
  };
  return labels[unit] || unit;
}

export function countryLabel(value: string | undefined): string {
  const labels: Record<string, string> = {
    KZ: 'Казахстан',
    RU: 'Россия',
    BY: 'Беларусь',
    AM: 'Армения',
    KG: 'Кыргызстан',
    UZ: 'Узбекистан',
    HU: 'Венгрия',
    other: 'Другая страна',
  };
  return value ? labels[value] || value : '—';
}

export function yesNo(value: string | string[] | undefined): string {
  return stringValue(value) === 'yes' ? 'Да' : 'Нет';
}

export function formatOrphanStatus(values: Application['values']): string {
  if (stringValue(values['param-orphan-status']) !== 'yes') return 'Нет';
  return [
    `статус: ${labelFor('param-orphan-status-state', values['param-orphan-status-state']) || '—'}`,
    stringValue(values['param-orphan-assigned-date']) ? `дата: ${stringValue(values['param-orphan-assigned-date'])}` : '',
    stringValue(values['param-orphan-registration-number']) ? `РУ: ${stringValue(values['param-orphan-registration-number'])}` : '',
    stringValue(values['param-orphan-refusal-flag']) === 'yes' ? `отказ/отзыв: ${stringValue(values['param-orphan-refusal-date']) || 'дата не указана'}` : '',
    stringValue(values['param-orphan-decision-number']) ? `решение: ${stringValue(values['param-orphan-decision-number'])}` : '',
    stringValue(values['param-orphan-withdrawal-date']) ? `отозвано: ${stringValue(values['param-orphan-withdrawal-date'])}` : '',
  ].filter(Boolean).join(' · ');
}

export function formatDosage(values: Application['values']): string {
  const amount = stringValue(values['param-dosage-amount']);
  const unit = stringValue(values['param-dosage-unit']);
  return [amount, unit ? unitLabel(unit) : ''].filter(Boolean).join(' ') || stringValue(values['param-dosage']);
}

export function formatAtc(values: Application['values']): string {
  if (stringValue(values['param-atc-enabled']) === 'no') return 'Не указана';
  return [
    stringValue(values['param-atc-code']),
    stringValue(values['param-atc-name-kz']) ? `каз.: ${stringValue(values['param-atc-name-kz'])}` : '',
    stringValue(values['param-atc-name-ru']) ? `рус.: ${stringValue(values['param-atc-name-ru'])}` : stringValue(values['param-atc-name']),
  ].filter(Boolean).join(' · ');
}

export function formatRoutes(value: string | string[] | undefined): string {
  const labels: Record<string, string> = {
    oral: 'Перорально',
    parenteral: 'Парентерально',
    topical: 'Местно',
    inhalation: 'Ингаляционно',
    intravenous: 'Внутривенно',
    intramuscular: 'Внутримышечно',
    subcutaneous: 'Подкожно',
  };
  const raw = stringValue(value);
  const routes = parseJsonValue<string[]>(value, raw ? [raw] : []);
  return routes.map((route) => labels[route] || route).join(', ');
}

export function formatPackaging(value: string | string[] | undefined): string {
  const raw = stringValue(value);
  const rows = parseJsonValue<Array<{ name?: string; primary?: string; fillVolume?: string; unit?: string; unitCount?: string; description?: string; mockup?: string }>>(value, []);
  if (!rows.length) return raw;
  return rows.map((row, index) => {
    const parts = [
      row.name || `Упаковка ${index + 1}`,
      row.primary ? `первичная: ${row.primary === 'yes' ? 'да' : 'нет'}` : '',
      [row.fillVolume, row.unit ? unitLabel(row.unit) : ''].filter(Boolean).join(' '),
      row.unitCount ? `кол-во: ${row.unitCount}` : '',
      row.description || '',
      row.mockup ? `макет: ${row.mockup}` : '',
    ].filter(Boolean);
    return parts.join(' · ');
  }).join('; ');
}

export function formatForeignRegistrations(value: string | string[] | undefined): string {
  const raw = stringValue(value);
  const rows = parseJsonValue<Array<{ country?: string; certificateNumber?: string; issueDate?: string; expiryDate?: string; unlimited?: string }>>(value, []);
  if (!rows.length) return raw;
  return rows.map((row) => {
    const parts = [
      countryLabel(row.country),
      row.certificateNumber ? `РУ: ${row.certificateNumber}` : '',
      row.issueDate ? `выдано: ${row.issueDate}` : '',
      row.unlimited === 'yes' ? 'бессрочно' : row.expiryDate ? `действует до: ${row.expiryDate}` : '',
    ].filter(Boolean);
    return parts.join(' · ');
  }).join('; ');
}

export function formatLegalProtection(value: string | string[] | undefined): string {
  const raw = stringValue(value);
  const rows = parseJsonValue<Array<{ documentType?: string; objectName?: string; documentNumber?: string; issueDate?: string; expiryDate?: string; rightHolder?: string; comment?: string }>>(value, []);
  if (!rows.length) return raw;
  const typeLabels: Record<string, string> = {
    patent: 'патент',
    trademark: 'товарный знак',
    license: 'лицензионный договор',
    'no-infringement': 'подтверждение отсутствия нарушения прав',
    other: 'другое',
  };
  return rows.map((row) => {
    const parts = [
      typeLabels[row.documentType || ''] || row.documentType || 'документ',
      row.objectName || '',
      row.documentNumber ? `№ ${row.documentNumber}` : '',
      row.issueDate ? `выдано: ${row.issueDate}` : '',
      row.expiryDate ? `действует до: ${row.expiryDate}` : '',
      row.rightHolder ? `правообладатель: ${row.rightHolder}` : '',
      row.comment || '',
    ].filter(Boolean);
    return parts.join(' · ');
  }).join('; ');
}

export function formatManufacturers(value: string | string[] | undefined): string {
  const raw = stringValue(value);
  const rows = parseJsonValue<Array<{
    manufacturerType?: string;
    organizationalForm?: string;
    country?: string;
    absentInDirectory?: string;
    nameRu?: string;
    nameKz?: string;
    nameEn?: string;
    permitNumber?: string;
    permitIssueDate?: string;
    permitExpiryDate?: string;
    headLastName?: string;
    headFirstName?: string;
    headMiddleName?: string;
    headPosition?: string;
    phone?: string;
    email?: string;
    contactLastName?: string;
    contactFirstName?: string;
    contactMiddleName?: string;
    contactPosition?: string;
    legalAddress?: string;
    actualAddress?: string;
  }>>(value, []);
  if (!rows.length) return raw;
  const typeLabels: Record<string, string> = {
    'finished-product': 'производитель готового ЛП',
    api: 'производитель АФС',
    'primary-packaging': 'первичная упаковка',
    'secondary-packaging': 'вторичная упаковка',
    'quality-control': 'контроль качества',
    'batch-release': 'выпускающий контроль',
    'solvent-component': 'компонент / растворитель',
    other: 'другое',
  };
  return rows.map((row, index) => {
    const headName = [row.headLastName, row.headFirstName, row.headMiddleName].filter(Boolean).join(' ');
    const contactName = [row.contactLastName, row.contactFirstName, row.contactMiddleName].filter(Boolean).join(' ');
    const names = [
      row.nameRu ? `рус.: ${row.nameRu}` : '',
      row.nameKz ? `каз.: ${row.nameKz}` : '',
      row.nameEn ? `англ.: ${row.nameEn}` : '',
    ].filter(Boolean).join(', ');
    const parts = [
      `производитель ${index + 1}`,
      typeLabels[row.manufacturerType || ''] || row.manufacturerType || '',
      countryLabel(row.country),
      row.absentInDirectory === 'yes' ? 'отсутствует в справочнике' : '',
      names,
      row.permitNumber ? `разрешение № ${row.permitNumber}` : '',
      row.permitIssueDate ? `выдано: ${row.permitIssueDate}` : '',
      row.permitExpiryDate ? `действует до: ${row.permitExpiryDate}` : '',
      headName ? `руководитель: ${headName}` : '',
      row.headPosition ? `должность: ${row.headPosition}` : '',
      row.phone ? `тел.: ${row.phone}` : '',
      row.email ? `email: ${row.email}` : '',
      contactName ? `контакт: ${contactName}` : '',
      row.contactPosition ? `должность контакта: ${row.contactPosition}` : '',
      row.legalAddress ? `юр. адрес: ${row.legalAddress}` : '',
      row.actualAddress ? `факт. адрес: ${row.actualAddress}` : '',
    ].filter(Boolean);
    return parts.join(' · ');
  }).join('; ');
}

export function formatProductionSites(value: string | string[] | undefined): string {
  const raw = stringValue(value);
  const parsed = parseJsonValue<{ mode?: string; rows?: Array<{
    manufacturerType?: string;
    nameKz?: string;
    nameRu?: string;
    nameEn?: string;
    country?: string;
    permitNumber?: string;
    permitIssueDate?: string;
    permitExpiryDate?: string;
    legalAddress?: string;
    actualAddress?: string;
    phoneFaxEmail?: string;
    headFullName?: string;
    headPosition?: string;
    contactFullName?: string;
    contactPosition?: string;
  }> }>(value, { mode: '', rows: [] });
  const modeLabels: Record<string, string> = {
    'full-current': 'полностью на данном производстве',
    'partial-current': 'частично на данном производстве',
    'full-other': 'полностью на другом производстве',
  };
  if (!parsed.rows?.length) return modeLabels[parsed.mode || ''] || raw;
  const typeLabels: Record<string, string> = {
    'finished-product': 'производитель готового ЛП',
    api: 'производитель АФС',
    'primary-packaging': 'первичная упаковка',
    'secondary-packaging': 'вторичная упаковка',
    'quality-control': 'контроль качества',
    'batch-release': 'выпускающий контроль',
    'solvent-component': 'компонент / растворитель',
    other: 'другое',
  };
  const rows = parsed.rows.map((row, index) => {
    const names = [
      row.nameKz ? `каз.: ${row.nameKz}` : '',
      row.nameRu ? `рус.: ${row.nameRu}` : '',
      row.nameEn ? `англ.: ${row.nameEn}` : '',
    ].filter(Boolean).join(', ');
    return [
      `строка ${index + 1}`,
      typeLabels[row.manufacturerType || ''] || row.manufacturerType || '',
      names,
      countryLabel(row.country),
      row.permitNumber ? `разрешение № ${row.permitNumber}` : '',
      row.permitIssueDate ? `выдано: ${row.permitIssueDate}` : '',
      row.permitExpiryDate ? `действует до: ${row.permitExpiryDate}` : '',
      row.legalAddress ? `юр. адрес: ${row.legalAddress}` : '',
      row.actualAddress ? `факт. адрес: ${row.actualAddress}` : '',
      row.phoneFaxEmail ? `контакты: ${row.phoneFaxEmail}` : '',
      row.headFullName ? `руководитель: ${row.headFullName}` : '',
      row.headPosition ? `должность: ${row.headPosition}` : '',
      row.contactFullName ? `контакт: ${row.contactFullName}` : '',
      row.contactPosition ? `должность контакта: ${row.contactPosition}` : '',
    ].filter(Boolean).join(' · ');
  }).join('; ');
  return [modeLabels[parsed.mode || ''] || '', rows].filter(Boolean).join(' | ');
}

export function formatSpecialFlags(values: Application['values']): string {
  const flags = [
    stringValue(values['param-biological-flag']) === 'yes' ? 'биологический ЛП' : '',
    stringValue(values['param-immunobiological-flag']) === 'yes' ? 'иммунобиологический ЛП' : '',
    stringValue(values['param-new-api-flag']) === 'yes' ? 'новая АФС' : '',
    stringValue(values['param-orphan-status']) === 'yes' ? `орфанный статус: ${stringValue(values['param-orphan-status-state']) || 'да'}` : '',
    stringValue(values['param-transfer-enabled']) === 'yes' ? `трансфер: ${stringValue(values['param-transfer-site']) || 'да'}` : '',
    stringValue(values['param-api-special-status']) === 'yes' ? 'АФС без GMP / растительное сырье' : '',
    stringValue(values['param-who-prequalification']) === 'yes' ? 'преквалификация ВОЗ' : '',
  ].filter(Boolean);
  return flags.join(' · ') || '—';
}

export function formatExportNames(value: string | string[] | undefined): string {
  const rows = parseJsonValue<Array<{ country?: string; nameKz?: string; nameRu?: string; nameEn?: string }>>(value, []);
  return rows
    .map((row) => [row.country, row.nameKz, row.nameRu, row.nameEn].filter(Boolean).join(' / '))
    .filter(Boolean)
    .join('; ');
}

export function formatComposition(value: string | string[] | undefined): string {
  const raw = stringValue(value);
  const rows = parseJsonValue<Array<{ substanceType?: string; name?: string; quantity?: string; unit?: string; normativeDocument?: string; manufacturer?: string }>>(value, []);
  if (rows.length === 0 && raw) return raw;
  return rows
    .map((row) =>
      [
        row.substanceType,
        row.name,
        [row.quantity, row.unit ? unitLabel(row.unit) : ''].filter(Boolean).join(' '),
        row.normativeDocument,
        row.manufacturer,
      ].filter(Boolean).join(' / ')
    )
    .filter(Boolean)
    .join('; ');
}

export function formatUsePeriods(values: Application['values']): string {
  const afterOpening = [
    stringValue(values['param-use-period-after-opening-amount']),
    stringValue(values['param-use-period-after-opening-unit']) ? unitLabel(stringValue(values['param-use-period-after-opening-unit'])) : '',
  ].filter(Boolean).join(' ');
  const afterDissolution = [
    stringValue(values['param-use-period-after-dissolution-amount']),
    stringValue(values['param-use-period-after-dissolution-unit']) ? unitLabel(stringValue(values['param-use-period-after-dissolution-unit'])) : '',
  ].filter(Boolean).join(' ');
  return [
    afterOpening ? `после вскрытия: ${afterOpening}` : '',
    afterDissolution ? `после растворения: ${afterDissolution}` : '',
  ].filter(Boolean).join(' · ');
}

export function formatQcLab(values: Application['values']): string {
  return [
    stringValue(values['param-qc-lab-name']),
    stringValue(values['param-qc-lab-country']),
    stringValue(values['param-qc-lab-address']),
    stringValue(values['param-qc-lab-phone']),
    stringValue(values['param-qc-lab-email']),
  ].filter(Boolean).join(' · ');
}

export function formatVariationChanges(value: string | string[] | undefined): string {
  const rows = parseJsonValue<Array<{ changeType?: string; before?: string; after?: string }>>(value, []);
  return rows
    .map((row) => [row.changeType, row.before ? `до: ${row.before}` : '', row.after ? `после: ${row.after}` : ''].filter(Boolean).join(' / '))
    .filter(Boolean)
    .join('; ');
}
