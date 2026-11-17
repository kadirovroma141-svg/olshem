/** Слой хранения на IndexedDB: профили, рабочие сессии, очередь синхронизации. Все ключи сессий включают profileId. */
import { validateImage } from '../htr/provider';
export const DB_VERSION = 3;
type Mig = (db: IDBDatabase, tx: IDBTransaction) => void;
/** Миграции применяются по порядку; данные прошлых версий не удаляются. */
export const MIGRATIONS: Record<number, Mig> = {
  1: db => {
    db.createObjectStore('profiles', { keyPath: 'id' });
    const ws = db.createObjectStore('workingSessions', { keyPath: 'key' }); ws.createIndex('byProfile', 'profileId');
    db.createObjectStore('syncQueue', { keyPath: 'opId' });
    db.createObjectStore('metadata', { keyPath: 'key' });
  },
  2: db => { const h = db.createObjectStore('hintHistory', { keyPath: 'id' }); h.createIndex('byProfile', 'profileId'); },
  3: db => { const i = db.createObjectStore('pendingImages', { keyPath: 'id' }); i.createIndex('byProfile', 'profileId'); },
};
export function openDb(name = 'olshem', version = DB_VERSION): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(name, version);
    r.onupgradeneeded = e => { for (let v = e.oldVersion + 1; v <= (e.newVersion ?? version); v++) MIGRATIONS[v]?.(r.result, r.transaction!); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error ?? new Error('open_failed'));
    r.onblocked = () => rej(new Error('blocked'));
  });
}
const done = (tx: IDBTransaction) => new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error ?? new Error('aborted')); });
const req = <T>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export interface Profile { id: string; displayName: string; guest: boolean; createdAt: number }
export interface Session { key: string; profileId: string; taskId: string; version: number; syncedVersion: number; data: unknown; savedAt: number }
export interface Op { opId: string; profileId: string; kind: string; payload: unknown; createdAt: number }
export interface PendingImage { id: string; profileId: string; taskId: string; mime: string; size: number; bytes: Uint8Array; createdAt: number }
export type ImageSaveResult = { ok: true; id: string } | { ok: false; error: 'no_consent' | 'bad_type' | 'too_large' | 'empty' | 'quota' | 'storage' };
export type SaveResult = { ok: true; version: number } | { ok: false; error: 'quota' | 'storage' };

