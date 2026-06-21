import { Application } from '@/lib/types';
import { getVisibleParameterIds } from '@/lib/data/seed';
import { getStringValue } from '@/components/applicant/wizard/parameter-value-helpers';

export type ParameterGroup = { id: string; title: string; fieldIds: string[] };

const hiddenLsLegacyParameterIds = new Set([
  'param-trade-name',
  'param-inn',
  'param-dosage',
  'param-atc-name',
  'param-administration-route',
  'param-export-trade-name-kz',
  'param-export-trade-name-ru',
  'param-export-trade-name-en',
  'param-export-country',
  'param-use-period-after-opening',
  'param-composition',
  'param-variation-details-table',
]);

const orphanDependentParameterIds = new Set([
  'param-orphan-status-state',
  'param-orphan-assigned-date',
  'param-orphan-registration-number',
  'param-orphan-refusal-flag',
  'param-orphan-refusal-date',
  'param-orphan-decision-number',
  'param-orphan-withdrawal-date',
]);

const orphanRefusalParameterIds = new Set([
  'param-orphan-refusal-date',
  'param-orphan-decision-number',
]);

const atcDependentParameterIds = new Set([
  'param-atc-code',
  'param-atc-name-kz',
  'param-atc-name-ru',
  'param-atc-comments',
]);

export function shouldShowWizardParameter(id: string, values: Application['values'], objectType: string): boolean {
  if (objectType !== 'MI' && hiddenLsLegacyParameterIds.has(id)) return false;
  if (orphanDependentParameterIds.has(id) && getStringValue(values['param-orphan-status']) !== 'yes') return false;
  if (orphanRefusalParameterIds.has(id) && getStringValue(values['param-orphan-refusal-flag']) !== 'yes') return false;
  if (id === 'param-transfer-site' && getStringValue(values['param-transfer-enabled']) !== 'yes') return false;
  if (atcDependentParameterIds.has(id) && getStringValue(values['param-atc-enabled']) !== 'yes') return false;
  return true;
}

export function getLsParameterGroups(procedure: string): ParameterGroup[] {
  const groups: ParameterGroup[] = [
    {
      id: 'base',
      title: 'Основное',
      fieldIds: [
        'param-object-type',
        'param-procedure',
        'param-dossier-type',
        'param-manufacturer-country',
        'param-expertise-mode',
        'param-payment-request',
        'param-registration-certificate-info',
        'param-applicant',
        'param-holder',
        'param-manufacturer',
        'param-manufacturer-address',
      ],
    },
    {
      id: 'medicine',
      title: 'Сведения о ЛС',
      fieldIds: [
        'param-trade-name-kz',
        'param-trade-name-ru',
        'param-trade-name-en',
        'param-export-trade-names',
        'param-inn-kz',
        'param-inn-ru',
        'param-inn-en',
        'param-inn-comments',
        'param-dosage-form',
        'param-dosage-amount',
        'param-dosage-unit',
      ],
    },
    {
      id: 'classification',
      title: 'Классификация',
      fieldIds: [
        'param-product-type',
        'param-atc-enabled',
        'param-atc-code',
        'param-atc-name-kz',
        'param-atc-name-ru',
        'param-atc-comments',
        'param-biological-flag',
        'param-immunobiological-flag',
        'param-new-api-flag',
        'param-sterile',
        'param-aseptic',
        'param-license-or-patent-active',
        'param-patent-trademark',
        'param-reference-product',
        'param-contains-gmo',
        'param-human-animal-origin',
        'param-orphan-status',
        'param-orphan-status-state',
        'param-orphan-assigned-date',
        'param-orphan-registration-number',
        'param-orphan-refusal-flag',
        'param-orphan-refusal-date',
        'param-orphan-decision-number',
        'param-orphan-withdrawal-date',
        'param-who-prequalification',
        'param-additional-monitoring',
      ],
    },
    {
      id: 'use-composition',
      title: 'Применение и состав',
      fieldIds: [
        'param-dispensing',
        'param-dispensing-comment',
        'param-administration-routes',
        'param-administration-device',
        'param-packaging',
        'param-composition-table',
        'param-api-name',
        'param-api-special-status',
        'param-new-excipient',
        'param-bioequivalence-required',
        'param-lab-testing-required',
        'param-clinical-studies',
        'param-nonclinical-studies',
      ],
    },
    {
      id: 'stability-registration',
      title: 'Стабильность и регистрации',
      fieldIds: [
        'param-shelf-life',
        'param-use-period-after-opening-amount',
        'param-use-period-after-opening-unit',
        'param-use-period-after-dissolution-amount',
        'param-use-period-after-dissolution-unit',
        'param-storage-conditions',
        'param-transport-conditions',
        'param-foreign-registrations',
        'param-manufacturers',
        'param-registration-number',
        'param-ru-issue-date',
        'param-ru-expiry-date',
        'param-ru-unlimited',
      ],
    },
    {
      id: 'manufacturing',
      title: 'Производство и лаборатория',
      fieldIds: [
        'param-cis-manufacturer',
        'param-transfer-enabled',
        'param-transfer-site',
        'param-production-sites',
        'param-manufacturer-role',
        'param-manufacturer-permits',
        'param-manufacturer-contact',
        'param-qc-lab-name',
        'param-qc-lab-address',
        'param-qc-lab-country',
        'param-qc-lab-phone',
        'param-qc-lab-email',
      ],
    },
    {
      id: 'variation',
      title: 'Изменения',
      fieldIds: [
        'param-variation-class',
        'param-variation-code',
        'param-variation-area',
        'param-variation-old-value',
        'param-variation-new-value',
        'param-variation-changes-table',
        'param-variation-linked-changes',
      ],
    },
    {
      id: 'payment-sign',
      title: 'Оплата и подписание',
      fieldIds: [
        'param-contract-number',
        'param-contract-date',
        'param-contract-term',
        'param-payment-subject',
        'param-applicant-confirmation',
      ],
    },
  ];

  return procedure === 'variation' ? groups : groups.filter((group) => group.id !== 'variation');
}

