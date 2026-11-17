import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import { validateSolutions, recompute, type Solution } from '../src/data/verify';
import { validateTasks } from '../src/data/validate';
import tasks from '../data/tasks/generated_coordinates.json';
import sols from '../data/solutions/solutions_part_05.json';
import rules from '../data/mathematics/theorems.json';
import sTask from '../data/schemas/task.schema.json';
import sSol from '../data/schemas/solution.schema.json';
const S = sols as unknown as Solution[];
const mk = (op: any, args: string[], coords: Record<string, number[]>): Solution => ({ id: 'X', taskId: 'X', steps: [], finalAnswer: { expression: '0', value: 0 }, verification: { op, args, coords: coords as any }, validationStatus: 'pending' } as Solution);
describe('coordinate method', () => {
  it('hand-checked values', () => {
    expect(recompute(mk('coordDistance', ['A', 'B'], { A: [0, 0, 0], B: [1, 2, 2] }))).toBeCloseTo(3, 12);
    expect(recompute(mk('coordCosAngle', ['A', 'B', 'C'], { A: [0, 0, 0], B: [1, 0, 0], C: [1, 1, 0] }))).toBeCloseTo(Math.SQRT1_2, 12);
    expect(recompute(mk('coordTetraVolume', ['A', 'B', 'C', 'D'], { A: [0, 0, 0], B: [1, 0, 0], C: [0, 1, 0], D: [0, 0, 1] }))).toBeCloseTo(1 / 6, 12);
    expect(recompute(mk('coordPointPlane', ['P', 'A', 'B', 'C'], { P: [0, 0, 5], A: [0, 0, 0], B: [1, 0, 0], C: [0, 1, 0] }))).toBeCloseTo(5, 12);
    expect(recompute(mk('coordSkewDistance', ['A', 'B', 'C', 'D'], { A: [0, 0, 0], B: [1, 0, 0], C: [0, 0, 3], D: [0, 1, 3] }))).toBeCloseTo(3, 12);
  });
  it('degenerate input is rejected', () => {
    expect(() => recompute(mk('coordPointPlane', ['P', 'A', 'B', 'C'], { P: [0, 0, 1], A: [0, 0, 0], B: [1, 0, 0], C: [2, 0, 0] }))).toThrow();
    expect(() => recompute(mk('coordSkewDistance', ['A', 'B', 'C', 'D'], { A: [0, 0, 0], B: [1, 0, 0], C: [0, 1, 0], D: [1, 1, 0] }))).toThrow();
  });
  it('generated tasks are valid, unique and recompute', () => {
    expect(tasks).toHaveLength(20); expect(validateTasks(tasks as any[])).toEqual([]); expect(tasks[0].id).toBe('ST-0077');
    expect(validateSolutions(S, new Set(tasks.map(t => t.id)), new Set(rules.map(r => r.id)))).toEqual([]);
    for (const l of ['kk', 'ru', 'en'] as const) expect(new Set(tasks.map(t => t.languages[l].statement)).size).toBe(20);
  });
  it('schemas accept the data', () => { const a = new Ajv({ strict: false }); expect(a.validate(sTask, tasks)).toBe(true); expect(a.validate(sSol, sols)).toBe(true); });
});
