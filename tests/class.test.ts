import { describe, it, expect } from 'vitest';
import * as c from '../src/class/session';
const T = ['T1', 'T2', 'T3'];
const att = (id: string, studentId: string, taskId: string, o: Partial<c.Attempt> = {}): c.Attempt => ({ id, studentId, taskId, at: 1, correct: true, hintsUsed: 0, errorCodes: [], ...o });
const stud = (n: number) => Array.from({ length: n }, (_, i) => `S${i}`);
describe('class session', () => {
  it('30 students have isolated states; one student progress/errors do not affect others', () => {
    const s = c.start(c.createSession('C1', T, stud(30)), 0); const all: c.States = Object.fromEntries(s.studentIds.map(id => [id, c.newStates(T)]));
    all.S0 = c.recordAttempt(all.S0, att('a1', 'S0', 'T1', { correct: false, errorCodes: ['ERR-X'] }));
    all.S1 = c.recordAttempt(all.S1, att('a2', 'S1', 'T1'));
    expect(all.S0[0].status).toBe('in_progress'); expect(all.S1[0].status).toBe('done');
    for (let i = 2; i < 30; i++) expect(all[`S${i}`][0]).toEqual({ taskId: 'T1', status: 'not_started', attempts: [] });
    expect(c.summarize(s, all).tasks[0].counts).toMatchObject({ done: 1, in_progress: 1, not_started: 28 });
  });
  it('nothing is available before start or after end', () => {
    const s = c.createSession('C', T, ['S0']); expect(c.allowedTasks(s, 'S0', c.newStates(T))).toEqual([]);
    expect(c.allowedTasks(c.end(c.start(s, 1), 2), 'S0', c.newStates(T))).toEqual([]);
  });
  it('free / sequential / individual modes', () => {
    let st = c.newStates(T); const base = c.start(c.createSession('C', T, ['S0', 'S1'], 'sequential'), 0);
    expect(c.allowedTasks(base, 'S0', st)).toEqual(['T1']);
    st = c.recordAttempt(st, att('a', 'S0', 'T1')); expect(c.allowedTasks(base, 'S0', st)).toEqual(['T1', 'T2']);
    st = c.setStatus(st, 'T2', 'deferred'); expect(c.allowedTasks(base, 'S0', st)).toEqual(['T1', 'T2', 'T3']);
    expect(c.allowedTasks({ ...base, mode: 'free' }, 'S1', c.newStates(T))).toEqual(T);
    const ind = c.start(c.createSession('C', T, ['S0', 'S1'], 'individual', { S0: ['T3', 'T1'] }), 0);
    expect(c.allowedTasks(ind, 'S0', c.newStates(T))).toEqual(['T3']); expect(c.allowedTasks(ind, 'S1', c.newStates(T))).toEqual([]);
  });
  it('moving on does not interrupt others; a finished task stays done', () => {
    let a = c.newStates(T), b = c.newStates(T); a = c.recordAttempt(a, att('x', 'S0', 'T1')); b = c.recordAttempt(b, att('y', 'S1', 'T1', { correct: false }));
    a = c.recordAttempt(a, att('z', 'S0', 'T1', { correct: false })); expect(a[0].status).toBe('done'); expect(b[0].status).toBe('in_progress'); expect(b[1].status).toBe('not_started');
  });
  it('attempts are idempotent; invalid transitions are rejected', () => {
    const a1 = att('same', 'S0', 'T1'); let st = c.recordAttempt(c.newStates(T), a1); st = c.recordAttempt(st, a1); expect(st[0].attempts).toHaveLength(1);
    expect(() => c.setStatus(c.newStates(T), 'T1', 'done')).toThrow(); expect(() => c.setStatus(st, 'ZZ', 'repeat')).toThrow(); expect(c.setStatus(st, 'T1', 'repeat')[0].status).toBe('repeat');
  });
  it('merge is commutative, idempotent and never loses attempts or downgrades done', () => {
    const base = c.newStates(T), a = c.recordAttempt(base, att('1', 'S', 'T1', { correct: false, at: 1 })), b = c.recordAttempt(base, att('2', 'S', 'T1', { at: 2 }));
    const m1 = c.mergeStates(a, b), m2 = c.mergeStates(b, a);
    expect(m1).toEqual(m2); expect(c.mergeStates(m1, m1)).toEqual(m1); expect(m1[0].attempts.map(x => x.id)).toEqual(['1', '2']); expect(m1[0].status).toBe('done');
  });
  it('recommendations follow quality, not speed', () => {
    const cat = [{ id: 'A', topic: 'v', difficulty: 2 }, { id: 'B', topic: 'v', difficulty: 3 }, { id: 'C', topic: 'v', difficulty: 1 }, { id: 'D', topic: 'w', difficulty: 2 }];
    const cur = cat[0], mk = (a: c.Attempt[]) => ({ taskId: 'A', status: 'done' as const, attempts: a });
    expect(c.recommend(cur, mk([att('1', 'S', 'A', { at: 1 })]), cat, [])).toEqual({ kind: 'harder', taskId: 'B' });
    expect(c.recommend(cur, mk([att('1', 'S', 'A', { at: 99999 })]), cat, [])).toEqual({ kind: 'harder', taskId: 'B' }); // время не влияет
    expect(c.recommend(cur, mk([att('1', 'S', 'A', { hintsUsed: 4 })]), cat, [])).toEqual({ kind: 'analogous', taskId: 'C' });
    expect(c.recommend(cur, mk([att('1', 'S', 'A', { correct: false })]), cat, [])).toEqual({ kind: 'repeat', taskId: 'A' });
    expect(c.recommend(cur, mk([att('1', 'S', 'A', { errorCodes: ['E'] })]), cat, []).kind).toBe('analogous');
  });
  it('summary reveals no student ids or times, and aggregates support need and common errors', () => {
    const s = c.start(c.createSession('C', T, stud(5)), 0); const all: c.States = Object.fromEntries(s.studentIds.map(id => [id, c.newStates(T)]));
    for (const [i, id] of ['S0', 'S1', 'S2'].entries()) all[id] = c.recordAttempt(all[id], att(`e${i}`, id, 'T1', { correct: false, errorCodes: ['ERR-A'] }));
    all.S3 = c.recordAttempt(all.S3, att('n', 'S3', 'T2', { correct: null }));
    const sum = c.summarize(s, all), json = JSON.stringify(sum);
    expect(sum.topErrors).toEqual([{ code: 'ERR-A', count: 3 }]); expect(sum.needSupport).toBe(1); expect(json).not.toMatch(/S\d|"at"|time/);
  });
  it('individual view needs permission', () => {
    const s = c.createSession('C', T, ['S0']); const all: c.States = { S0: c.newStates(T) };
    expect(c.teacherView(s, all, 'S0')).toBeNull(); expect(c.teacherView({ ...s, allowIndividualView: true }, all, 'S0')).toHaveLength(3); expect(c.teacherView({ ...s, allowIndividualView: true }, all, 'S9')).toBeNull();
  });
});
