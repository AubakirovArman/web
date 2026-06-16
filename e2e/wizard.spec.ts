import { expect, openWizard, seedApplications, selectOption, test } from './fixtures';

test('wizard initializes, saves draft, and moves between sections with warnings', async ({ page }) => {
  await openWizard(page);

  await expect(page.getByRole('textbox', { name: 'Торговое наименование', exact: true })).toHaveValue('Парацетамол-Тева');

  await page.getByRole('button', { name: 'Сохранить черновик' }).first().click();
  await expect(page.getByText('Черновик сохранен')).toBeVisible();

  await page.getByRole('button', { name: 'Далее' }).click();
  await expect(page.getByTestId('wizard-docs-step')).toBeVisible();
  await expect(page.getByText(/Загружено \d+ из \d+ обязательных документов/)).toBeVisible();

  await page.getByTestId('wizard-step-check').click();
  await expect(page.getByTestId('wizard-check-step')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Отправить в экспертизу' })).toBeEnabled();
});

test('submit validation blocks an incomplete mandatory package', async ({ page }) => {
  await seedApplications(page, [incompleteRegistrationApp]);
  await openWizard(page);

  await page.getByTestId('wizard-step-check').click();
  await expect(page.getByTestId('wizard-check-step')).toBeVisible();

  await page.getByRole('button', { name: 'Запустить проверку' }).click();
  await expect(page.getByText(/Для отправки нужно устранить/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Отправить в экспертизу' })).toBeDisabled();
  await expect(page.getByText(/Отсутствует документ|Расхождение|GMP/).first()).toBeVisible();
});

test('procedure and domain controls expose MI variation fields', async ({ page }) => {
  await openWizard(page);

  await selectOption(page, '#param-object-type', 'Медицинское изделие');
  await selectOption(page, '#param-procedure', 'Внесение изменений');

  await expect(page.getByRole('textbox', { name: 'Номер регистрационного удостоверения МИ', exact: true })).toBeVisible();
  await expect(page.locator('#param-mi-variation-class')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Текущее значение (МИ)', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Новое значение (МИ)', exact: true })).toBeVisible();
});

test('documents section lists required upload cards', async ({ page }) => {
  await openWizard(page);

  await page.getByRole('button', { name: 'Далее' }).click();
  await expect(page.getByTestId('wizard-docs-step')).toBeVisible();
  await expect(page.getByTestId('document-uploader-doc-application')).toBeVisible();
  await expect(page.getByTestId('document-uploader-doc-payment')).toBeVisible();
  await expect(page.getByText('Заявление на экспертизу')).toBeVisible();
});


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