export class Store {
  constructor(private db: IDBDatabase) {}
  /** Случайный идентификатор профиля без персональных данных. */
  async createProfile(displayName: string, guest = false): Promise<Profile> {
    const p: Profile = { id: crypto.randomUUID(), displayName, guest, createdAt: Date.now() };
    const tx = this.db.transaction('profiles', 'readwrite'); tx.objectStore('profiles').put(p); await done(tx); return p;
  }
  /** Профили в порядке создания (стабильный порядок для списка выбора). */
  listProfiles = async (): Promise<Profile[]> => ((await req(this.db.transaction('profiles').objectStore('profiles').getAll())) as Profile[]).sort((x, y) => x.createdAt - y.createdAt || x.id.localeCompare(y.id));
  /** Сохраняет сессию и операцию синхронизации в одной транзакции. Успех сообщается только после commit. */
  async saveSession(profileId: string, taskId: string, data: unknown): Promise<SaveResult> {
    try {
      const key = `${profileId}:${taskId}`, tx = this.db.transaction(['workingSessions', 'syncQueue'], 'readwrite'), ws = tx.objectStore('workingSessions');
      const old = (await req(ws.get(key))) as Session | undefined, version = (old?.version ?? 0) + 1;
      ws.put({ key, profileId, taskId, version, syncedVersion: old?.syncedVersion ?? 0, data, savedAt: Date.now() } satisfies Session);
      tx.objectStore('syncQueue').put({ opId: `${key}@${version}`, profileId, kind: 'session', payload: { taskId, version, data }, createdAt: Date.now() } satisfies Op);
      await done(tx); return { ok: true, version };
    } catch (e: any) { return { ok: false, error: e?.name === 'QuotaExceededError' ? 'quota' : 'storage' }; }
  }
  /** Читает сессию только если она принадлежит profileId (проверка владельца, а не только ключа). */
  async loadSession(profileId: string, taskId: string): Promise<Session | null> {
    const s = (await req(this.db.transaction('workingSessions').objectStore('workingSessions').get(`${profileId}:${taskId}`))) as Session | undefined;
    return s && s.profileId === profileId ? s : null;
  }
  async listSessions(profileId: string): Promise<Session[]> {
    const all = (await req(this.db.transaction('workingSessions').objectStore('workingSessions').index('byProfile').getAll(profileId))) as Session[];
    return all.filter(s => s.profileId === profileId).sort((a, b) => b.savedAt - a.savedAt);
  }
  /** Фото рукописного решения сохраняется на устройстве ТОЛЬКО с явного согласия, с проверкой типа и размера. */
  async queueImage(profileId: string, taskId: string, bytes: Uint8Array, mime: string, consent: boolean): Promise<ImageSaveResult> {
    if (!consent) return { ok: false, error: 'no_consent' };
    const c = validateImage({ type: mime, size: bytes.byteLength }); if (!c.ok) return { ok: false, error: c.reason };
    try { const id = crypto.randomUUID(), tx = this.db.transaction('pendingImages', 'readwrite'); tx.objectStore('pendingImages').put({ id, profileId, taskId, mime, size: bytes.byteLength, bytes, createdAt: Date.now() } satisfies PendingImage); await done(tx); return { ok: true, id }; }
    catch (e: any) { return { ok: false, error: e?.name === 'QuotaExceededError' ? 'quota' : 'storage' }; }
  }
  async listImages(profileId: string): Promise<Omit<PendingImage, 'bytes'>[]> {
    const all = (await req(this.db.transaction('pendingImages').objectStore('pendingImages').index('byProfile').getAll(profileId))) as PendingImage[];
    return all.filter(i => i.profileId === profileId).map(i => ({ id: i.id, profileId: i.profileId, taskId: i.taskId, mime: i.mime, size: i.size, createdAt: i.createdAt }));
  }
  async getImage(profileId: string, id: string): Promise<PendingImage | null> { const i = (await req(this.db.transaction('pendingImages').objectStore('pendingImages').get(id))) as PendingImage | undefined; return i && i.profileId === profileId ? i : null; }
  async deleteImage(profileId: string, id: string): Promise<boolean> { if (!(await this.getImage(profileId, id))) return false; const tx = this.db.transaction('pendingImages', 'readwrite'); tx.objectStore('pendingImages').delete(id); await done(tx); return true; }
  pendingOps = async (profileId: string): Promise<Op[]> => ((await req(this.db.transaction('syncQueue').objectStore('syncQueue').getAll())) as Op[]).filter(o => o.profileId === profileId).sort((a, b) => a.createdAt - b.createdAt);
  /** Отправка порциями; операция удаляется только после подтверждения. Повторная отправка безопасна: opId идемпотентен. */
  async drain(profileId: string, send: (ops: Op[]) => Promise<string[]>, batch = 20): Promise<{ sent: number; failed: boolean }> {
    let sent = 0;
    for (;;) {
      const ops = (await this.pendingOps(profileId)).slice(0, batch); if (!ops.length) return { sent, failed: false };
      let acked: string[]; try { acked = await send(ops); } catch { return { sent, failed: true }; }
      if (!acked.length) return { sent, failed: true };
      const tx = this.db.transaction(['syncQueue', 'workingSessions'], 'readwrite');
      for (const id of acked) tx.objectStore('syncQueue').delete(id);
      for (const o of ops) if (acked.includes(o.opId) && o.kind === 'session') {
        const k = `${o.profileId}:${(o.payload as any).taskId}`, cur = (await req(tx.objectStore('workingSessions').get(k))) as Session | undefined;
        if (cur) tx.objectStore('workingSessions').put({ ...cur, syncedVersion: Math.max(cur.syncedVersion, (o.payload as any).version) });
      }
      await done(tx); sent += acked.length;
    }
  }
}
/** Конфликт: на сервере версия новее той, на основе которой правил клиент, и при этом есть несинхронизированные правки. Ничего не перезаписывается молча. */
export const detectConflict = (local: Pick<Session, 'version' | 'syncedVersion'>, serverVersion: number) => serverVersion > local.syncedVersion && local.version > local.syncedVersion;
