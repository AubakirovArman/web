import { expect, test } from './fixtures';

test('reference page renders generated LS/MI knowledge base with search', async ({ page }) => {
  await page.goto('/reference');

  await expect(page.getByRole('heading', { name: 'Справочник НПА ЛС / МИ' })).toBeVisible();
  await expect(page.getByText(/Документы/).first()).toBeVisible();
  await expect(page.getByText(/Фрагменты/).first()).toBeVisible();

  await page.getByTestId('reference-search').fill('заявление');
  await expect(page.getByText(/Совпадения/)).toBeVisible();
  await expect(page.getByText(/заявление/i).first()).toBeVisible();

  await page.getByRole('button', { name: 'MI' }).click();
  await expect(page.getByText('МИ').first()).toBeVisible();
});

test('admin rule source opens evidence dialog and links to reference', async ({ page }) => {
  await page.goto('/admin');

  await page.getByRole('button', { name: 'Источник' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Доказательная связка')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Открыть в справочнике' }).first()).toBeVisible();
});
