import { UploadedFile } from '@/lib/types';

const uploadedAt = '2026-06-15T09:00:00.000Z';
const demoBase = '/test-docs';
const tradeName = 'Парацетамол-Тева';
const inn = 'Парацетамол';
const dosage = '500 мг';
const dosageForm = 'Таблетки';
const manufacturer = 'Teva Pharmaceutical Industries Ltd.';
const manufacturerAddress = 'Ул. Производственная, 10, Венгрия';
const applicant = 'ООО «Тева Казахстан»';
const holder = 'ООО «Тева Казахстан»';
const shelfLife = '24 месяца';
const storage = 'Хранить при температуре не выше 25 °C.';

const spcText = [
  'ОХЛП. Парацетамол-Тева 500 мг, таблетки.',
  'Состав: 1 таблетка содержит парацетамол 500 мг и вспомогательные вещества согласно нормативному документу по качеству.',
  'Показания к применению: симптоматическое лечение боли и лихорадки.',
  'Противопоказания: гиперчувствительность к парацетамолу или компонентам препарата.',
  'Дозировка: взрослым и детям старше 12 лет по 500 мг при необходимости.',
  'Побочные действия: аллергические реакции, тошнота, нарушения функции печени при превышении дозы.',
  `Срок годности: ${shelfLife}.`,
  `Условия хранения: ${storage}`,
  `Производитель: ${manufacturer}, ${manufacturerAddress}.`,
].join('\n');

const instructionText = [
  'Инструкция / листок-вкладыш. Парацетамол-Тева 500 мг, таблетки.',
  'Состав: 1 таблетка содержит парацетамол 500 мг.',
  'Показания к применению: боль слабой и умеренной интенсивности, лихорадочный синдром.',
  'Противопоказания: индивидуальная непереносимость, выраженные нарушения функции печени.',
  'Дозировка: применять внутрь, запивая водой; максимальную суточную дозу не превышать.',
  'Побочные действия: кожная сыпь, зуд, тошнота, повышение активности печеночных ферментов.',
  'Передозировка: при подозрении на передозировку немедленно обратиться за медицинской помощью.',
  'Взаимодействие: осторожность при совместном применении с антикоагулянтами и гепатотоксичными средствами.',
  `Срок годности: ${shelfLife}.`,
  `Условия хранения: ${storage}`,
].join('\n');

const kzText = [
  'Парацетамол-Тева 500 мг таблеткалары.',
  'Құрамы: бір таблетка құрамында 500 мг парацетамол бар.',
  'Қолданылуы: ауырсыну және қызба кезінде симптоматикалық ем.',
  'Қарсы көрсетілімдері: парацетамолға жоғары сезімталдық.',
  'Дозалануы: нұсқаулыққа сәйкес ішке қабылданады.',
  `Жарамдылық мерзімі: ${shelfLife}.`,
  `Сақтау шарттары: ${storage}`,
].join('\n');

function file(
  name: string,
  documentTypeId: string,
  contentType: string,
  extracted: Record<string, string> = {},
  size = 24576,
): Omit<UploadedFile, 'id'> {
  const extension = name.split('.').pop()?.toLowerCase() || '';
  return {
    name,
    documentTypeId,
    contentType,
    size,
    url: `${demoBase}/${name}`,
    hash: `demo-${documentTypeId}-${extension}`,
    extension,
    mime: contentType,
    uploadedAt,
    version: 1,
    textLayer: true,
    ocrQuality: 0.98,
    processing: {
      ocrStatus: 'success',
      extractionStatus: 'success',
      provider: 'demo-fixture',
      parser: extension === 'docx' ? 'docx-parser' : extension === 'xlsx' ? 'xlsx-parser' : 'text-layer',
      promptVersion: 'demo-registration-ls-v1',
      startedAt: uploadedAt,
      finishedAt: uploadedAt,
      textLayer: true,
      ocrQuality: 0.98,
    },
    extracted,
  };
}

const commonProductFields = {
  tradeName,
  inn,
  dosage,
  dosageForm,
  manufacturer,
};

export type DemoScenario = 'ideal' | 'missing-gmp' | 'expired-cpp' | 'field-mismatch' | 'bad-docx-format';

export const demoScenarioLabels: Record<DemoScenario, string> = {
  ideal: 'Эталонная заявка',
  'missing-gmp': 'Нет GMP',
  'expired-cpp': 'Просроченный CPP',
  'field-mismatch': 'Расхождение полей',
  'bad-docx-format': 'Неверное оформление DOCX',
};

