import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import { validateSolutions, recompute, type Solution } from '../src/data/verify';
import { validateTasks } from '../src/data/validate';
import tasks from '../data/tasks/generated_revolution.json';
import sols from '../data/solutions/solutions_part_04.json';
import rules from '../data/mathematics/theorems.json';
import sTask from '../data/schemas/task.schema.json';
import sSol from '../data/schemas/solution.schema.json';
const S = sols as unknown as Solution[];
describe('revolution tasks', () => {
  it('structurally valid, solutions recompute from the core', () => { expect(validateTasks(tasks as any[])).toEqual([]); expect(validateSolutions(S, new Set(tasks.map(t => t.id)), new Set(rules.map(r => r.id)))).toEqual([]); });
  it('30 unique tasks, ids not clashing with other parts', () => { expect(tasks).toHaveLength(30); expect(tasks[0].id).toBe('ST-0047'); for (const l of ['kk', 'ru', 'en'] as const) expect(new Set(tasks.map(t => t.languages[l].statement)).size).toBe(30); });
  it('schemas accept the data', () => { const a = new Ajv({ strict: false }); expect(a.validate(sTask, tasks)).toBe(true); expect(a.validate(sSol, sols)).toBe(true); });
  it('known values', () => { const v = (id: string) => recompute(S.find(s => s.taskId === id)!); expect(v('ST-0047')).toBeCloseTo(45 * Math.PI, 9); expect(v('ST-0062')).toBeCloseTo(24 * Math.PI, 9); expect(v('ST-0068')).toBeCloseTo(36 * Math.PI, 9); });
  it('section radius answers are 4, 12, 8', () => { const r = S.filter(s => s.verification.op === 'revSectionRadius').map(s => recompute(s)); expect(r).toEqual([4, 12, 8]); });
});
