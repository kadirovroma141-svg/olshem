import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { handle, newServerState, type Req } from '../server/handler';
import { openDb, Store } from '../src/storage/db';
import { httpTransport, syncOnce, type FetchLike } from '../src/storage/sync';
const T = { ta: 'profile-A', tb: 'profile-B' };
const op = (opId: string, taskId: string, version: number, data: unknown = { v: version }) => ({ opId, kind: 'session', payload: { taskId, version, data } });
const post = (st: ReturnType<typeof newServerState>, token: string | null, ops: unknown[], now = () => 1) => handle({ method: 'POST', path: '/sync', token, body: { ops } }, st, now);
describe('sync server handler', () => {
  it('rejects missing or unknown tokens', () => { const st = newServerState(T); expect(post(st, null, []).status).toBe(401); expect(post(st, 'zzz', []).status).toBe(401); });
  it('accepts ops, acks duplicates without storing twice', () => {
    const st = newServerState(T), o = op('o1', 'T1', 1); expect((post(st, 'ta', [o]).body as any).acked).toEqual(['o1']); expect((post(st, 'ta', [o]).body as any).acked).toEqual(['o1']);
    const g = handle({ method: 'GET', path: '/sessions/T1', token: 'ta' }, st); expect((g.body as any).head.clientVersion).toBe(1); expect(st.sessions.get('profile-A:T1')!.history).toHaveLength(1);
  });
  it('a student cannot read or overwrite another student data, even by claiming a profileId', () => {
    const st = newServerState(T); post(st, 'ta', [op('o1', 'T1', 1, { secret: 'A' })]);
    expect(handle({ method: 'GET', path: '/sessions/T1', token: 'tb' }, st).status).toBe(404);
    expect((handle({ method: 'GET', path: '/sessions', token: 'tb' }, st).body as any).sessions).toEqual([]);
    post(st, 'tb', [{ ...op('o2', 'T1', 5, { evil: 1 }), profileId: 'profile-A' }]);
    expect((handle({ method: 'GET', path: '/sessions/T1', token: 'ta' }, st).body as any).head.data).toEqual({ secret: 'A' });
  });
  it('newer version replaces head; conflicting same-version edit keeps both', () => {
    const st = newServerState(T); post(st, 'ta', [op('a', 'T1', 1), op('b', 'T1', 2, { v: 'dev1' })]);
    const r = post(st, 'ta', [op('c', 'T1', 2, { v: 'dev2' })]).body as any; expect(r.acked).toEqual(['c']); expect(r.conflicts).toEqual([{ opId: 'c', taskId: 'T1' }]);
    const g = handle({ method: 'GET', path: '/sessions/T1', token: 'ta' }, st).body as any; expect(g.head.data).toEqual({ v: 'dev1' }); expect(g.conflicts).toHaveLength(1); expect(g.conflicts[0].data).toEqual({ v: 'dev2' });
    expect(post(st, 'ta', [op('d', 'T1', 1, { old: true })]).body).toMatchObject({ conflicts: [{ opId: 'd' }] }); // устаревшая версия не перезаписывает новую
  });
  it('validates input and limits', () => {
    const st = newServerState(T); expect(handle({ method: 'POST', path: '/sync', token: 'ta', body: { ops: 'x' } }, st).status).toBe(400);
    expect(post(st, 'ta', Array.from({ length: 101 }, (_, i) => op('x' + i, 'T', 1))).status).toBe(413);
    const r = post(st, 'ta', [{ opId: 'bad', kind: 'evil', payload: {} }, op('ok', 'T', 1), { kind: 'session' }]).body as any; expect(r.acked).toEqual(['ok']); expect(r.rejected).toHaveLength(2);
    expect(handle({ method: 'GET', path: '/nope', token: 'ta' }, st).status).toBe(404);
  });
  it('rate limits per profile', () => { const st = newServerState(T); let last = 200; for (let i = 0; i < 61; i++) last = post(st, 'ta', []).status; expect(last).toBe(429); expect(post(st, 'tb', []).status).toBe(200); });
});
describe('client sync service end to end', () => {
  const setup = async () => {
    const st = newServerState({ tok: 'P1' }); let online = true, loseAck = false;
    const f: FetchLike = async (_u, init) => {
      if (!online) throw new Error('offline');
      const r = handle({ method: init.method, path: '/sync', token: init.headers.authorization.slice(7), body: JSON.parse(init.body ?? '{}') } as Req, st);
      if (loseAck) { loseAck = false; throw new Error('ack lost'); }
      return { ok: r.status < 300, status: r.status, json: async () => r.body };
    };
    const store = new Store(await openDb('sync-' + Math.random())), p = await store.createProfile('A');
    return { st, store, p, f, set: { online: (v: boolean) => { online = v; }, loseAck: () => { loseAck = true; } } };
  };
  it('offline work stays queued, then syncs after reconnect', async () => {
    const { st, store, p, f, set } = await setup(); const tr = httpTransport('http://x', () => 'tok', f);
    set.online(false); await store.saveSession(p.id, 'T1', { a: 1 }); await store.saveSession(p.id, 'T2', { b: 2 });
    expect((await syncOnce(store, p.id, tr)).status).toBe('offline'); expect(await store.pendingOps(p.id)).toHaveLength(2);
    set.online(true); expect(await syncOnce(store, p.id, tr)).toEqual({ status: 'synced', sent: 2 }); expect(await store.pendingOps(p.id)).toHaveLength(0); expect(st.sessions.size).toBe(2);
    expect((await store.loadSession(p.id, 'T1'))!.syncedVersion).toBe(1);
  });
  it('lost acknowledgement does not duplicate on retry', async () => {
    const { st, store, p, f, set } = await setup(); const tr = httpTransport('http://x', () => 'tok', f);
    await store.saveSession(p.id, 'T1', { a: 1 }); set.loseAck(); await syncOnce(store, p.id, tr); expect(await store.pendingOps(p.id)).toHaveLength(1);
    expect(await syncOnce(store, p.id, tr)).toEqual({ status: 'synced', sent: 1 }); expect(st.sessions.get('P1:T1')!.history).toHaveLength(1);
  });
  it('no token or rejected token leaves the queue intact', async () => {
    const { store, p, f } = await setup(); await store.saveSession(p.id, 'T1', 1);
    expect((await syncOnce(store, p.id, httpTransport('http://x', () => null, f))).status).toBe('offline'); expect((await syncOnce(store, p.id, httpTransport('http://x', () => 'bad', f))).status).toBe('offline');
    expect(await store.pendingOps(p.id)).toHaveLength(1);
  });
});
