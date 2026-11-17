import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openDb, Store, detectConflict } from '../src/storage/db';
let n = 0; const fresh = async () => new Store(await openDb('t' + n++));
describe('storage', () => {
  it('two profiles on one device are isolated', async () => {
    const s = await fresh(), a = await s.createProfile('A'), b = await s.createProfile('B');
    await s.saveSession(a.id, 'ST-0001', { draft: 'alpha' }); await s.saveSession(b.id, 'ST-0001', { draft: 'beta' });
    expect((await s.loadSession(a.id, 'ST-0001'))!.data).toEqual({ draft: 'alpha' });
    expect((await s.listSessions(b.id)).map(x => x.data)).toEqual([{ draft: 'beta' }]);
    expect(await s.loadSession(b.id, 'ST-9999')).toBeNull();
    expect(await s.pendingOps(a.id)).toHaveLength(1);
  });
  it('profile ids carry no personal data', async () => { const p = await (await fresh()).createProfile('Анна'); expect(p.id).toMatch(/^[0-9a-f-]{36}$/); expect(p.id).not.toContain('Анна'); });
  it('versions increase and survive reopen', async () => {
    const name = 'persist', s1 = new Store(await openDb(name)), p = await s1.createProfile('A');
    await s1.saveSession(p.id, 'T', { a: 1 }); const r = await s1.saveSession(p.id, 'T', { a: 2 }); expect(r).toEqual({ ok: true, version: 2 });
    const s2 = new Store(await openDb(name)); expect((await s2.loadSession(p.id, 'T'))!.data).toEqual({ a: 2 });
  });
  it('drain: batches, acked removed, retry is idempotent, failure keeps ops', async () => {
    const s = await fresh(), p = await s.createProfile('A'); for (let i = 0; i < 5; i++) await s.saveSession(p.id, 'T' + i, { i });
    expect(await s.drain(p.id, async () => { throw new Error('offline'); })).toEqual({ sent: 0, failed: true });
    expect(await s.pendingOps(p.id)).toHaveLength(5);
    const seen: string[] = []; let calls = 0;
    const r = await s.drain(p.id, async ops => { calls++; if (calls === 1) { seen.push(...ops.slice(0, 2).map(o => o.opId)); return ops.slice(0, 2).map(o => o.opId); } seen.push(...ops.map(o => o.opId)); return ops.map(o => o.opId); }, 3);
    expect(r).toEqual({ sent: 5, failed: false }); expect(new Set(seen).size).toBe(seen.length); expect(await s.pendingOps(p.id)).toHaveLength(0);
    expect((await s.loadSession(p.id, 'T0'))!.syncedVersion).toBe(1);
  });
  it('same operation saved twice is not duplicated in the queue', async () => {
    const s = await fresh(), p = await s.createProfile('A'); await s.saveSession(p.id, 'T', 1);
    const ops = await s.pendingOps(p.id); expect(ops).toHaveLength(1); expect(ops[0].opId).toBe(`${p.id}:T@1`);
  });
  it('migration v1 -> v2 keeps data', async () => {
    const d1 = await openDb('mig', 1), v1 = new Store(d1), p = await v1.createProfile('A'); await v1.saveSession(p.id, 'T', { keep: true }); d1.close();
    const db2 = await openDb('mig', 2); expect([...db2.objectStoreNames]).toContain('hintHistory');
    expect((await new Store(db2).loadSession(p.id, 'T'))!.data).toEqual({ keep: true });
  });
  it('write failure is reported, not hidden', async () => {
    const s = await fresh(), p = await s.createProfile('A'); const r = await s.saveSession(p.id, 'T', () => 1);
    expect(r.ok).toBe(false);
  });
  it('conflict detection', () => {
    expect(detectConflict({ version: 3, syncedVersion: 2 }, 4)).toBe(true);
    expect(detectConflict({ version: 2, syncedVersion: 2 }, 4)).toBe(false);
    expect(detectConflict({ version: 3, syncedVersion: 2 }, 2)).toBe(false);
  });
  it('30 students work independently', async () => {
    const s = await fresh(), ps = await Promise.all(Array.from({ length: 30 }, (_, i) => s.createProfile('S' + i)));
    await Promise.all(ps.map((p, i) => s.saveSession(p.id, 'ST-0001', { who: i })));
    for (const [i, p] of ps.entries()) { const l = await s.listSessions(p.id); expect(l).toHaveLength(1); expect(l[0].data).toEqual({ who: i }); }
  });
});
describe('profile order', () => {
  it('profiles are listed in creation order regardless of random ids', async () => {
    const s = await fresh(); const made: string[] = []; for (let i = 0; i < 8; i++) { made.push((await s.createProfile('P' + i)).id); await new Promise(r => setTimeout(r, 2)); }
    expect((await s.listProfiles()).map(p => p.id)).toEqual(made);
  });
});
