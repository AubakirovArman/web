import { expect, test } from './fixtures';

test('legacy browser storage does not blank the wizard', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'ndda-applications-v3',
      JSON.stringify([
        {
          id: 'legacy-app',
          values: {
            'param-object-type': 'LS',
            'param-procedure': 'registration',
            'param-trade-name': 'Legacy Drug',
          },
        },
      ])
    );
    window.localStorage.setItem(
      'ndda-rules-v1',
      JSON.stringify([
        {
          id: 'rule-common-registration',
          name: 'Общий пакет документов для регистрации',
        },
      ])
    );
  });

  await page.goto('/wizard');
  await expect(page.getByRole('heading', { name: 'Создание заявки' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Торговое наименование', exact: true })).toHaveValue('Legacy Drug');

  await page.getByTestId('wizard-step-check').click();
  await expect(page.getByTestId('wizard-check-step')).toBeVisible();
});
