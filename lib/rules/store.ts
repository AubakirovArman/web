import { Rule } from '@/lib/types';
import { rules as seedRules } from '@/lib/data/seed';

const RULES_STORAGE_KEY = 'ndda-rules-v1';

function normalizeRule(rule: Partial<Rule>): Rule | null {
  const seed = seedRules.find((item) => item.id === rule.id);
  const source = seed ? { ...seed, ...rule } : rule;

  if (!source.id || !source.name) return null;

  return {
    id: source.id,
    name: source.name,
    conditions: Array.isArray(source.conditions) ? source.conditions : [],
    requiredDocuments: Array.isArray(source.requiredDocuments) ? source.requiredDocuments : [],
    sourceNpaId: source.sourceNpaId,
    active: source.active ?? true,
  };
}

export function getStoredRules(): Rule[] {
  if (typeof window === 'undefined') return seedRules.map((r) => ({ ...r, active: r.active ?? true }));
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Rule[];
      const normalized = Array.isArray(parsed) ? parsed.map(normalizeRule).filter((rule): rule is Rule => !!rule) : [];
      return normalized.length > 0 ? normalized : seedRules.map((r) => ({ ...r, active: r.active ?? true }));
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
