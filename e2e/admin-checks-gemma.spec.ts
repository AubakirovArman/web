import { expect, test } from './fixtures';

test('admin check registry explains required fields, file formats, and application check map', async ({ page }) => {
  await page.goto('/admin');

  await page.getByRole('tab', { name: 'Проверки' }).click();
  await expect(page.getByText('Карта проверки заявок')).toBeVisible();
  await expect(page.getByText('ЛС · Регистрация')).toBeVisible();

  await page.getByRole('button', { name: /Обязательные поля заявления/ }).first().click();
  await expect(page.getByText('Обязательные поля заявления', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Контракт реализации')).toBeVisible();
  await expect(page.getByText('Торговое наименование').first()).toBeVisible();
  await expect(page.getByText('Внесение изменений').first()).toBeVisible();

  await page.getByRole('button', { name: 'Назад к проверкам' }).click();
  await page.getByRole('button', { name: /Формат файла/ }).first().click();
  await expect(page.getByText('Формат файла', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Документы, на которые распространяется проверка')).toBeVisible();
  await expect(page.getByText('ОХЛП (русский)').first()).toBeVisible();
  await expect(page.getByText('docx').first()).toBeVisible();
});

test('admin maps Gemma preview from Decision 88 into the local OХЛП document type', async ({ page }) => {
  await page.route('**/api/admin/npa-gemma-preview', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildDecision88Preview()),
    });
  });

  await page.goto('/admin');
  await page.getByRole('tab', { name: 'НПА' }).click();

  const decision88 = page
    .getByText('Требования к инструкции по медицинскому применению и общей характеристике лекарственного препарата')
    .locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
  await decision88.getByRole('button', { name: /Обработать через Gemma/ }).click();

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Готово. Проверьте извлеченные документы, правила и параметры')).toBeVisible();
  await expect(page.getByText('Проект ОХЛП', { exact: true })).toBeVisible();

  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'ОХЛП (русский)', exact: true }).click();
  await page.getByRole('button', { name: 'Залить выбранное' }).click();
  await expect(page.getByText('Залито требований: 1')).toBeVisible();

  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Документы' }).click();
  await page.getByText('ОХЛП (русский)', { exact: true }).first().click();
  await page.getByRole('tab', { name: 'Требования' }).click();

  await expect(page.getByText('Проект ОХЛП должен быть представлен в структурированном формате')).toBeVisible();
  await expect(page.getByText('Решение №88, раздел ОХЛП')).toBeVisible();
});

function buildDecision88Preview() {
  return {
    previewId: 'e2e-decision-88',
    promptVersion: 'e2e',
    sourceKind: 'reference',
    createdAt: '2026-06-15T00:00:00.000Z',
    document: {
      id: 'ls-10',
      title: 'Решение № 88 от 3 ноября 2016 года',
      domain: 'LS',
      fileName: '10. Решение № 88 от 3 ноября 2016 года.docx',
      number: '88',
      date: '03.11.2016',
      sectionsTotal: 3,
      payloadChars: 12000,
      sampleSections: [
        {
          id: 'sample-1',
          type: 'point',
          number: '1',
          title: 'ОХЛП',
          text: 'Требования к общей характеристике лекарственного препарата.',
        },
      ],
    },
    extraction: {
      area: 'LS',
      act: { number: '88' },
      procedures: ['registration'],
      document_types: [
        {
          code: 'spc',
          name: 'Проект ОХЛП',
          procedure: 'registration',
          requiredness: 'required',
          applicability_condition: 'Если предоставляется ОХЛП',
          source_point: 'Решение №88, раздел ОХЛП',
          quote: 'Проект ОХЛП предоставляется по установленной структуре.',
        },
      ],
      requirements: [
        {
          document_code: 'spc',
          document_name: 'Проект ОХЛП',
          procedure: 'registration',
          check_type: 'структура / формат',
          requirement_text: 'Проект ОХЛП должен быть представлен в структурированном формате и содержать обязательные разделы.',
          criticality: 'serious',
          applicability_condition: 'Если заявитель предоставляет ОХЛП.',
          source_point: 'Решение №88, раздел ОХЛП',
          quote: 'Проект ОХЛП предоставляется по установленной структуре.',
        },
      ],
      change_types: [],
      applicant_parameters: [],
      parameter_groups: [],
      parameter_dependencies: [],
      quality_notes: [],
      meta: {},
    },
    summary: {
      area: 'LS',
      procedures: ['registration'],
      document_types: 1,
      requirements: 1,
      applicant_parameters: 0,
      parameter_groups: 0,
      parameter_dependencies: 0,
      change_types: 0,
    },
  };
}
