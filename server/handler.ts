/** Эталонная реализация API синхронизации (чистая функция, без сети). Аутентификация здесь упрощена: токены выдаёт внешняя система. */
import { RateLimiter } from '../src/ai/provider';
export interface Req { method: string; path: string; token: string | null; body?: unknown }
export interface Res { status: number; body: unknown }
interface Version { clientVersion: number; data: unknown; opId: string; at: number }
interface Rec { head: Version; history: Version[]; conflicts: Version[] }
export interface ServerState { tokens: Map<string, string>; sessions: Map<string, Rec>; seen: Set<string>; limiters: Map<string, RateLimiter> }
export const newServerState = (tokens: Record<string, string> = {}): ServerState => ({ tokens: new Map(Object.entries(tokens)), sessions: new Map(), seen: new Set(), limiters: new Map() });
const MAX_OPS = 100, MAX_DATA = 500_000, RATE = { max: 60, windowMs: 60_000 };
const json = (status: number, body: unknown): Res => ({ status, body });
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function handle(req: Req, st: ServerState, now: () => number = Date.now): Res {
  const profileId = req.token ? st.tokens.get(req.token) : undefined;
  if (!profileId) return json(401, { error: 'unauthorized' });
  let lim = st.limiters.get(profileId); if (!lim) { lim = new RateLimiter(RATE.max, RATE.windowMs, now); st.limiters.set(profileId, lim); }
  if (!lim.tryAcquire()) return json(429, { error: 'rate_limited' });

  if (req.method === 'GET' && req.path === '/sessions') {
    const out = [...st.sessions].filter(([k]) => k.startsWith(profileId + ':')).map(([k, r]) => ({ taskId: k.slice(profileId.length + 1), clientVersion: r.head.clientVersion, conflicts: r.conflicts.length }));
    return json(200, { sessions: out });
  }
  const m = /^\/sessions\/([^/]{1,100})$/.exec(req.path);
  if (req.method === 'GET' && m) { const r = st.sessions.get(`${profileId}:${decodeURIComponent(m[1])}`); return r ? json(200, { head: r.head, conflicts: r.conflicts }) : json(404, { error: 'not_found' }); }

  if (req.method === 'POST' && req.path === '/sync') {
    const ops = (req.body as any)?.ops;
    if (!Array.isArray(ops)) return json(400, { error: 'bad_body' });
    if (ops.length > MAX_OPS) return json(413, { error: 'too_many_ops' });
    const acked: string[] = [], rejected: { opId: string; reason: string }[] = [], conflicts: { opId: string; taskId: string }[] = [];
    for (const op of ops) {
      const opId = typeof op?.opId === 'string' && op.opId.length <= 200 ? op.opId : null;
      if (!opId) { rejected.push({ opId: String(op?.opId).slice(0, 50), reason: 'bad_opid' }); continue; }
      if (st.seen.has(`${profileId}|${opId}`)) { acked.push(opId); continue; } // повторная отправка: подтверждаем, ничего не меняем
      const p = op.payload, taskId = p?.taskId;
      if (op.kind !== 'session' || typeof taskId !== 'string' || !taskId || taskId.length > 100 || !Number.isInteger(p?.version) || p.version < 1 || JSON.stringify(p.data ?? null).length > MAX_DATA) { rejected.push({ opId, reason: 'invalid_op' }); continue; }
      const key = `${profileId}:${taskId}`, v: Version = { clientVersion: p.version, data: p.data, opId, at: now() }, cur = st.sessions.get(key);
      if (!cur) st.sessions.set(key, { head: v, history: [v], conflicts: [] });
      else if (v.clientVersion > cur.head.clientVersion) { cur.head = v; cur.history.push(v); }
      else if (!(v.clientVersion === cur.head.clientVersion && same(v.data, cur.head.data))) { cur.conflicts.push(v); conflicts.push({ opId, taskId }); } // обе версии сохраняются
      st.seen.add(`${profileId}|${opId}`); acked.push(opId);
    }
    return json(200, { acked, rejected, conflicts });
  }
  return json(404, { error: 'not_found' });
}
