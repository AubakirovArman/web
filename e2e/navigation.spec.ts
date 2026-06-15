import { expect, test } from './fixtures';

test('main routes render and navigation works', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'NDDA AI' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Предэкспертиза регистрационного досье с помощью ИИ' })).toBeVisible();

  await page.getByRole('link', { name: 'Создать заявку' }).click();
  await expect(page).toHaveURL(/\/wizard$/);
  await expect(page.getByRole('heading', { name: 'Создание заявки' })).toBeVisible();

  await page.goto('/expert');
  await expect(page).toHaveURL(/\/expert$/);
  await expect(page.getByRole('heading', { name: 'Кабинет эксперта' })).toBeVisible();

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Панель администратора' })).toBeVisible();
});

test('theme toggle keeps the application visible', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Переключить тему' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('heading', { name: 'Предэкспертиза регистрационного досье с помощью ИИ' })).toBeVisible();

  await page.getByRole('button', { name: 'Переключить тему' }).click();
  await expect(page.getByRole('heading', { name: 'Предэкспертиза регистрационного досье с помощью ИИ' })).toBeVisible();
});
