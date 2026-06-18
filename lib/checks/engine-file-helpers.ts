import { Application, Finding, UploadedFile } from '@/lib/types';
import { DossierSectionDefinition } from '@/lib/dossier/sections';
import { createFinding, extract, getDocName, normalize, normalizeLoose, stringValue } from '@/lib/checks/engine-utils';

export function halfPointsToPt(val: string): number | null {
  const n = parseInt(val, 10);
  if (isNaN(n)) return null;
  return n / 2;
}

export function isTimesNewRoman(font: string): boolean {
  return /times\s*new\s*roman|tnr/i.test(font);
}

export function checkDocxFormatting(
  file: UploadedFile,
  docLabel: string,
  findings: Finding[],
  npaReference: string
) {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext !== 'docx') {
    findings.push(
      createFinding(
        'warning',
        'Оформление',
        `Автоматическая проверка шрифта для «${docLabel}» недоступна`,
        'Формат файла не DOCX. Проверка шрифта, размера и цвета по Решению №88 выполняется вручную.',
        [docLabel],
        'Для автоматической проверки оформления предоставьте DOCX-версию документа.',
        undefined,
        npaReference
      )
    );
    return;
  }

  const fontsRaw = extract(file, 'fonts');
  const sizesRaw = extract(file, 'sizes');
  const colorsRaw = extract(file, 'colors');

  if (!fontsRaw && !sizesRaw && !colorsRaw) {
    findings.push(
      createFinding(
        'warning',
        'Оформление',
        `Не удалось извлечь параметры шрифта для «${docLabel}»`,
        'Не удалось определить шрифт, размер или цвет из DOCX.',
        [docLabel],
        'Проверьте оформление документа вручную или перезагрузите файл.',
        undefined,
        npaReference
      )
    );
    return;
  }

  const fonts = fontsRaw?.split(',').map((s) => s.trim()).filter(Boolean) || [];
  if (fonts.length > 0 && !fonts.some(isTimesNewRoman)) {
    findings.push(
      createFinding(
        'warning',
        'Оформление',
        `Шрифт в «${docLabel}» отличается от Times New Roman`,
        `Обнаруженные шрифты: ${fonts.join(', ')}. Решение №88 рекомендует Times New Roman 12 пт.`,
        [docLabel],
        'Приведите шрифт документа к Times New Roman.',
        [{ source: docLabel, text: fonts.join(', ') }],
        npaReference
      )
    );
  }

  const sizes = sizesRaw?.split(',').map((s) => s.trim()).filter(Boolean) || [];
  const bodySizes = sizes.map(halfPointsToPt).filter((n): n is number => n !== null);
  if (bodySizes.length > 0 && bodySizes.some((s) => s !== 12)) {
    findings.push(
      createFinding(
        'warning',
        'Оформление',
        `Размер шрифта в «${docLabel}» отличается от 12 пт`,
        `Обнаружены размеры: ${bodySizes.join(', ')} пт. Основной текст должен быть 12 пт.`,
        [docLabel],
        'Приведите основной текст документа к размеру 12 пт.',
        [{ source: docLabel, text: bodySizes.join(', ') + ' пт' }],
        npaReference
      )
    );
  }

  const colors = colorsRaw?.split(',').map((s) => s.trim()).filter(Boolean) || [];
  if (colors.length > 0 && !colors.includes('000000')) {
    findings.push(
      createFinding(
        'warning',
        'Оформление',
        `Цвет текста в «${docLabel}» отличается от чёрного`,
        `Обнаружены цвета: ${colors.join(', ')}. Текст должен быть чёрным (000000).`,
        [docLabel],
        'Используйте чёрный цвет для основного текста.',
        [{ source: docLabel, text: colors.join(', ') }],
        npaReference
      )
    );
  }
}

export const SPC_REQUIRED_SECTIONS = [
  { keyword: 'состав', label: 'состав' },
  { keyword: 'показани', label: 'показания к применению' },
  { keyword: 'противопоказани', label: 'противопоказания' },
  { keyword: 'дозировк', label: 'дозировка' },
  { keyword: 'побочн', label: 'побочные действия' },
  { keyword: 'срок годности', label: 'срок годности' },
  { keyword: 'условия хранения', label: 'условия хранения' },
];

export const INSTRUCTION_REQUIRED_SECTIONS = [
  ...SPC_REQUIRED_SECTIONS,
  { keyword: 'передозировк', label: 'передозировка' },
  { keyword: 'взаимодействие', label: 'взаимодействие' },
];

export function checkRequiredSections(
  file: UploadedFile,
  docLabel: string,
  sections: { keyword: string; label: string }[],
  findings: Finding[],
  npaReference: string
) {
  const text = extract(file, 'textContent') || '';
  if (!text) return;
  const missing = sections
    .filter((s) => !normalize(text).includes(normalize(s.keyword)))
    .map((s) => s.label);
  if (missing.length > 0) {
    findings.push(
      createFinding(
        'warning',
        'Структура документа',
        `В «${docLabel}» не найдены обязательные разделы`,
        `Отсутствуют разделы: ${missing.join(', ')}.`,
        [docLabel],
        'Добавьте недостающие разделы в соответствии с требованиями Решения №88.',
        [{ source: docLabel, text: text.slice(0, 200) }],
        npaReference
      )
    );
  }
}

