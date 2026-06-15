import { Rule } from '@/lib/types';
import { rules as seedRules } from '@/lib/data/seed';

const RULES_STORAGE_KEY = 'ndda-rules-v1';

export function getStoredRules(): Rule[] {
  if (typeof window === 'undefined') return seedRules.map((r) => ({ ...r, active: r.active ?? true }));
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Rule[];
      return parsed.map((r) => ({ ...r, active: r.active ?? true }));
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
