import { Application, RuleCondition } from '@/lib/types';
import { parameters } from '@/lib/data/seed';

export function matchesWizardConditions(values: Application['values'], conditions: RuleCondition[]): boolean {
  return conditions.every((condition) => {
    const value = values[condition.parameterId];
    const target = condition.value;
    switch (condition.operator) {
      case 'equals':
        return value === target;
      case 'notEquals':
        return value !== target;
      case 'notEmpty':
        return typeof value === 'string' ? value.trim().length > 0 : Array.isArray(value) ? value.length > 0 : false;
      case 'includes':
        if (typeof value === 'string') return value.toLowerCase().includes((target || '').toLowerCase());
        if (Array.isArray(value)) return value.some((item) => item.toLowerCase().includes((target || '').toLowerCase()));
        return false;
      default:
        return false;
    }
  });
}

export function formatWizardConditions(conditions: RuleCondition[], values: Application['values']): string {
  if (conditions.length === 0) return 'Всегда';
  return conditions
    .map((condition) => {
      const parameter = parameters.find((param) => param.id === condition.parameterId);
      const currentValue = values[condition.parameterId];
      const expectedValue = condition.value;
      return `${parameter?.label || condition.parameterId}: ${operatorLabel(condition.operator)} ${formatParameterValue(
        condition.parameterId,
        expectedValue
      )}; сейчас ${formatCurrentValue(condition.parameterId, currentValue)}`;
    })
    .join(' · ');
}

function operatorLabel(operator: RuleCondition['operator']) {
  const labels: Record<RuleCondition['operator'], string> = {
    equals: '=',
    notEquals: '!=',
    includes: 'содержит',
    notEmpty: 'заполнено',
  };
  return labels[operator];
}

function formatCurrentValue(parameterId: string, value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.map((item) => formatParameterValue(parameterId, item)).join(', ') || '-';
  return formatParameterValue(parameterId, value);
}

function formatParameterValue(parameterId: string, value?: string) {
  if (!value) return '-';
  const parameter = parameters.find((param) => param.id === parameterId);
  return parameter?.options?.find((option) => option.value === value)?.label || value;
}

export function formatParameterTitle(parameterId: string) {
  return parameters.find((param) => param.id === parameterId)?.label || parameterId;
}

export function shortCheckName(checkId: string) {
  const names: Record<string, string> = {
    required_document_presence_check: 'наличие',
    file_format_check: 'формат',
    ocr_quality_check: 'OCR',
    core_field_consistency_check: 'сверка полей',
    gmp_certificate_check: 'GMP',
    cpp_certificate_check: 'CPP',
    shelf_life_consistency_check: 'срок годности',
    storage_consistency_check: 'хранение',
    pharmacovigilance_contact_check: 'фармаконадзор',
    black_triangle_check: 'мониторинг',
    ls_variation_consistency_check: 'изменения',
    mi_variation_consistency_check: 'изменения МИ',
  };
  return names[checkId] || checkId.replace(/_check$/, '').replace(/_/g, ' ');
}
