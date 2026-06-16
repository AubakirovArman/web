import { expect, openWizard, seedApplications, test } from './fixtures';


const incompleteRegistrationApp = {
  id: 'e2e-incomplete-ls-registration',
  createdAt: '2026-06-15T00:00:00.000Z',
  status: 'draft',
  values: {
    'param-object-type': 'LS',
    'param-procedure': 'registration',
    'param-product-type': 'generic',
    'param-trade-name': 'Incomplete Drug',
    'param-inn': 'Paracetamol',
    'param-dosage-form': 'tablets',
    'param-dosage': '500 мг',
    'param-atc-code': 'N02BE01',
    'param-administration-route': 'oral',
    'param-dispensing': 'otc',
    'param-packaging': 'Блистер',
    'param-composition': 'Paracetamol 500 мг',
    'param-shelf-life': '24 месяца',
    'param-storage-conditions': 'хранить при температуре не выше 25 °C',
    'param-manufacturer': 'Incomplete Pharma',
    'param-manufacturer-address': 'Incomplete Site, Hungary',
    'param-applicant': 'Incomplete Applicant',
    'param-lab-testing-required': 'yes',
  },
  files: [],
  checklist: [],
  findings: [],
};

const completeRegistrationApp = {
  id: 'e2e-complete-ls-registration',
  createdAt: '2026-06-15T00:00:00.000Z',
  status: 'draft',
  values: {
    'param-object-type': 'LS',
    'param-procedure': 'registration',
    'param-product-type': 'original',
    'param-trade-name': 'E2E Test Drug',
    'param-trade-name-kz': 'E2E Test Drug KZ',
    'param-trade-name-ru': 'E2E Test Drug',
    'param-trade-name-en': 'E2E Test Drug',
    'param-inn': 'Paracetamol',
    'param-inn-kz': 'Paracetamol KZ',
    'param-inn-ru': 'Paracetamol',
    'param-inn-en': 'Paracetamol',
    'param-dosage-form': 'tablets',
    'param-dosage': '500 мг',
    'param-atc-code': 'N02BE01',
    'param-atc-name': 'Paracetamol',
    'param-administration-route': 'oral',
    'param-dispensing': 'otc',
    'param-packaging': 'Блистер 10 таблеток',
    'param-composition': 'Paracetamol 500 мг',
    'param-shelf-life': '24 месяца',
    'param-storage-conditions': 'хранить при температуре не выше 25 °C',
    'param-manufacturer': 'E2E Pharma Ltd.',
    'param-manufacturer-address': 'E2E Manufacturing Site, Hungary',
    'param-applicant': 'E2E Applicant LLP',
    'param-holder': 'E2E Holder LLP',
    'param-sterile': 'no',
    'param-aseptic': 'no',
    'param-bioequivalence-required': 'no',
    'param-lab-testing-required': 'no',
    'param-clinical-studies': 'yes',
    'param-additional-monitoring': 'no',
  },
  files: [
    file('doc-application', 'application.pdf'),
    file('doc-payment', 'payment.pdf'),
    file('doc-cover-letter', 'cover_letter.pdf'),
    file('doc-registration-dossier', 'registration_dossier.pdf'),
    file('doc-gmp', 'gmp.pdf', {
      manufacturer: 'E2E Pharma Ltd.',
      address: 'E2E Manufacturing Site, Hungary',
      validUntil: '31.12.2030',
      scope: 'Таблетки',
    }),
    file('doc-cpp', 'cpp.pdf', {
      country: 'Hungary',
      issueDate: '01.01.2026',
      validUntil: '31.12.2030',
    }),
    file('doc-foreign-registrations', 'foreign_registrations.pdf', {
      countries: 'Hungary, Poland',
    }),
    file('doc-spc-ru', 'spc_ru.docx', commonTextFields()),
    file('doc-spc-kz', 'spc_kz.docx', { textLength: '1200' }),
    file('doc-instruction-ru', 'instruction_ru.docx', commonTextFields({ textLength: '1200' })),
    file('doc-instruction-kz', 'instruction_kz.docx', { textLength: '1200' }),
    file('doc-labeling-text', 'labeling_text.pdf', {
      textContent: 'E2E Test Drug Paracetamol 500 мг tablets',
    }),
    file('doc-mockup', 'mockup.png', {
      tradeName: 'E2E Test Drug',
      dosage: '500 мг',
      shelfLife: '24 месяца',
      storage: 'хранить при температуре не выше 25 °C',
    }),
    file('doc-trademark', 'trademark.pdf'),
    file('doc-quality-nd', 'quality_nd.docx', {
      tradeName: 'E2E Test Drug',
      dosage: '500 мг',
      shelfLife: '24 месяца',
      storage: 'хранить при температуре не выше 25 °C',
    }),
    file('doc-module3', 'module3.pdf', {
      hasSpecification: 'да',
      hasValidation: 'да',
      hasStability: 'да',
    }),
    file('doc-stability', 'stability.pdf', {
      shelfLife: '24 месяца',
    }),
  ],
  checklist: [],
  findings: [],
};

