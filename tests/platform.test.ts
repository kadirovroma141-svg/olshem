import { describe, it, expect } from 'vitest';
import { newScene, serialize, deserialize } from '../src/core/scene';
import { missingKeys } from '../src/i18n/i18n';
import { validateTasks } from '../src/data/validate';
import tasks from '../data/tasks/solid_geometry.json';
const pt = (id: string, xyz: number[], deps: string[] = []) => ({ id, type: 'point' as const, params: { xyz }, deps });
describe('scene', () => {
  it('round-trips', () => { const s = newScene('S1', 'ST-0001'); s.objects.push(pt('A', [0,0,0]), pt('B', [1,0,0])); const r = deserialize(serialize(s)); expect(r.ok && r.scene).toEqual(s); });
  it('rejects broken input without throwing', () => {
    expect(deserialize('{oops')).toEqual({ ok: false, error: 'invalid_json' });
    expect(deserialize('{"version":2}')).toEqual({ ok: false, error: 'bad_header' });
    const s = newScene('S'); s.objects.push(pt('A', [0,0,NaN as any])); expect(deserialize(JSON.stringify(s)).ok).toBe(false);
  });
  it('detects duplicate ids and missing dependencies', () => {
    const s = newScene('S'); s.objects.push(pt('A', [0,0,0]), pt('A', [1,1,1])); expect(deserialize(serialize(s))).toEqual({ ok: false, error: 'duplicate_or_missing_id' });
    const q = newScene('S'); q.objects.push(pt('A', [0,0,0]), { id: 'sg', type: 'segment', params: {}, deps: ['A', 'Z'] }); expect(deserialize(serialize(q))).toEqual({ ok: false, error: 'missing_dependency' });
  });
});
describe('i18n completeness', () => it('all locales have the same keys', () => expect(missingKeys()).toEqual({ kk: [], ru: [], en: [] })));
describe('task data', () => {
  it('current tasks are structurally valid and honestly unvalidated', () => { expect(validateTasks(tasks as any[])).toEqual([]); expect((tasks as any[]).every(t => t.validationStatus === 'pending')).toBe(true); });
  it('catches defects', () => {
    const t: any = { ...(tasks as any[])[0] };
    const bad = [t, { ...t }, { ...t, id: 'X', languages: { ru: t.languages.ru }, validationStatus: 'validated', grade: 9 }];
    const p = validateTasks(bad).map(i => i.problem);
    expect(p).toEqual(expect.arrayContaining(['duplicate_id', 'missing_lang:kk', 'missing_lang:en', 'validated_without_proof', 'bad_grade']));
  });
});
