import { expect, seedApiApplication, test } from './fixtures';

test('expert can inspect an application, rerun checks, and change status', async ({ page }) => {
  const app = await seedApiApplication(page, 'field-mismatch');

  await page.goto('/expert');
  await expect(page.getByRole('heading', { name: 'Кабинет эксперта' })).toBeVisible();
  await expect(page.getByText('Парацетамол-Тева').first()).toBeVisible();
  await expect(page.getByText(/^Серьёзно \d+/).first()).toBeVisible();

  await page.getByRole('link', { name: /Открыть/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/expert/${app.id}`));
  await expect(page.getByText('Матрица проверки заявки')).toBeVisible();
  await expect(page.getByText('Документы и проверки')).toBeVisible();
  await expect(page.getByText('Разные сроки годности').first()).toBeVisible();

  await page.getByRole('button', { name: 'Перезапустить проверку' }).click();
  await expect(page.getByText('Предпроверка выполнена')).toBeVisible();

  await page.getByRole('button', { name: 'Взять в работу' }).click();
  await expect(page.getByText('Статус изменён на «На экспертизе»')).toBeVisible();
  await expect(page.getByText('На экспертизе').first()).toBeVisible();
});

test('expert can accept and reject findings after precheck', async ({ page }) => {
  const app = await seedApiApplication(page, 'missing-gmp');
  await page.goto(`/expert/${app.id}`);

  await expect(page.getByRole('heading', { name: 'Парацетамол-Тева' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Принять' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Принять' }).first().click({ force: true });
  await expect(page.getByText('Принято').first()).toBeVisible();

  await page.getByRole('button', { name: 'Отклонить' }).first().click({ force: true });
  await expect(page.getByText('Отклонено').first()).toBeVisible();
});

test('admin can review and modify rule metadata', async ({ page }) => {
  await page.goto('/admin');

  await expect(page.getByRole('heading', { name: 'Панель администратора' })).toBeVisible();
  await expect(page.getByText('Общий пакет документов для регистрации', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /Общий пакет документов для регистрации/ }).first().click();
  await page.getByRole('button', { name: 'Выключить' }).click();
  await expect(page.getByRole('button', { name: 'Включить' })).toBeVisible();

  await page.getByRole('tab', { name: 'Документы' }).click();
  await expect(page.getByText('Заявление на экспертизу', { exact: true })).toBeVisible();
  await expect(page.getByText('Документ об оплате', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'НПА' }).click();
  await expect(page.getByText('Приказ ҚР ДСМ-10').first()).toBeVisible();

  await page.getByRole('button', { name: 'Сбросить' }).click();
  await expect(page.getByText('Правила сброшены к исходным')).toBeVisible();
});
