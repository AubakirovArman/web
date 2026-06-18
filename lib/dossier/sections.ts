import { ObjectType, Procedure } from '@/lib/types';

export interface DossierSectionDefinition {
  id: string;
  objectType: ObjectType;
  code: string;
  title: string;
  description: string;
  documentTypeId: string;
  requiredFor: Procedure[];
  npaReference: string;
  keywords: string[];
}

export interface DossierSectionGuess {
  section: DossierSectionDefinition;
  documentTypeId: string;
  confidence: number;
  reason: string;
}

import { lsSections, miSections } from '@/lib/dossier/section-definitions';

export const dossierSections: DossierSectionDefinition[] = [...lsSections, ...miSections];

export function getDossierSections(objectType: ObjectType): DossierSectionDefinition[] {
  return dossierSections.filter((section) => section.objectType === objectType);
}

export function getDossierSectionById(id: string | undefined): DossierSectionDefinition | undefined {
  if (!id) return undefined;
  return dossierSections.find((section) => section.id === id);
}

export function getRequiredDossierSections(objectType: ObjectType, procedure: Procedure): DossierSectionDefinition[] {
  return getDossierSections(objectType).filter((section) => section.requiredFor.includes(procedure));
}

export function guessDossierSection(objectType: ObjectType, text: string, fileName = ''): DossierSectionGuess {
  const sections = getDossierSections(objectType);
  const normalized = normalize(text);
  const normalizedFileName = normalize(fileName);
  let best = sections.find((section) => section.id.endsWith('other')) || sections[sections.length - 1];
  let bestScore = 0;
  let matchedKeywords: string[] = [];

  for (const section of sections) {
    if (section.id.endsWith('other')) continue;
    const matches = section.keywords.filter((keyword) => normalized.includes(normalize(keyword)));
    const codeMatch = section.code && normalized.includes(normalize(section.code));
    const score = matches.length * 2 + (codeMatch ? 1 : 0);
    if (score > bestScore) {
      best = section;
      bestScore = score;
      matchedKeywords = matches;
    }
  }

  const documentTypeId = overrideDocumentType(objectType, best.documentTypeId, normalized, normalizedFileName);
  const confidence = bestScore === 0 ? 0.25 : Math.min(0.95, 0.45 + bestScore * 0.12);
  const reason = matchedKeywords.length
    ? `Совпали признаки: ${matchedKeywords.slice(0, 4).join(', ')}`
    : 'Автоматически отнесено в прочие материалы, нужна ручная проверка';

  return { section: best, documentTypeId, confidence, reason };
}

