import { expect, openWizard, selectOption, test } from './fixtures';

test('wizard initializes, saves draft, and moves between sections with warnings', async ({ page }) => {
  await openWizard(page);

  await expect(page.getByLabel('Торговое наименование')).toHaveValue('Парацетамол-Тева');

  await page.getByRole('button', { name: 'Сохранить черновик' }).first().click();
  await expect(page.getByText('Черновик сохранен')).toBeVisible();

  await page.getByRole('button', { name: 'Далее' }).click();
  await expect(page.getByTestId('wizard-docs-step')).toBeVisible();
  await expect(page.getByText(/Загружено \d+ из \d+ обязательных документов/)).toBeVisible();

  await page.getByRole('button', { name: 'Далее' }).click();
  await expect(page.getByTestId('wizard-check-step')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Отправить в экспертизу' })).toBeDisabled();
});

test('submit validation blocks an incomplete mandatory package', async ({ page }) => {
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

  await expect(page.getByLabel('Номер регистрационного удостоверения МИ')).toBeVisible();
  await expect(page.getByText('Класс изменений МИ')).toBeVisible();
  await expect(page.getByLabel('Текущее значение (МИ)')).toBeVisible();
  await expect(page.getByLabel('Новое значение (МИ)')).toBeVisible();
});

test('documents section lists required upload cards', async ({ page }) => {
  await openWizard(page);

  await page.getByRole('button', { name: 'Далее' }).click();
  await expect(page.getByTestId('wizard-docs-step')).toBeVisible();
  await expect(page.getByTestId('document-uploader-doc-application')).toBeVisible();
  await expect(page.getByTestId('document-uploader-doc-payment')).toBeVisible();
  await expect(page.getByText('Заявление на экспертизу')).toBeVisible();
});
