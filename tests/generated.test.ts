import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import { validateSolutions, recompute, type Solution } from '../src/data/verify';
import { validateTasks } from '../src/data/validate';
import { filterTasks } from '../src/data/catalog';
import t1 from '../data/tasks/solid_geometry.json';
import t2 from '../data/tasks/generated_polyhedra.json';
import t3 from '../data/tasks/generated_angles.json';
import s3 from '../data/solutions/solutions_part_03.json';
import { loadExtraParts } from '../src/data/loader';
import s1 from '../data/solutions/solutions_part_01.json';
import s2 from '../data/solutions/solutions_part_02.json';
import rules from '../data/mathematics/theorems.json';
import sTask from '../data/schemas/task.schema.json';
import sSol from '../data/schemas/solution.schema.json';
const tasks = [...t1, ...t2, ...t3] as any[], sols = [...s1, ...s2, ...s3] as unknown as Solution[];
describe('generated polyhedra tasks', () => {
  it('all tasks structurally valid and ids unique across files', () => { expect(validateTasks(tasks)).toEqual([]); });
  it('every task has exactly one solution and every solution recomputes from the geometry core', () => {
    expect(tasks.map(t => t.id).sort()).toEqual(sols.map(s => s.taskId).sort());
    expect(validateSolutions(sols, new Set(tasks.map(t => t.id)), new Set(rules.map(r => r.id)))).toEqual([]);
  });
  it('statements and expressions are unique (no duplicate tasks)', () => {
    for (const l of ['kk', 'ru', 'en']) expect(new Set(tasks.map(t => t.languages[l].statement)).size).toBe(tasks.length);
    expect(new Set(sols.map(s => s.finalAnswer.expression)).size).toBeGreaterThan(30);
  });
  it('schemas accept the generated data', () => { const ajv = new Ajv({ allErrors: true, strict: false }); const a = ajv.compile(sTask), b = ajv.compile(sSol); expect(a(t2) ? [] : a.errors).toEqual([]); expect(a(t3) ? [] : a.errors).toEqual([]); expect(b(s3) ? [] : b.errors).toEqual([]); expect(b(s2) ? [] : b.errors).toEqual([]); });
  it('tampering with a generated answer is caught', () => { const bad = { ...sols[10], finalAnswer: { ...sols[10].finalAnswer, value: sols[10].finalAnswer.value * 1.01 } }; expect(validateSolutions([bad], new Set([bad.taskId]), new Set(rules.map(r => r.id))).map(i => i.problem)).toContain('value_mismatch'); });
  it('independent spot checks', () => { const v = (id: string) => recompute(sols.find(s => s.taskId === id)!); expect(v('ST-0005')).toBeCloseTo(5 * 4 * 4 * Math.sqrt(3) / 4, 8); expect(v('ST-0006')).toBeCloseTo(5 * 4 * 4 * Math.sqrt(3) / 12, 8); });
  it('catalog can filter the new topics', () => { expect(filterTasks(tasks, { topic: 'surface_areas' }, 'ru').length).toBe(12); expect(filterTasks(tasks, { query: 'шестиугольн' }, 'ru').length).toBeGreaterThan(5); });
});
describe('angle tasks and lazy loading', () => {
  it('square pyramid a=4 h=3: tg(edge,base)=3/(2√2) and tg(face,base)=3/2', () => {
    const v = (id: string) => recompute(sols.find(s => s.taskId === id)!); const ids = (t3 as any[]).map(t => t.id);
    expect(v(ids[0 + 2])).toBeCloseTo(3 / (2 * Math.SQRT2), 9); expect(v(ids[1 + 2])).toBeCloseTo(3 / 2, 9);
  });
  it('lazy loader returns the extra parts', async () => { const e = await loadExtraParts(); expect(e.tasks.length).toBeGreaterThan(t2.length + t3.length + 49); expect(e.sols.length).toBe(e.tasks.length); });
});
