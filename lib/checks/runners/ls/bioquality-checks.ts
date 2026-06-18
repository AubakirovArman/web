import type { CheckRunContext } from '@/lib/checks/engine-context';
import { runLsBioequivalenceChecks } from '@/lib/checks/runners/ls/bioequivalence-checks';
import { runLsQualitySupportChecks } from '@/lib/checks/runners/ls/quality-support-checks';

export function runLsBioQualityChecks(context: CheckRunContext) {
  runLsBioequivalenceChecks(context);
  runLsQualitySupportChecks(context);
}
