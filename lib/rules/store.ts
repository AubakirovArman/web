import { Rule } from '@/lib/types';
import { rules as seedRules } from '@/lib/data/seed';

const RULES_STORAGE_KEY = 'ndda-rules-v1';

function normalizeRule(rule: Partial<Rule>): Rule | null {
  const seed = seedRules.find((item) => item.id === rule.id);
  const source = seed ? { ...rule, ...seed, active: rule.active ?? seed.active ?? true } : rule;

  if (!source.id || !source.name) return null;

  return {
    id: source.id,
    name: source.name,
    conditions: Array.isArray(source.conditions) ? source.conditions : [],
    requiredDocuments: Array.isArray(source.requiredDocuments) ? source.requiredDocuments : [],
    sourceNpaId: source.sourceNpaId,
    sources: Array.isArray(source.sources) ? source.sources : seed?.sources,
    active: source.active ?? true,
  };
}

function mergeStoredWithSeed(storedRules: Rule[]): Rule[] {
  const storedById = new Map(storedRules.map((rule) => [rule.id, rule]));
  const mergedSeedRules = seedRules.map((seed) => normalizeRule({ ...seed, ...(storedById.get(seed.id) || {}) }));
  const customRules = storedRules.filter((rule) => !seedRules.some((seed) => seed.id === rule.id));
  return [...mergedSeedRules, ...customRules].filter((rule): rule is Rule => !!rule);
}

export function getStoredRules(): Rule[] {
  if (typeof window === 'undefined') return seedRules.map((r) => ({ ...r, active: r.active ?? true }));
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Rule[];
      const normalized = Array.isArray(parsed) ? parsed.map(normalizeRule).filter((rule): rule is Rule => !!rule) : [];
      return normalized.length > 0 ? mergeStoredWithSeed(normalized) : seedRules.map((r) => ({ ...r, active: r.active ?? true }));
    }
  } catch {
    // ignore
  }
  return seedRules.map((r) => ({ ...r, active: r.active ?? true }));
}

export function saveRules(rules: Rule[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
}
