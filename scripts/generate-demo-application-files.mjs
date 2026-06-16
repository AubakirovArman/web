import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';

const outDir = path.join(process.cwd(), 'public', 'test-docs');
const tradeName = 'Парацетамол-Тева';
const inn = 'Парацетамол';
const dosage = '500 мг';
const manufacturer = 'Teva Pharmaceutical Industries Ltd.';
const manufacturerAddress = 'Ул. Производственная, 10, Венгрия';
const applicant = 'ООО «Тева Казахстан»';
const shelfLife = '24 месяца';
const storage = 'Хранить при температуре не выше 25 °C.';

const texts = {
  'application_ls_registration.docx': [
    'Заявление на проведение экспертизы лекарственного средства',
    `Тип процедуры: регистрация. Торговое наименование: ${tradeName}.`,
    `МНН: ${inn}. Лекарственная форма: таблетки. Дозировка: ${dosage}.`,
    `Производитель: ${manufacturer}. Адрес площадки: ${manufacturerAddress}.`,
    `Заявитель и держатель РУ: ${applicant}.`,
    'Заявитель подтверждает достоверность сведений и выполнение пострегистрационных обязательств.',
    'Тестовая подпись: /s/ Authorized Applicant. Тестовая печать: DEMO.',
  ].join('\n'),
  'cover_letter.docx': [
    'Сопроводительное письмо',
    `${applicant} направляет комплект документов для регистрации лекарственного средства ${tradeName}.`,
    'Приложены заявление, регистрационное досье, ОХЛП, инструкция, сертификаты, макеты и документы по качеству.',
    'Тестовая подпись: /s/ Regulatory Affairs Manager.',
  ].join('\n'),
  'spc_ru.docx': [
    `ОХЛП. ${tradeName} ${dosage}, таблетки.`,
    `Состав: 1 таблетка содержит ${inn.toLowerCase()} ${dosage} и вспомогательные вещества согласно нормативному документу по качеству.`,
    'Показания к применению: симптоматическое лечение боли и лихорадки.',
    'Противопоказания: гиперчувствительность к парацетамолу или компонентам препарата.',
    'Дозировка: взрослым и детям старше 12 лет по 500 мг при необходимости.',
    'Побочные действия: аллергические реакции, тошнота, нарушения функции печени при превышении дозы.',
    `Срок годности: ${shelfLife}.`,
    `Условия хранения: ${storage}`,
    `Производитель: ${manufacturer}, ${manufacturerAddress}.`,
  ].join('\n'),
  'spc_kz.docx': [
    `${tradeName} ${dosage} таблеткалары.`,
    'Құрамы: бір таблетка құрамында 500 мг парацетамол бар.',
    'Қолданылуы: ауырсыну және қызба кезінде симптоматикалық ем.',
    'Қарсы көрсетілімдері: парацетамолға жоғары сезімталдық.',
    'Дозалануы: нұсқаулыққа сәйкес ішке қабылданады.',
    `Жарамдылық мерзімі: ${shelfLife}.`,
    `Сақтау шарттары: ${storage}`,
  ].join('\n'),
  'instruction_ru.docx': [
    `Инструкция / листок-вкладыш. ${tradeName} ${dosage}, таблетки.`,
    `Состав: 1 таблетка содержит ${inn.toLowerCase()} ${dosage}.`,
    'Показания к применению: боль слабой и умеренной интенсивности, лихорадочный синдром.',
    'Противопоказания: индивидуальная неперененосимость, выраженные нарушения функции печени.',
    'Дозировка: применять внутрь, запивая водой; максимальную суточную дозу не превышать.',
    'Побочные действия: кожная сыпь, зуд, тошнота, повышение активности печеночных ферментов.',
    'Передозировка: при подозрении на передозировку немедленно обратиться за медицинской помощью.',
    'Взаимодействие: осторожность при совместном применении с антикоагулянтами и гепатотоксичными средствами.',
    `Срок годности: ${shelfLife}.`,
    `Условия хранения: ${storage}`,
  ].join('\n'),
  'instruction_kz.docx': [
    `${tradeName} ${dosage} таблеткалары бойынша қолдану жөніндегі нұсқаулық.`,
    'Құрамы: бір таблетка құрамында 500 мг парацетамол бар.',
    'Қолданылуы: ауырсыну және қызба кезінде симптоматикалық ем.',
    'Қарсы көрсетілімдері: парацетамолға жоғары сезімталдық.',
    'Дозалануы: нұсқаулыққа сәйкес ішке қабылданады.',
    'Артық дозалану: дереу медициналық көмекке жүгіну қажет.',
    'Өзара әрекеттесу: антикоагулянттармен қолданғанда сақ болу керек.',
    `Жарамдылық мерзімі: ${shelfLife}.`,
    `Сақтау шарттары: ${storage}`,
  ].join('\n'),
  'labeling_text.docx': [
    tradeName,
    `${inn} ${dosage}`,
    'Таблетки. 20 таблеток.',
    `Срок годности: ${shelfLife}.`,
    `Условия хранения: ${storage}`,
    'Производитель: Teva Pharmaceutical Industries Ltd.',
  ].join('\n'),
};

