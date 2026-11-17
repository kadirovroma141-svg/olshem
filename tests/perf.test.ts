import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openDb, Store } from '../src/storage/db';
import { httpTransport, syncOnce, type FetchLike } from '../src/storage/sync';
import { handle, newServerState } from '../server/handler';
import * as g from '../src/core/geometry';
import { regularPrism, edgesOf, volume } from '../src/core/polyhedron';
import { evaluate } from '../src/core/expr';
const N = 35, SAVES = 20;
const pct = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];
const t = () => performance.now();
describe('load: one class of 35 students (in-process, each on own IndexedDB, shared server handler)', () => {
  it('independent sessions, full sync, no cross-student leakage', async () => {
    const tokens = Object.fromEntries(Array.from({ length: N }, (_, i) => [`tok${i}`, `P${i}`])), st = newServerState(tokens);
    const mkFetch = (token: string): FetchLike => async (_u, init) => { const r = handle({ method: init.method, path: '/sync', token, body: JSON.parse(init.body ?? '{}') }, st); return { ok: r.status < 300, status: r.status, json: async () => r.body }; };
    const t0 = t(), saveMs: number[] = [], syncMs: number[] = [];
    const res = await Promise.all(Array.from({ length: N }, async (_, i) => {
      const store = new Store(await openDb(`class-${Math.random()}-${i}`)), p = await store.createProfile(`S${i}`);
      const a = t(); for (let k = 1; k <= SAVES; k++) { const r = await store.saveSession(p.id, 'ST-0001', { student: i, step: k, draft: 'x'.repeat(200) }); expect(r.ok).toBe(true); } saveMs.push((t() - a) / SAVES);
      const b = t(); const r = await syncOnce(store, p.id, httpTransport('http://x', () => `tok${i}`, mkFetch(`tok${i}`))); syncMs.push(t() - b); return { i, r, store, p };
    }));
    const total = t() - t0;
    for (const { i, r } of res) { expect(r).toEqual({ status: 'synced', sent: SAVES }); const head = st.sessions.get(`P${i}:ST-0001`)!.head; expect(head.clientVersion).toBe(SAVES); expect((head.data as any).student).toBe(i); }
    expect(st.sessions.size).toBe(N);
    console.log('LOAD', JSON.stringify({ students: N, savesEach: SAVES, totalMs: Math.round(total), saveMsAvg: +(saveMs.reduce((a, b) => a + b) / N).toFixed(2), saveMsP95: +pct(saveMs, 0.95).toFixed(2), syncMsP95: Math.round(pct(syncMs, 0.95)) }));
    expect(total).toBeLessThan(60_000);
  });
  it('shared school device: 35 profiles in one database', async () => {
    const store = new Store(await openDb('shared-' + Math.random())), t0 = t();
    const ps = await Promise.all(Array.from({ length: N }, (_, i) => store.createProfile('S' + i)));
    await Promise.all(ps.map(async (p, i) => { for (let k = 1; k <= SAVES; k++) await store.saveSession(p.id, 'ST-0001', { student: i, step: k }); }));
    for (const [i, p] of ps.entries()) { const l = await store.listSessions(p.id); expect(l).toHaveLength(1); expect((l[0].data as any).student).toBe(i); expect(l[0].version).toBe(SAVES); }
    console.log('SHARED', JSON.stringify({ profiles: N, totalMs: Math.round(t() - t0) }));
  });
});
describe('local operation timings (Node, no CPU throttling: NOT a weak-device measurement)', () => {
  const time = (n: number, f: () => void) => { f(); const a = t(); for (let i = 0; i < n; i++) f(); return +((t() - a) / n).toFixed(4); };
  it('geometry and parsing operations are far below 100 ms', () => {
    const hex = regularPrism(6, 3, 5), edges = edgesOf(hex).map(([a, b]) => [hex.verts[a], hex.verts[b]] as [g.V3, g.V3]), pl = g.planeFrom3([0, 0, 2], [1, 0, 2], [0, 1, 2]); if (!pl.ok) throw new Error();
    const r = { sectionMs: time(5000, () => g.sectionPolygon(edges, pl.value)), volumeMs: time(5000, () => volume(hex)), planeMs: time(20000, () => g.planeFrom3([0, 0, 0], [1, 2, 3], [4, 1, 2])), evalMs: time(20000, () => evaluate('pi*(sqrt(25-16))^2*4/3 + 2(1+3)^2')) };
    console.log('OPS', JSON.stringify(r)); for (const v of Object.values(r)) expect(v).toBeLessThan(5);
  });
});
