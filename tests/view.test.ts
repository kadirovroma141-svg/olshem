import { describe, it, expect } from 'vitest';
import { ruleViews, solutionView } from '../src/data/view';
import { LANGS } from '../src/i18n/i18n';
import rules from '../data/mathematics/theorems.json';
import sols from '../data/solutions/solutions_part_01.json';
import type { Solution } from '../src/data/verify';
describe('views', () => {
  it('rule views exist for all languages and differ between languages', () => {
    const t = LANGS.map(l => ruleViews(rules, l)[0].title); expect(new Set(t).size).toBe(3);
    for (const l of LANGS) for (const v of ruleViews(rules, l)) { expect(v.title).toBeTruthy(); expect(v.statement).toBeTruthy(); }
  });
  it('solution view numbers steps and keeps status', () => {
    const v = solutionView(sols[1] as unknown as Solution, 'en'); expect(v.steps.map(s => s.n)).toEqual([1, 2, 3, 4]); expect(v.steps[0].text).toMatch(/^Given/); expect(v.status).toBe('auto_validated');
  });
});
