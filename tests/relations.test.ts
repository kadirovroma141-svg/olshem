import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import { validateSolutions, recompute, type Solution } from '../src/data/verify';
import { validateTasks } from '../src/data/validate';
import tasks from '../data/tasks/generated_relations.json';
import sols from '../data/solutions/solutions_part_06.json';
import rules from '../data/mathematics/theorems.json';
import sTask from '../data/schemas/task.schema.json';
import sSol from '../data/schemas/solution.schema.json';
const S = sols as unknown as Solution[];
describe('relative position tasks (answers computed twice: Python exact integers and TypeScript core)', () => {
  it('valid, unique, schema-conformant', () => {
    expect(tasks).toHaveLength(38); expect(tasks[0].id).toBe('ST-0097'); expect(validateTasks(tasks as any[])).toEqual([]);
    for (const l of ['kk', 'ru', 'en'] as const) expect(new Set(tasks.map(t => t.languages[l].statement)).size).toBe(38);
    const a = new Ajv({ strict: false }); expect(a.validate(sTask, tasks)).toBe(true); expect(a.validate(sSol, sols)).toBe(true);
  });
  it('every answer code equals the independent TypeScript recomputation', () => { expect(validateSolutions(S, new Set(tasks.map(t => t.id)), new Set(rules.map(r => r.id)))).toEqual([]); });
  it('answer codes are balanced: lines 7/7/8, line-plane 4/4/4/4', () => {
    const cnt = (ops: string, codes: number[]) => codes.map(c => S.filter(s => s.verification.op === ops && s.finalAnswer.value === c).length);
    expect(cnt('relLines', [1, 2, 3])).toEqual([7, 7, 8]); expect(cnt('relLinePlane', [1, 2, 3, 4])).toEqual([4, 4, 4, 4]);
  });
  it('degenerate input is rejected', () => {
    const bad = (op: any, args: string[]) => ({ id: 'X', taskId: 'X', edge: 1, steps: [], finalAnswer: { expression: '0', value: 0 }, verification: { op, args }, validationStatus: 'pending' }) as Solution;
    expect(() => recompute(bad('relLines', ['A', 'A', 'B', 'C']))).toThrow(); expect(() => recompute(bad('relLines', ['A', 'B', 'A', 'B']))).toThrow(); expect(() => recompute(bad('relLinePlane', ['A', 'B', 'A', 'B', 'C']))).not.toThrow(); expect(() => recompute(bad('relLines', ['A', 'Q', 'B', 'C']))).toThrow();
  });
});
