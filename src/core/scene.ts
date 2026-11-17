import type { V3 } from './geometry';
export interface SceneObject { id: string; type: 'point' | 'segment' | 'plane' | 'polyhedron'; params: Record<string, unknown>; deps: string[]; style?: Record<string, unknown> }
export interface Scene {
  sceneId: string; version: 1; coordinateSystem: 'cartesian-3d'; taskId: string | null; stepId: string | null;
  objects: SceneObject[]; constraints: unknown[]; measurements: unknown[]; camera: Record<string, unknown>; displaySettings: Record<string, unknown>;
}
export const newScene = (sceneId: string, taskId: string | null = null): Scene => ({
  sceneId, version: 1, coordinateSystem: 'cartesian-3d', taskId, stepId: null, objects: [], constraints: [], measurements: [], camera: {}, displaySettings: {},
});
export const serialize = (s: Scene) => JSON.stringify(s);
const isV3 = (v: unknown): v is V3 => Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(n));
/** Безопасная загрузка: любой некорректный JSON даёт ошибку с кодом, а не исключение в UI. */
export function deserialize(json: string): { ok: true; scene: Scene } | { ok: false; error: string } {
  let o: any;
  try { o = JSON.parse(json); } catch { return { ok: false, error: 'invalid_json' }; }
  if (!o || typeof o !== 'object' || o.version !== 1 || o.coordinateSystem !== 'cartesian-3d' || typeof o.sceneId !== 'string') return { ok: false, error: 'bad_header' };
  if (!Array.isArray(o.objects)) return { ok: false, error: 'bad_objects' };
  const ids = new Set<string>();
  for (const ob of o.objects) {
    if (!ob || typeof ob.id !== 'string' || ids.has(ob.id)) return { ok: false, error: 'duplicate_or_missing_id' };
    if (!['point', 'segment', 'plane', 'polyhedron'].includes(ob.type) || !Array.isArray(ob.deps)) return { ok: false, error: 'bad_object' };
    if (ob.type === 'point' && !isV3(ob.params?.xyz)) return { ok: false, error: 'bad_point' };
    ids.add(ob.id);
  }
  for (const ob of o.objects) if (ob.deps.some((d: string) => !ids.has(d))) return { ok: false, error: 'missing_dependency' };
  return { ok: true, scene: o as Scene };
}
