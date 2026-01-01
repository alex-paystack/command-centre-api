import type { FeatureStateRule } from '../types/feature';
import { interpolateTemplate } from '../utils/interpolate';

// Very small expression evaluator for trusted, internal rule strings.
function safeEval(expr: string, payload: Record<string, unknown>) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function('data', `with (data) { return (${expr}); }`) as (data: Record<string, unknown>) => unknown;
    const result = fn(payload);
    return Boolean(result);
  } catch {
    return false;
  }
}

type EvaluateRulesResult = {
  state: string;
  details?: string;
  id: string | null;
  dataAgeSeconds?: number | null;
};

export function evaluateRules(
  rules: FeatureStateRule[],
  payload: Record<string, unknown>,
  dataAgeSeconds?: number,
): EvaluateRulesResult {
  for (const rule of rules) {
    const match = safeEval(rule.when, payload);
    if (match) {
      return {
        state: rule.state,
        details: rule.details ? interpolateTemplate(rule.details, payload) : undefined,
        id: rule.id,
        dataAgeSeconds: dataAgeSeconds ?? null,
      };
    }
  }

  return { state: 'unknown', details: 'No rule matched', id: null, dataAgeSeconds: dataAgeSeconds ?? null };
}
