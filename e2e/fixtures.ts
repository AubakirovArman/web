import { test as base, expect, Page } from '@playwright/test';

const ignoredConsoleFragments = [
  'Download the React DevTools',
  'Fast Refresh',
  'Blocked cross-origin request',
  'WebSocket connection to',
  'ERR_INVALID_HTTP_RESPONSE',
];

async function prepareCleanBrowserState(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem('theme', 'light');
  });
}

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = [];

    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (ignoredConsoleFragments.some((fragment) => text.includes(fragment))) return;
      errors.push(text);
    });

    await prepareCleanBrowserState(page);
    await use(page);
    expect(errors, 'browser console/runtime errors').toEqual([]);
  },
});

export { expect };

export async function selectOption(page: Page, triggerSelector: string, optionName: string) {
  await page.locator(triggerSelector).click();
  await page.getByRole('option', { name: optionName }).click();
}

export async function openWizard(page: Page) {
  await page.goto('/wizard');
  await expect(page.getByRole('heading', { name: 'Создание заявки' })).toBeVisible();
}
