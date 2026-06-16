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
  await page.getByRole('option', { name: optionName, exact: true }).click();
}

export async function openWizard(page: Page) {
  await page.goto('/wizard');
  await expect(page.getByRole('heading', { name: 'Создание заявки' })).toBeVisible();
}

export async function seedApplications(page: Page, apps: unknown[]) {
  await page.addInitScript((seedApps) => {
    window.localStorage.setItem('ndda-applications-v3', JSON.stringify(seedApps));
    window.localStorage.setItem('theme', 'light');
  }, apps);
}

export async function seedApiApplication(page: Page, scenario: string = 'ideal') {
  const response = await page.request.post('/api/seed', { data: { scenario } });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  await seedApplications(page, [payload.app]);
  return payload.app;
}