const pdfTexts = {
  'payment_order.pdf': `Платежный документ. Плательщик: ${applicant}. Договор EX-2026-001. Оплата проведена.`,
  'registration_dossier_module_1_5.pdf': 'Регистрационное досье ОТД/CTD. Модуль 1. Административные сведения. Модуль 2. Резюме. Модуль 3. Качество. Модуль 4. Доклинические данные. Модуль 5. Клинические данные.',
  'samples_statement.pdf': 'Письмо о предоставлении образцов препарата, стандартных образцов и реагентов для лабораторных испытаний. Серии PTV-001 и PTV-002.',
  'cpp_hungary.pdf': `CPP. Country: Hungary / Венгрия. Product: ${tradeName}. Issue date: 01.02.2026. Valid until: 31.12.2028.`,
  'gmp_certificate_hungary.pdf': `GMP certificate. Manufacturer: ${manufacturer}. Site address: ${manufacturerAddress}. Scope: Таблетки; производство, упаковка, выпуск серии и контроль качества. Valid until: 31.12.2028.`,
  'foreign_registrations.pdf': 'Сведения о регистрациях: Венгрия HU-12345, Казахстан KZ-DEMO-2026, Польша PL-2222, Румыния RO-3333.',
  'trademark_certificate.pdf': `Охранный документ на товарный знак ${tradeName}. Номер TM-2026-PTV. Действует до 31.12.2036.`,
  'module3_quality.pdf': 'Модуль 3. Качество. Спецификация: да. Валидация методов: да. Данные стабильности: да. Производство таблеток подтверждено.',
  'stability_data.pdf': `Данные по стабильности. Срок годности: ${shelfLife}. Условия хранения: ${storage} Заключение: стабильность подтверждена.`,
  'bioequivalence_report.pdf': 'Отчет биоэквивалентности. Reference product: Панадол 500 мг таблетки. Dosage: 500 мг. Dosage form: Таблетки. Conclusion: Биоэквивалентность подтверждена, результаты положительные.',
  'generic_summary.pdf': 'Резюме обоснования воспроизведенного препарата. Референтный препарат: Панадол 500 мг таблетки. Обоснование по составу, качеству и биоэквивалентности предоставлено.',
  'spc_instruction_comparison.pdf': 'Построчное сравнение ОХЛП и инструкции с референтным препаратом. Отличия выделены и обоснованы. Сравнение завершено.',
};

function xmlEscape(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function pdfEscape(value) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

async function writeDocx(fileName, text) {
  const zip = new JSZip();
  const paragraphs = text.split('\n').map((line) => `<w:p><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="24"/><w:color w:val="000000"/></w:rPr><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`).join('');
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.folder('_rels').file('.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.folder('word').file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`);
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(path.join(outDir, fileName), buffer);
  await fs.writeFile(path.join(outDir, `${fileName}.txt`), text, 'utf8');
}

async function writeXlsx(fileName) {
  const zip = new JSZip();
  const rows = [
    ['Показатель', 'Спецификация', 'Метод'],
    ['Торговое наименование', tradeName, 'Сверка с заявлением'],
    ['Дозировка', dosage, 'Сверка с ОХЛП'],
    ['Срок годности', shelfLife, 'Данные стабильности'],
    ['Условия хранения', storage, 'Данные стабильности'],
  ];
  const sheetRows = rows.map((row, rIndex) => `<row r="${rIndex + 1}">${row.map((cell, cIndex) => `<c r="${String.fromCharCode(65 + cIndex)}${rIndex + 1}" t="inlineStr"><is><t>${xmlEscape(cell)}</t></is></c>`).join('')}</row>`).join('');
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  zip.folder('_rels').file('.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.folder('xl').file('workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Specification" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.folder('xl').folder('_rels').file('workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  zip.folder('xl').folder('worksheets').file('sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`);
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(path.join(outDir, fileName), buffer);
  await fs.writeFile(path.join(outDir, `${fileName}.txt`), rows.map((row) => row.join('\t')).join('\n'), 'utf8');
}

function buildPdf(text) {
  const chunks = text.replace(/[^\x20-\x7E]+/g, ' ').match(/.{1,80}/g) || ['Demo PDF'];
  const latinLines = ['NDDA AI demo PDF fixture', 'Full Cyrillic text is stored in sidecar TXT.', ...chunks.slice(0, 8)];
  const content = `BT /F1 11 Tf 72 760 Td ${latinLines.map((line, index) => `${index === 0 ? '' : '0 -18 Td '}(${pdfEscape(line)}) Tj`).join(' ')} ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

async function writePdf(fileName, text) {
  await fs.writeFile(path.join(outDir, fileName), buildPdf(text));
  await fs.writeFile(path.join(outDir, `${fileName}.txt`), text, 'utf8');
}

async function ensurePng(fileName) {
  const target = path.join(outDir, fileName);
  try {
    await fs.access(target);
  } catch {
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFhQJ/wV9Z5wAAAABJRU5ErkJggg==';
    await fs.writeFile(target, Buffer.from(pngBase64, 'base64'));
  }
}

await fs.mkdir(outDir, { recursive: true });
await Promise.all(Object.entries(texts).map(([fileName, text]) => writeDocx(fileName, text)));
await Promise.all(Object.entries(pdfTexts).map(([fileName, text]) => writePdf(fileName, text)));
await writeXlsx('quality_specification.xlsx');
await ensurePng('mockup_correct.png');
console.log(`Generated demo application files in ${outDir}`);
