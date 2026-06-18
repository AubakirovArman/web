import type { Application, Finding, Rule } from '@/lib/types';
import type { CheckScope } from '@/lib/checks/engine-utils';

export interface CheckRunContext {
  app: Application;
  rules: Rule[];
  scope: CheckScope;
  findings: Finding[];
  values: Application['values'];
  objectType: 'LS' | 'MI';
  procedure: 'registration' | 're-registration' | 'variation';
  isLS: boolean;
  isMI: boolean;
  productType: string;
  productLabel: string;
  requiredFieldIds: string[];
}
