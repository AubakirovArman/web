import { expect, openWizard, selectOption, test } from './fixtures';

test('generic LS accepts bioequivalence waiver as an alternative document', async ({ page }) => {
  await openWizard(page);
  await page.getByRole('button', { name: 'Далее' }).click();

  const waiverUploader = page.getByTestId('document-uploader-doc-bioequivalence-waiver');
  await expect(waiverUploader).toBeVisible();

  await waiverUploader.locator('input[type="file"]').setInputFiles({
    name: 'bioequivalence-waiver.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\nbioequivalence waiver'),
  });

  await expect(waiverUploader.getByText('bioequivalence-waiver.pdf')).toBeVisible();
  await page.getByTestId('wizard-step-check').click();
  await page.getByRole('button', { name: 'Запустить проверку' }).click();

  await expect(page.getByText('Отсутствует документ: Отчет об исследовании биоэквивалентности')).toHaveCount(0);
});

test('document uploader rejects invalid file formats with a visible warning', async ({ page }) => {
  await openWizard(page);
  await page.getByRole('button', { name: 'Далее' }).click();

  const paymentUploader = page.getByTestId('document-uploader-doc-payment');
  await paymentUploader.locator('input[type="file"]').setInputFiles({
    name: 'payment.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an accepted payment attachment'),
  });

  await expect(paymentUploader.getByText(/не принят/)).toBeVisible();
});

test('MI class III requires biological and clinical study documents', async ({ page }) => {
  await openWizard(page);

  await selectOption(page, '#param-object-type', 'Медицинское изделие');
  await selectOption(page, '#param-procedure', 'Регистрация');
  await selectOption(page, '#param-mi-risk-class', 'III');
  await page.getByRole('button', { name: 'Далее' }).click();

  await expect(page.getByTestId('document-uploader-doc-mi-biological-studies')).toBeVisible();
  await expect(page.getByTestId('document-uploader-doc-mi-clinical-trials')).toBeVisible();
});

test('admin exposes check registry and rule package export', async ({ page }) => {
  await page.goto('/admin');

  await page.getByRole('tab', { name: 'Проверки' }).click();
  await expect(page.getByText('Обязательные поля заявления')).toBeVisible();
  await expect(page.getByText('Комплектность обязательных документов')).toBeVisible();

  await page.getByRole('tab', { name: 'Rule package' }).click();
  await page.getByRole('button', { name: 'Экспортировать JSON' }).click();
  await expect(page.getByPlaceholder('Вставьте rule package JSON или нажмите экспорт')).toHaveValue(/"rules"/);
});

test('expert can generate an applicant request from findings', async ({ page }) => {
  await page.goto('/expert');
  await page.getByRole('button', { name: 'Перезапустить проверку' }).click();
  await page.getByRole('button', { name: 'Сформировать запрос' }).click();

  await expect(page.getByText('Черновик запроса заявителю')).toBeVisible();
  await expect(page.getByText('Запрос по заявке:')).toBeVisible();
});
