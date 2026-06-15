import { npas } from '@/lib/data/seed';
import { Rule, RuleSource } from '@/lib/types';

const npaDocumentMap: Record<string, string | ((rule: Rule) => string)> = {
  'npa-2': 'ls-2',
  'npa-3': 'ls-4',
  'npa-4': 'ls-7',
  'npa-5': 'ls-10',
  'npa-6': 'ls-11',
  'npa-7': 'ls-15',
  'npa-8': (rule) => (rule.id.startsWith('rule-mi') ? 'mi-21' : 'ls-22'),
  'npa-9': 'ls-18',
  'npa-12': 'mi-2',
};

export function getNpaReferenceDocumentId(npaId: string, rule?: Rule): string | undefined {
  const mapped = npaDocumentMap[npaId];
  if (!mapped) return undefined;
  return typeof mapped === 'function' ? mapped(rule || ({ id: '' } as Rule)) : mapped;
}

export const ruleSourceEvidence: Record<string, RuleSource[]> = {
  'rule-common-registration': [
    {
      npaId: 'npa-8',
      sourceDocumentId: 'ls-22',
      sourceSection: 'Форма заявления и общий пакет документов ЛС',
      sourceQuote:
        'Заявление на проведение экспертизы лекарственного средства подается с регистрационным досье и документами, предусмотренными правилами экспертизы.',
      explanation:
        'Базовый пакет регистрации ЛС строится из формы заявления ДСМ-10 и правил регистрации/экспертизы ЛС.',
    },
    {
      npaId: 'npa-2',
      sourceDocumentId: 'ls-2',
      sourceSection: 'Правила регистрации и экспертизы ЛС',
      sourceQuote: 'Для регистрации лекарственного препарата представляются материалы регистрационного досье.',
      explanation: 'Решение №78 задает общий регуляторный контур регистрации ЛС в ЕАЭС.',
    },
  ],
  'rule-lab-testing-samples': [
    {
      npaId: 'npa-8',
      sourceDocumentId: 'ls-22',
      sourceSection: 'Образцы для лабораторных испытаний',
      sourceQuote: 'Образцы лекарственного средства, стандартные образцы и реагенты предоставляются при необходимости проведения испытаний.',
      explanation: 'Образцы не должны требоваться всегда; правило включается только при лабораторных испытаниях.',
    },
  ],
  'rule-generic-bioequivalence': [
    {
      npaId: 'npa-3',
      sourceDocumentId: 'ls-4',
      sourceSection: 'Биоэквивалентность / биовейвер',
      sourceQuote:
        'Для воспроизведенных лекарственных препаратов представляются данные биоэквивалентности или обоснование отсутствия необходимости исследования.',
      explanation: 'Поэтому отчет БЭ и биовейвер являются альтернативными основаниями комплектности.',
    },
  ],
  'rule-biological-risk-management': [
    {
      npaId: 'npa-6',
      sourceDocumentId: 'ls-11',
      sourceSection: 'Фармаконадзор и управление рисками',
      sourceQuote: 'Для препаратов с повышенными рисками предоставляются материалы системы фармаконадзора и управления рисками.',
      explanation: 'Биологические и биоаналогичные препараты требуют усиленного блока фармаконадзора.',
    },
  ],
  'rule-biosimilar-comparison': [
    {
      npaId: 'npa-2',
      sourceDocumentId: 'ls-2',
      sourceSection: 'Биоаналогичные препараты',
      sourceQuote: 'Материалы досье должны подтверждать сопоставимость с референтным лекарственным препаратом.',
      explanation: 'Для биоаналогов нужны сравнительные данные и построчное сравнение с референтным препаратом.',
    },
  ],
  'rule-re-registration': [
    {
      npaId: 'npa-8',
      sourceDocumentId: 'ls-22',
      sourceSection: 'Перерегистрация ЛС',
      sourceQuote: 'При перерегистрации указываются сведения о действующем регистрационном удостоверении.',
      explanation: 'Для перерегистрации нужны РУ, актуальные документы и пострегистрационные данные.',
    },
  ],
  'rule-variation': [
    {
      npaId: 'npa-7',
      sourceDocumentId: 'ls-15',
      sourceSection: 'Классификация изменений',
      sourceQuote: 'Изменения регистрационного досье классифицируются по типам IA, IB и II.',
      explanation: 'Внесение изменений требует описания изменения, обоснования и сравнения текущей/предлагаемой редакции.',
    },
    {
      npaId: 'npa-8',
      sourceDocumentId: 'ls-22',
      sourceSection: 'Форма заявления ЛС',
      sourceQuote: 'В заявлении указываются сведения о регистрационном удостоверении и вносимые изменения.',
      explanation: 'ДСМ-10 задает поля заявления для процедуры внесения изменений.',
    },
  ],
  'rule-mi-common-registration': [
    {
      npaId: 'npa-12',
      sourceDocumentId: 'mi-2',
      sourceSection: 'Регистрация медицинских изделий',
      sourceQuote: 'Для регистрации медицинского изделия представляются регистрационное досье, испытания и эксплуатационная документация.',
      explanation: 'Базовый пакет МИ строится по Решению №46 и национальным правилам экспертизы.',
    },
  ],
  'rule-mi-biological-studies-iii': [
    {
      npaId: 'npa-12',
      sourceDocumentId: 'mi-2',
      sourceSection: 'Класс риска III',
      sourceQuote: 'Для изделий высокого класса риска представляются дополнительные материалы оценки безопасности и эффективности.',
      explanation: 'Для MI class III правило требует биологические исследования как критичный документ.',
    },
  ],
  'rule-mi-clinical-trials-iii': [
    {
      npaId: 'npa-12',
      sourceDocumentId: 'mi-2',
      sourceSection: 'Клинические данные МИ',
      sourceQuote: 'Клинические данные подтверждают безопасность и эффективность медицинского изделия.',
      explanation: 'Для MI class III клинические испытания обязательны как доказательная часть досье.',
    },
  ],
  'rule-mi-re-registration': [
    {
      npaId: 'npa-12',
      sourceDocumentId: 'mi-2',
      sourceSection: 'Перерегистрация МИ',
      sourceQuote: 'При перерегистрации медицинского изделия представляются сведения о действующей регистрации.',
      explanation: 'Для перерегистрации МИ нужны действующее РУ, досье, СМК и пострегистрационные данные.',
    },
  ],
  'rule-mi-variation': [
    {
      npaId: 'npa-12',
      sourceDocumentId: 'mi-2',
      sourceSection: 'Внесение изменений МИ',
      sourceQuote: 'Изменения медицинского изделия должны сопровождаться описанием, обоснованием и обновленными документами.',
      explanation: 'Правило собирает минимальный пакет для процедуры изменения МИ.',
    },
  ],
};

export function getRuleSources(rule: Rule): RuleSource[] {
  if (rule.sources?.length) return rule.sources;
  if (ruleSourceEvidence[rule.id]?.length) return ruleSourceEvidence[rule.id];
  if (!rule.sourceNpaId) return [];

  const npa = npas.find((item) => item.id === rule.sourceNpaId);
  const sourceDocumentId = getNpaReferenceDocumentId(rule.sourceNpaId, rule);

  return [
    {
      npaId: rule.sourceNpaId,
      sourceDocumentId,
      sourceSection: npa?.name,
      sourceQuote: npa ? `${npa.number} от ${npa.date}` : undefined,
      explanation: 'Источник правила задан через sourceNpaId. Точный пункт можно уточнить в справочнике.',
    },
  ];
}