export const demoFiles: Omit<UploadedFile, 'id'>[] = [
  file('application_ls_registration.docx', 'doc-application', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', {
    ...commonProductFields,
    manufacturerAddress,
    applicant,
    holder,
    fonts: 'Times New Roman',
    sizes: '24',
    colors: '000000',
    textContent: `Заявление на экспертизу ЛС. ${tradeName}, ${inn}, ${dosage}, ${dosageForm}. Заявитель: ${applicant}. Производитель: ${manufacturer}, ${manufacturerAddress}.`,
  }),
  file('payment_order.pdf', 'doc-payment', 'application/pdf', {
    payer: applicant,
    contractNumber: 'EX-2026-001',
    paid: 'да',
  }),
  file('cover_letter.docx', 'doc-cover-letter', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', {
    applicant,
    subject: `Регистрация лекарственного средства ${tradeName}`,
    fonts: 'Times New Roman',
    sizes: '24',
    colors: '000000',
  }),
  file('registration_dossier_module_1_5.pdf', 'doc-registration-dossier', 'application/pdf', {
    dossierFormat: 'ОТД/CTD, модули 1-5',
    complete: 'да',
  }),
  file('samples_statement.pdf', 'doc-samples', 'application/pdf', {
    samplesProvided: 'да',
    batches: 'PTV-001, PTV-002',
  }),
  file('cpp_hungary.pdf', 'doc-cpp', 'application/pdf', {
    country: 'Венгрия',
    issueDate: '01.02.2026',
    validUntil: '31.12.2028',
  }),
  file('gmp_certificate_hungary.pdf', 'doc-gmp', 'application/pdf', {
    manufacturer,
    address: manufacturerAddress,
    validUntil: '31.12.2028',
    scope: 'Таблетки; производство, упаковка, выпуск серии и контроль качества.',
  }),
  file('foreign_registrations.pdf', 'doc-foreign-registrations', 'application/pdf', {
    countries: 'Венгрия, Казахстан, Польша, Румыния',
  }),
  file('trademark_certificate.pdf', 'doc-trademark', 'application/pdf', {
    tradeName,
    certificateNumber: 'TM-2026-PTV',
    validUntil: '31.12.2036',
  }),
  file('spc_ru.docx', 'doc-spc-ru', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', {
    ...commonProductFields,
    address: manufacturerAddress,
    shelfLife,
    storage,
    textContent: spcText,
    textLength: '1350',
    fonts: 'Times New Roman',
    sizes: '24',
    colors: '000000',
  }),
  file('spc_kz.docx', 'doc-spc-kz', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', {
    textContent: kzText,
    textLength: '1280',
    fonts: 'Times New Roman',
    sizes: '24',
    colors: '000000',
  }),
  file('instruction_ru.docx', 'doc-instruction-ru', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', {
    ...commonProductFields,
    shelfLife,
    storage,
    hasBlackTriangle: 'нет',
    textContent: instructionText,
    textLength: '1490',
    fonts: 'Times New Roman',
    sizes: '24',
    colors: '000000',
  }),
  file('instruction_kz.docx', 'doc-instruction-kz', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', {
    textContent: `${kzText}\nАртық дозалану және өзара әрекеттесу бөлімдері нұсқаулықта берілген.`,
    textLength: '1420',
    fonts: 'Times New Roman',
    sizes: '24',
    colors: '000000',
  }),
  file('labeling_text.docx', 'doc-labeling-text', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', {
    textContent: `${tradeName}\n${inn} ${dosage}\n${dosageForm}\n${storage}\nСрок годности: ${shelfLife}`,
    fonts: 'Times New Roman',
    sizes: '24',
    colors: '000000',
  }),
  file('mockup_correct.png', 'doc-mockup', 'image/png', {
    tradeName,
    dosage,
    shelfLife,
    storage,
  }, 13991),
  file('quality_specification.xlsx', 'doc-quality-nd', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', {
    tradeName,
    dosage,
    shelfLife,
    storage,
    specification: 'Спецификация, методики контроля, критерии приемлемости',
  }),
  file('module3_quality.pdf', 'doc-module3', 'application/pdf', {
    hasSpecification: 'да',
    hasValidation: 'да',
    hasStability: 'да',
  }),
  file('stability_data.pdf', 'doc-stability', 'application/pdf', {
    shelfLife,
    storage,
    conclusion: 'Стабильность подтверждает заявленный срок годности 24 месяца.',
  }),
  file('bioequivalence_report.pdf', 'doc-bioequivalence-report', 'application/pdf', {
    referenceProduct: 'Панадол 500 мг таблетки',
    dosage,
    dosageForm,
    manufacturer,
    conclusion: 'Биоэквивалентность подтверждена, результаты положительные.',
  }),
  file('generic_summary.pdf', 'doc-generic-summary', 'application/pdf', {
    referenceProduct: 'Панадол 500 мг таблетки',
    conclusion: 'Воспроизведенный препарат обоснован по составу, качеству и биоэквивалентности.',
  }),
  file('spc_instruction_comparison.pdf', 'doc-spc-comparison', 'application/pdf', {
    referenceProduct: 'Панадол 500 мг таблетки',
    comparisonComplete: 'да',
  }),
];


export function createDemoFiles(scenario: DemoScenario = 'ideal'): Omit<UploadedFile, 'id'>[] {
  const files = demoFiles.map((item) => ({
    ...item,
    extracted: { ...(item.extracted || {}) },
    processing: item.processing ? { ...item.processing } : undefined,
  }));

  if (scenario === 'missing-gmp') {
    return files.filter((item) => item.documentTypeId !== 'doc-gmp');
  }

  if (scenario === 'expired-cpp') {
    const cpp = files.find((item) => item.documentTypeId === 'doc-cpp');
    if (cpp) {
      cpp.extracted = { ...(cpp.extracted || {}), validUntil: '31.12.2024' };
    }
  }

  if (scenario === 'field-mismatch') {
    const instruction = files.find((item) => item.documentTypeId === 'doc-instruction-ru');
    const mockup = files.find((item) => item.documentTypeId === 'doc-mockup');
    if (instruction) {
      instruction.extracted = {
        ...(instruction.extracted || {}),
        shelfLife: '36 месяцев',
        storage: 'Хранить при температуре от 15 до 30 °C.',
      };
    }
    if (mockup) {
      mockup.extracted = {
        ...(mockup.extracted || {}),
        storage: 'Хранить в защищенном от света месте.',
      };
    }
  }

  if (scenario === 'bad-docx-format') {
    const spc = files.find((item) => item.documentTypeId === 'doc-spc-ru');
    if (spc) {
      spc.extracted = {
        ...(spc.extracted || {}),
        fonts: 'Arial',
        sizes: '22',
        colors: 'FF0000',
      };
    }
  }

  return files;
}
