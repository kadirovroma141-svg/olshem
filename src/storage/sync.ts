import type { Store, Op } from './db';
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;
/** HTTP-транспорт: возвращает идентификаторы подтверждённых операций; при сети/401/429/5xx бросает исключение, и очередь остаётся нетронутой. Токен не хранится в IndexedDB/localStorage. */
export const httpTransport = (baseUrl: string, getToken: () => string | null, f: FetchLike) => async (ops: Op[]): Promise<string[]> => {
  const token = getToken(); if (!token) throw new Error('no_token');
  const r = await f(`${baseUrl}/sync`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ ops: ops.map(o => ({ opId: o.opId, kind: o.kind, payload: o.payload })) }) });
  if (!r.ok) throw new Error(`http_${r.status}`);
  const b = await r.json(); return Array.isArray(b?.acked) ? b.acked.filter((x: unknown) => typeof x === 'string') : [];
};
export type SyncStatus = 'synced' | 'pending' | 'offline' | 'error';
/** Один проход синхронизации. Локальная работа не блокируется: любая ошибка просто оставляет операции в очереди. */
export async function syncOnce(store: Store, profileId: string, transport: (ops: Op[]) => Promise<string[]>): Promise<{ status: SyncStatus; sent: number }> {
  try {
    const r = await store.drain(profileId, transport);
    if (r.failed) return { status: (await store.pendingOps(profileId)).length ? 'offline' : 'error', sent: r.sent };
    return { status: 'synced', sent: r.sent };
  } catch { return { status: 'error', sent: 0 }; }
}