export function checkBlackTriangle(
  file: UploadedFile,
  docLabel: string,
  findings: Finding[],
  npaReference: string
) {
  const hasFlag = extract(file, 'hasBlackTriangle');
  const text = extract(file, 'textContent') || '';
  const hasSymbol = /▼|черн.*треугольник|дополнительный мониторинг/i.test(text);
  const confirmed = normalize(hasFlag) === 'да' || hasSymbol;
  if (!confirmed) {
    findings.push(
      createFinding(
        'serious',
        'Фармаконадзор',
        `В «${docLabel}» отсутствует отметка о дополнительном мониторинге`,
        'Препарат отмечен как требующий дополнительного мониторинга безопасности, но в инструкции не найден чёрный перевернутый треугольник и пояснение.',
        [docLabel],
        'Добавьте в инструкцию символ дополнительного мониторинга и пояснение.',
        [{ source: docLabel, text: text.slice(0, 200) }],
        npaReference
      )
    );
  }
}

export function fileEvidenceText(file: UploadedFile): string {
  const extractedText = Object.values(file.extracted || {}).join(' ');
  return normalizeLoose([
    file.name,
    file.originalName,
    file.relativePath,
    file.dossierFolderName,
    file.dossierSectionName,
    file.dossierSectionCode,
    file.documentTypeId,
    file.dossierSectionId,
    extractedText,
  ].filter(Boolean).join(' '));
}

export function normalizeCtdCode(value: unknown): string {
  return String(value || '')
    .toUpperCase()
    .replace(/Р/g, 'P')
    .replace(/\s+/g, '')
    .replace(/\.$/, '');
}

export function fileMatchesDossierSection(file: UploadedFile, section: DossierSectionDefinition): boolean {
  if (file.dossierSectionId === section.id || file.documentTypeId === section.documentTypeId) return true;

  const code = normalizeCtdCode(file.dossierSectionCode);
  const evidence = fileEvidenceText(file);

  if (section.keywords.some((keyword) => evidence.includes(normalizeLoose(keyword)))) return true;

  switch (section.id) {
    case 'ls-country-registration':
      return ['1.2.1', '1.2.3'].some((prefix) => code.startsWith(prefix));
    case 'ls-gmp-manufacturing':
      return ['2.3.P.3', '3.2.P.3'].some((prefix) => code.startsWith(prefix)) ||
        hasAnyEvidence(evidence, ['gmp', 'производител', 'производств', 'площадк']);
    case 'ls-labeling-spc-instruction':
      return ['1.3.3', '1.3.4'].some((prefix) => code.startsWith(prefix)) ||
        ['doc-spc-ru', 'doc-spc-kz', 'doc-instruction-ru', 'doc-instruction-kz', 'doc-labeling-text'].includes(file.documentTypeId);
    case 'ls-mockups':
      return code.startsWith('1.3.5') || file.documentTypeId === 'doc-mockup';
    case 'ls-quality-module3':
      return code.startsWith('2.3') || code.startsWith('3.2') ||
        ['doc-module3', 'doc-quality-nd'].includes(file.documentTypeId);
    case 'ls-stability':
      return ['2.3.P.8', '2.3.S.7', '3.2.P.8', '3.2.S.7'].some((prefix) => code.startsWith(prefix)) ||
        ['doc-stability'].includes(file.documentTypeId);
    case 'ls-pharmacovigilance':
      return code.startsWith('1.6') ||
        ['doc-pharmacovigilance-master', 'doc-pharmacovigilance-contact', 'doc-risk-management'].includes(file.documentTypeId);
    case 'ls-comparison':
      return code.startsWith('1.3.6') || code.startsWith('1.3.7') || file.documentTypeId === 'doc-spc-comparison';
    default:
      return false;
  }
}

export function hasAnyEvidence(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(normalizeLoose(keyword)));
}

export function getModule3EvidenceFiles(app: Application): UploadedFile[] {
  return app.files.filter((file) => {
    const code = normalizeCtdCode(file.dossierSectionCode);
    return file.documentTypeId === 'doc-module3' ||
      file.documentTypeId === 'doc-quality-nd' ||
      file.documentTypeId === 'doc-stability' ||
      file.documentTypeId.startsWith('new-ls-appendix-3-') ||
      file.documentTypeId.startsWith('memo-ls-') ||
      file.dossierSectionId === 'ls-quality-module3' ||
      file.dossierSectionId === 'ls-stability' ||
      code.startsWith('2.3') ||
      code.startsWith('3.2');
  });
}

export function hasModule3Evidence(app: Application, kind: 'specification' | 'validation' | 'stability' | 'sterility'): boolean {
  const files = getModule3EvidenceFiles(app);

  if (kind === 'specification') {
    return files.some((file) =>
      file.documentTypeId === 'doc-quality-nd' ||
      hasAnyEvidence(fileEvidenceText(file), ['спецификац', 'specification', '3.2.p.5', '3.2.р.5', 'нд'])
    );
  }

  if (kind === 'validation') {
    return files.some((file) => hasAnyEvidence(fileEvidenceText(file), ['валидац', 'validation', 'методик', 'method validation']));
  }

  if (kind === 'stability') {
    return files.some((file) =>
      file.documentTypeId === 'doc-stability' ||
      file.dossierSectionId === 'ls-stability' ||
      hasAnyEvidence(fileEvidenceText(file), ['стабил', 'stability', 'срок годности', 'shelf life'])
    );
  }

  return files.some((file) => hasAnyEvidence(fileEvidenceText(file), ['стерил', 'стерильн', 'steril', 'асепт', 'asept'])) ||
    (app.values['param-sterile'] === 'yes' && hasModule3Evidence(app, 'validation'));
}