export function getMiParameterGroups(procedure: string): ParameterGroup[] {
  const groups: ParameterGroup[] = [
    { id: 'base', title: 'Основное', fieldIds: ['param-object-type', 'param-procedure', 'param-mi-registration-number'] },
    {
      id: 'device-info',
      title: 'Сведения о МИ',
      fieldIds: ['param-mi-name-kz', 'param-mi-name-ru', 'param-mi-name-en', 'param-mi-model', 'param-mi-variants', 'param-mi-intended-purpose'],
    },
    {
      id: 'classification',
      title: 'Классификация',
      fieldIds: [
        'param-mi-type',
        'param-mi-risk-class',
        'param-mi-application-area',
        'param-mi-nomenclature-code',
        'param-mi-risk-rule',
        'param-mi-sterile',
        'param-mi-measuring',
        'param-mi-ivd',
        'param-mi-implantable',
        'param-mi-software-version',
      ],
    },
    {
      id: 'participants-production',
      title: 'Участники и производство',
      fieldIds: ['param-mi-authorized-representative', 'param-mi-applicant-contact', 'param-mi-qms-info'],
    },
    {
      id: 'tests-docs',
      title: 'Испытания и документация',
      fieldIds: [
        'param-mi-technical-testing',
        'param-mi-biological-testing',
        'param-mi-clinical-testing',
        'param-mi-instructions-info',
        'param-mi-labeling-info',
        'param-mi-storage-conditions',
      ],
    },
    {
      id: 'registration-history',
      title: 'РУ и история',
      fieldIds: ['param-mi-registration-issue-date', 'param-mi-registration-expiry-date', 'param-mi-registration-unlimited', 'param-mi-post-market-history'],
    },
    {
      id: 'variation',
      title: 'Изменения',
      fieldIds: ['param-mi-variation-class', 'param-mi-variation-area', 'param-mi-variation-old-value', 'param-mi-variation-new-value', 'param-mi-variation-details-table'],
    },
    {
      id: 'payment-sign',
      title: 'Оплата и подписание',
      fieldIds: ['param-mi-contract-number', 'param-mi-contract-date', 'param-mi-payment-subject', 'param-mi-applicant-confirmation'],
    },
  ];

  if (procedure === 'variation') return groups;
  if (procedure === 're-registration') return groups.filter((group) => group.id !== 'variation');
  return groups.filter((group) => !['registration-history', 'variation'].includes(group.id));
}

export function getVisibleParamsSubSteps(values: Application['values'] | undefined): ParameterGroup[] {
  if (!values) return [];
  const objectType = values['param-object-type'] === 'MI' ? 'MI' : 'LS';
  const procedure = values['param-procedure'] === 're-registration' || values['param-procedure'] === 'variation'
    ? values['param-procedure']
    : 'registration';
  const visibleParamIds = getVisibleParameterIds(objectType, procedure, values as Record<string, string>);
  const visibleIds = new Set(visibleParamIds.filter((id) => shouldShowWizardParameter(id, values, objectType)));
  const groups = objectType === 'MI' ? getMiParameterGroups(procedure) : getLsParameterGroups(procedure);
  return groups.filter((group) => group.fieldIds.some((id) => visibleIds.has(id)));
}
