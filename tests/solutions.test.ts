import { describe, it, expect } from 'vitest';
import { validateSolutions, recompute, type Solution } from '../src/data/verify';
import { validateTasks } from '../src/data/validate';
import { LANGS } from '../src/i18n/i18n';
import sols from '../data/solutions/solutions_part_01.json';
import tasks from '../data/tasks/solid_geometry.json';
import rules from '../data/mathematics/theorems.json';
const S = sols as unknown as Solution[];
describe('reference solutions', () => {
  it('every solution is consistent with tasks, rules and recomputed geometry', () => {
    expect(validateSolutions(S, new Set(tasks.map(t => t.id)), new Set(rules.map(r => r.id)))).toEqual([]);
  });
  it('every task has a solution', () => expect(tasks.map(t => t.id).sort()).toEqual(S.map(s => s.taskId).sort()));
  it('detects a wrong answer', () => {
    const bad = { ...S[0], finalAnswer: { ...S[0].finalAnswer, value: 7 } };
    expect(validateSolutions([bad], new Set(['ST-0001']), new Set(['RULE-002'])).map(i => i.problem)).toContain('value_mismatch');
  });
  it('recompute gives known values', () => { expect(recompute(S[2])).toBeCloseTo(4 / 3, 10); expect(recompute(S[3])).toBeCloseTo(16 * Math.SQRT2, 8); });
});
describe('rules database', () => {
  it('unique ids, three languages, resolvable dependencies, honest status', () => {
    const ids = new Set(rules.map(r => r.id)); expect(ids.size).toBe(rules.length);
    for (const r of rules as any[]) { for (const l of LANGS) expect(r.languages[l].statement.length).toBeGreaterThan(10); for (const d of r.dependencies) expect(ids.has(d)).toBe(true); expect(r.validationStatus).toBe('pending'); }
  });
  it('tasks remain structurally valid', () => expect(validateTasks(tasks as any[])).toEqual([]));
});
