import { expect, test } from './fixtures';

test('expert can inspect an application, rerun checks, and change status', async ({ page }) => {
  await page.goto('/expert');

  await expect(page.getByRole('heading', { name: 'Кабинет эксперта' })).toBeVisible();
  await expect(page.getByText('Парацетамол-Тева').first()).toBeVisible();

  await page.getByRole('button', { name: 'Перезапустить проверку' }).click();
  await expect(page.getByText('Предпроверка выполнена')).toBeVisible();
  await expect(page.getByText('Замечания').first()).toBeVisible();

  await page.getByRole('button', { name: 'Взять в работу' }).click();
  await expect(page.getByText('Статус изменён на «На экспертизе»')).toBeVisible();
  await expect(page.getByText('На экспертизе').first()).toBeVisible();
});

test('expert can accept and reject findings after precheck', async ({ page }) => {
  await page.goto('/expert');
  await expect(page.getByRole('heading', { name: 'Кабинет эксперта' })).toBeVisible();

  await page.getByRole('button', { name: 'Перезапустить проверку' }).click();
  await expect(page.getByRole('button', { name: 'Принять' }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Принять' }).first().click();
  await expect(page.getByText('Принято').first()).toBeVisible();

  await page.getByRole('button', { name: 'Отклонить' }).first().click();
  await expect(page.getByText('Отклонено').first()).toBeVisible();
});

test('admin can review and modify rule metadata', async ({ page }) => {
  await page.goto('/admin');

  await expect(page.getByRole('heading', { name: 'Панель администратора' })).toBeVisible();
  await expect(page.getByText('Общий пакет документов для регистрации')).toBeVisible();

  await page.getByRole('button', { name: 'Включено' }).first().click();
  await expect(page.getByRole('button', { name: 'Выключено' }).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Документы' }).click();
  await expect(page.getByText('Заявление на экспертизу')).toBeVisible();
  await expect(page.getByText('Документ об оплате')).toBeVisible();

  await page.getByRole('tab', { name: 'НПА' }).click();
  await expect(page.getByText('Приказ ҚР ДСМ-10').first()).toBeVisible();

  await page.getByRole('button', { name: 'Сбросить' }).click();
  await expect(page.getByText('Правила сброшены к исходным')).toBeVisible();
});
