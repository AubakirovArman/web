'use client';

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { Rule, Severity } from '@/lib/types';
import { rules as seedRules } from '@/lib/data/seed';
import { getStoredRules, saveRules } from '@/lib/rules/store';

interface RulesContextValue {
  rules: Rule[];
  toggleRuleActive: (ruleId: string) => void;
  updateDocSeverity: (ruleId: string, documentTypeId: string, severity: Severity) => void;
  resetRules: () => void;
}

const RulesContext = createContext<RulesContextValue | null>(null);

export function RulesProvider({ children }: { children: ReactNode }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setRules(getStoredRules());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      saveRules(rules);
    }
  }, [rules, loaded]);

  const value = useMemo<RulesContextValue>(
    () => ({
      rules,
      toggleRuleActive: (ruleId) =>
        setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, active: r.active === false ? true : false } : r))),
      updateDocSeverity: (ruleId, documentTypeId, severity) =>
        setRules((prev) =>
          prev.map((r) =>
            r.id === ruleId
              ? {
                  ...r,
                  requiredDocuments: r.requiredDocuments.map((d) =>
                    d.documentTypeId === documentTypeId ? { ...d, severityIfMissing: severity } : d
                  ),
                }
              : r
          )
        ),
      resetRules: () => setRules(seedRules.map((r) => ({ ...r, active: true }))),
    }),
    [rules]
  );

  return <RulesContext.Provider value={value}>{children}</RulesContext.Provider>;
}

export function useRules() {
  const ctx = useContext(RulesContext);
  if (!ctx) throw new Error('useRules must be used within RulesProvider');
  return ctx;
}