function overrideDocumentType(objectType: ObjectType, fallback: string, normalizedText: string, normalizedFileName = '') {
  if (objectType === 'LS') {
    if (hasAny(normalizedFileName, ['сравнен', 'построч', 'таблиц'])) return 'doc-spc-comparison';
    if (hasAny(normalizedFileName, ['охлп', 'охлс', 'общая характеристика', 'spc'])) {
      return isKazakhText(normalizedFileName) ? 'doc-spc-kz' : 'doc-spc-ru';
    }
    if (hasAny(normalizedFileName, ['инструкц', 'листок', 'вкладыш', 'имп ', ' лв '])) {
      return isKazakhText(normalizedFileName) ? 'doc-instruction-kz' : 'doc-instruction-ru';
    }
    if (hasAny(normalizedFileName, ['маркиров', 'label'])) return 'doc-labeling-text';
    if (hasAny(normalizedFileName, ['макет', 'mockup', 'jpg', 'jpeg', 'png'])) return 'doc-mockup';

    if (hasAny(normalizedText, ['заявлен', 'application'])) return 'doc-application';
    if (hasAny(normalizedText, ['оплат', 'платеж', 'payment', 'квитанц'])) return 'doc-payment';
    if (hasAny(normalizedText, ['сопровод', 'cover', 'письм'])) return 'doc-cover-letter';
    if (hasAny(normalizedText, ['сравнен', 'построч', 'таблиц'])) return 'doc-spc-comparison';
    if (hasAny(normalizedText, ['охлп', 'охлс', 'общая характеристика', 'spc'])) {
      return isKazakhText(normalizedText) ? 'doc-spc-kz' : 'doc-spc-ru';
    }
    if (hasAny(normalizedText, ['инструкц', 'листок', 'вкладыш', 'имп ', ' лв '])) {
      return isKazakhText(normalizedText) ? 'doc-instruction-kz' : 'doc-instruction-ru';
    }
    if (hasAny(normalizedText, ['маркиров', 'label'])) return 'doc-labeling-text';
    if (hasAny(normalizedText, ['макет', 'mockup', 'jpg', 'jpeg', 'png'])) return 'doc-mockup';
    if (hasAny(normalizedText, ['норматив', 'спецификац', 'методик'])) return 'doc-quality-nd';
    if (hasAny(normalizedText, ['стабил', 'срок годности', 'хранен'])) return 'doc-stability';
    if (hasAny(normalizedText, ['фармаконадзор', 'psmf'])) return 'doc-pharmacovigilance-master';
    if (hasAny(normalizedText, ['gmp'])) return 'doc-gmp';
    if (hasAny(normalizedText, ['cpp', 'free sale', 'фармацевтического продукта'])) return 'doc-cpp';
    if (hasAny(normalizedText, ['образц', 'sample'])) return 'doc-samples';
    return fallback;
  }

  if (objectType === 'MI') {
    if (hasAny(normalizedFileName, ['заявлен', 'application'])) return 'doc-mi-application';
    if (hasAny(normalizedFileName, ['оплат', 'платеж', 'payment', 'квитанц'])) return 'doc-mi-payment';
    if (hasAny(normalizedFileName, ['сопровод', 'cover', 'письм'])) return 'doc-mi-cover-letter';
    if (hasAny(normalizedFileName, ['биолог', 'токсик', 'biocompat', 'биосовмест'])) return 'doc-mi-biological-studies';
    if (hasAny(normalizedFileName, ['клиничес', 'clinical', 'лаборатор'])) return 'doc-mi-clinical-trials';
    if (hasAny(normalizedFileName, ['инструкц', 'эксплуатац', 'руководств', 'manual', 'ifu'])) return 'doc-mi-instructions';
    if (hasAny(normalizedFileName, ['макет', 'фото', 'photo', 'mockup', 'упаков', 'jpg', 'jpeg', 'png'])) return 'doc-mi-mockup';
    if (hasAny(normalizedFileName, ['маркиров', 'label', 'этикет'])) return 'doc-mi-labeling';
    if (hasAny(normalizedFileName, ['смк', 'qms', 'iso', '13485', 'деклара', 'сертификат'])) return 'doc-mi-qms-certificate';
    if (hasAny(normalizedFileName, ['стерил', 'steril'])) return 'doc-mi-sterilization-validation';
    if (hasAny(normalizedFileName, ['программ', 'программное обеспечение', 'software', 'кибер'])) return 'doc-mi-software-validation';
    if (hasAny(normalizedFileName, ['pms', 'пострег', 'мониторинг', 'неблагоприят', 'жалоб'])) return 'doc-mi-post-marketing';
  }

  if (hasAny(normalizedText, ['заявлен', 'application'])) return 'doc-mi-application';
  if (hasAny(normalizedText, ['оплат', 'платеж', 'payment', 'квитанц'])) return 'doc-mi-payment';
  if (hasAny(normalizedText, ['сопровод', 'cover', 'письм'])) return 'doc-mi-cover-letter';
  if (hasAny(normalizedText, ['биолог', 'токсик', 'biocompat', 'биосовмест'])) return 'doc-mi-biological-studies';
  if (hasAny(normalizedText, ['клиничес', 'clinical', 'лаборатор'])) return 'doc-mi-clinical-trials';
  if (hasAny(normalizedText, ['инструкц', 'эксплуатац', 'руководств', 'manual', 'ifu'])) return 'doc-mi-instructions';
  if (hasAny(normalizedText, ['макет', 'фото', 'photo', 'mockup', 'упаков', 'jpg', 'jpeg', 'png'])) return 'doc-mi-mockup';
  if (hasAny(normalizedText, ['маркиров', 'label', 'этикет'])) return 'doc-mi-labeling';
  if (hasAny(normalizedText, ['смк', 'qms', 'iso', '13485', 'деклара', 'сертификат'])) return 'doc-mi-qms-certificate';
  if (hasAny(normalizedText, ['стерил', 'steril'])) return 'doc-mi-sterilization-validation';
  if (hasAny(normalizedText, ['программ', 'программное обеспечение', 'software', 'кибер'])) return 'doc-mi-software-validation';
  if (hasAny(normalizedText, ['pms', 'пострег', 'мониторинг', 'неблагоприят', 'жалоб'])) return 'doc-mi-post-marketing';
  if (hasAny(normalizedText, ['техническ', 'испытан', 'performance'])) return 'doc-mi-technical-tests';
  return fallback;
}

function hasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(normalize(keyword)));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}.]+/gu, ' ').trim();
}

function isKazakhText(text: string) {
  return hasAny(text, ['каз', 'қаз', 'kz']);
}
