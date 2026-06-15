import { expect, test } from './fixtures';

test('reference page renders generated LS/MI knowledge base with search', async ({ page }) => {
  await page.goto('/reference');

  await expect(page.getByRole('heading', { name: 'Умный справочник НПА' })).toBeVisible();
  await expect(page.getByText('Документы ядра')).toBeVisible();
  await expect(page.getByText('Обработано Gemma')).toBeVisible();

  await page.getByPlaceholder('Поиск по НПА ядра MVP').fill('Решение № 88');
  await expect(page.getByText('Решение № 88 от 3 ноября 2016 года').first()).toBeVisible();

  await page.getByRole('button', { name: /Решение № 88 от 3 ноября 2016 года/ }).click();
  await expect(page.getByText(/Требования к ОХЛП/).first()).toBeVisible();
});

test('smart reference intelligence contains all processed MVP documents', async ({ page }) => {
  const response = await page.request.get('/reference-intelligence/experiment.json');
  expect(response.ok()).toBeTruthy();

  const payload = await response.json();
  expect(payload.processedCount).toBe(11);
  expect(payload.targetCount).toBe(11);
  expect(payload.documents.every((document: { status: string }) => document.status === 'processed')).toBeTruthy();
});

test('admin rule source opens evidence dialog and links to reference', async ({ page }) => {
  await page.goto('/admin');

  await page.getByRole('button', { name: /Общий пакет документов для регистрации/ }).first().click();
  await page.getByRole('button', { name: 'Детали' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Источники и переходы в справочник')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Открыть источник' }).first()).toBeVisible();
});
