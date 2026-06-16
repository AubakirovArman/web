import { expect, seedApiApplication, test } from './fixtures';

test('ideal LS registration demo passes the expert document-check matrix', async ({ page }) => {
  const app = await seedApiApplication(page, 'ideal');
  await page.goto(`/expert/${app.id}`);

  await expect(page.getByText('Матрица проверки заявки')).toBeVisible();
  await expect(page.getByText('Документы и проверки')).toBeVisible();
  await expect(page.getByText('Замечаний нет. Эталонная заявка проходит автоматические критерии.')).toBeVisible();
  await expect(page.getByText('Не прошёл')).toHaveCount(0);
  await expect(page.getByText('Прошёл').first()).toBeVisible();
});

test('missing GMP scenario is visible as a failed document row', async ({ page }) => {
  const app = await seedApiApplication(page, 'missing-gmp');
  await page.goto(`/expert/${app.id}`);

  await expect(page.getByText('Отсутствует документ: GMP-сертификат или ссылка на GMP-реестр')).toBeVisible();
  await expect(page.getByText('Не прошёл').first()).toBeVisible();
});

test('expired CPP scenario surfaces a certificate finding', async ({ page }) => {
  const app = await seedApiApplication(page, 'expired-cpp');
  await page.goto(`/expert/${app.id}`);

  await expect(page.getByText('Сертификат фармацевтического продукта просрочен')).toBeVisible();
  await expect(page.getByText('Не прошёл').first()).toBeVisible();
});

test('field mismatch and DOCX format scenarios surface content-level findings', async ({ page }) => {
  const mismatchApp = await seedApiApplication(page, 'field-mismatch');
  await page.goto(`/expert/${mismatchApp.id}`);
  await expect(page.getByText('Разные сроки годности в ОХЛП и инструкции')).toBeVisible();

  const formatApp = await seedApiApplication(page, 'bad-docx-format');
  await page.goto(`/expert/${formatApp.id}`);
  await expect(page.getByText('Шрифт в «ОХЛП (русский)» отличается от Times New Roman')).toBeVisible();
});