test('incomplete LS registration is blocked with compact completeness and findings tables', async ({ page }) => {
  await seedApplications(page, [incompleteRegistrationApp]);
  await openWizard(page);

  await page.getByTestId('wizard-step-check').click();
  await page.getByRole('button', { name: 'Запустить проверку' }).click();

  await expect(page.getByText('Комплектность документов')).toBeVisible();
  await expect(page.getByText('Замечания проверки')).toBeVisible();
  await expect(page.getByText('Нет').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Отправить в экспертизу' })).toBeDisabled();
  await expect(page.getByText(/Для отправки нужно устранить/)).toBeVisible();
});

test('complete LS registration can be checked, submitted, and opened by expert', async ({ page }) => {
  await seedApplications(page, [completeRegistrationApp]);
  await page.goto('/wizard');

  await expect(page.getByRole('heading', { name: 'Создание заявки' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Торговое наименование', exact: true })).toHaveValue('E2E Test Drug');

  await page.getByTestId('wizard-step-check').click();
  await page.getByRole('button', { name: 'Запустить проверку' }).click();

  await expect(page.getByText('Комплектность документов')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Отправить в экспертизу' })).toBeEnabled();

  await page.getByRole('button', { name: 'Отправить в экспертизу' }).click();
  await expect(page).toHaveURL(/\/expert\//);
  await expect(page.getByRole('heading', { name: 'E2E Test Drug' })).toBeVisible();
  await expect(page.getByText('Документы и проверки')).toBeVisible();
  await expect(page.getByText('Подана').first()).toBeVisible();

  await page.getByRole('button', { name: 'Перезапустить проверку' }).click();
  await expect(page.getByText('Предпроверка выполнена')).toBeVisible();
});

function file(documentTypeId: string, name: string, extracted: Record<string, string> = {}) {
  return {
    id: `file-${documentTypeId}`,
    name,
    documentTypeId,
    contentType: name.endsWith('.docx')
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf',
    size: 8192,
    url: `/test-docs/${name}`,
    extension: name.split('.').pop(),
    mime: name.endsWith('.docx')
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf',
    uploadedAt: '2026-06-15T00:00:00.000Z',
    version: 1,
    extracted,
    processing: {
      ocrStatus: 'success',
      extractionStatus: 'success',
      parser: 'e2e-fixture',
      startedAt: '2026-06-15T00:00:00.000Z',
      finishedAt: '2026-06-15T00:00:01.000Z',
      errors: [],
      textLayer: true,
      ocrQuality: 0.99,
    },
  };
}

function commonTextFields(extra: Record<string, string> = {}) {
  return {
    tradeName: 'E2E Test Drug',
    inn: 'Paracetamol',
    dosage: '500 мг',
    dosageForm: 'Таблетки',
    shelfLife: '24 месяца',
    storage: 'хранить при температуре не выше 25 °C',
    manufacturer: 'E2E Pharma Ltd.',
    address: 'E2E Manufacturing Site, Hungary',
    textLength: '1200',
    textContent:
      'состав показания противопоказания дозировка побочные действия срок годности условия хранения передозировка взаимодействие',
    fonts: 'Times New Roman',
    sizes: '24',
    colors: '000000',
    ...extra,
  };
}
