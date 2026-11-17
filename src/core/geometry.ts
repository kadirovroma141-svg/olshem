export type V3 = [number, number, number];
export const EPS = 1e-9;
export const sub = (a: V3, b: V3): V3 => [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
export const add = (a: V3, b: V3): V3 => [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
export const mul = (a: V3, k: number): V3 => [a[0]*k, a[1]*k, a[2]*k];
export const dot = (a: V3, b: V3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross = (a: V3, b: V3): V3 => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
export const norm = (a: V3) => Math.hypot(a[0], a[1], a[2]);

/** Результат операции: либо значение, либо код причины (для локализованного сообщения). */
export type Res<T> = { ok: true; value: T } | { ok: false; reason: 'coincident' | 'collinear' | 'parallel' | 'coplanar' | 'outside' | 'zero_vector' };
const ok = <T>(value: T): Res<T> => ({ ok: true, value });
const bad = <T>(reason: Extract<Res<T>, { ok: false }>['reason']): Res<T> => ({ ok: false, reason });

export interface Plane { n: V3; d: number } // n·x = d, |n| = 1
export function planeFrom3(a: V3, b: V3, c: V3): Res<Plane> {
  const q = cross(sub(b, a), sub(c, a)), m = norm(q);
  if (norm(sub(b, a)) < EPS || norm(sub(c, a)) < EPS || norm(sub(c, b)) < EPS) return bad('coincident');
  if (m < EPS * Math.max(1, norm(sub(b, a)) * norm(sub(c, a)))) return bad('collinear');
  const n = mul(q, 1 / m);
  return ok({ n, d: dot(n, a) });
}
export const distance = (a: V3, b: V3) => norm(sub(a, b));
export const pointPlaneDistance = (p: V3, pl: Plane) => Math.abs(dot(pl.n, p) - pl.d);
export function pointLineDistance(p: V3, a: V3, b: V3): Res<number> {
  const u = sub(b, a), m = norm(u);
  if (m < EPS) return bad('coincident');
  return ok(norm(cross(sub(p, a), u)) / m);
}
/** Расстояние между скрещивающимися (или любыми непараллельными) прямыми AB и CD. */
export function skewLinesDistance(a: V3, b: V3, c: V3, d: V3): Res<number> {
  const u = sub(b, a), v = sub(d, c), n = cross(u, v), m = norm(n);
  if (norm(u) < EPS || norm(v) < EPS) return bad('zero_vector');
  if (m < EPS * norm(u) * norm(v)) return bad('parallel');
  return ok(Math.abs(dot(n, sub(c, a))) / m);
}
/** Угол между прямой (направление u) и плоскостью, радианы [0, π/2]. */
export function linePlaneAngle(u: V3, pl: Plane): Res<number> {
  const m = norm(u); if (m < EPS) return bad('zero_vector');
  return ok(Math.asin(Math.min(1, Math.abs(dot(u, pl.n)) / m)));
}
/** Двугранный (острый) угол между плоскостями, радианы. */
export const planesAngle = (p: Plane, q: Plane) => Math.acos(Math.min(1, Math.abs(dot(p.n, q.n))));
export function tetraVolume(a: V3, b: V3, c: V3, d: V3) {
  return Math.abs(dot(sub(b, a), cross(sub(c, a), sub(d, a)))) / 6;
}
/** Пересечение прямой P + t·u с плоскостью. */
export function linePlane(p: V3, u: V3, pl: Plane): Res<{ point: V3; t: number }> {
  const den = dot(pl.n, u);
  if (Math.abs(den) < EPS * norm(u)) return Math.abs(dot(pl.n, p) - pl.d) < EPS ? bad('coplanar') : bad('parallel');
  const t = (pl.d - dot(pl.n, p)) / den;
  return ok({ point: add(p, mul(u, t)), t });
}
/** Пересечение отрезка AB с плоскостью (точка должна лежать на отрезке). */
export function segmentPlane(a: V3, b: V3, pl: Plane): Res<V3> {
  const r = linePlane(a, sub(b, a), pl);
  if (!r.ok) return r as Res<V3>;
  if (r.value.t < -EPS || r.value.t > 1 + EPS) return bad('outside');
  return ok(r.value.point);
}
/** Сечение выпуклого многогранника плоскостью: точки пересечения рёбер, упорядоченные по обходу. */
export function sectionPolygon(edges: [V3, V3][], pl: Plane): V3[] {
  const pts: V3[] = [];
  for (const [a, b] of edges) {
    const da = dot(pl.n, a) - pl.d, db = dot(pl.n, b) - pl.d;
    let p: V3 | null = null;
    if (Math.abs(da) < EPS) p = a; else if (Math.abs(db) < EPS) p = b;
    else if (da * db < 0) p = add(a, mul(sub(b, a), da / (da - db)));
    if (p && !pts.some(q => distance(p!, q) < 1e-7)) pts.push(p);
  }
  if (pts.length < 3) return pts;
  const c = mul(pts.reduce(add, [0, 0, 0] as V3), 1 / pts.length);
  const e1 = norm(sub(pts[0], c)) > EPS ? mul(sub(pts[0], c), 1 / norm(sub(pts[0], c))) : [1, 0, 0] as V3;
  const e2 = cross(pl.n, e1);
  return pts.sort((p, q) => Math.atan2(dot(sub(p, c), e2), dot(sub(p, c), e1)) - Math.atan2(dot(sub(q, c), e2), dot(sub(q, c), e1)));
}
export function polygonArea(poly: V3[]): number {
  let s: V3 = [0, 0, 0];
  for (let i = 0; i < poly.length; i++) s = add(s, cross(poly[i], poly[(i + 1) % poly.length]));
  return norm(s) / 2;
}
/** Ортогональная проекция точки на плоскость. */
export const projectToPlane = (p: V3, pl: Plane): V3 => sub(p, mul(pl.n, dot(pl.n, p) - pl.d));
/** Основание перпендикуляра из точки на прямую AB. */
export function projectToLine(p: V3, a: V3, b: V3): Res<V3> {
  const u = sub(b, a), m2 = dot(u, u);
  if (m2 < EPS * EPS) return bad('coincident');
  return ok(add(a, mul(u, dot(sub(p, a), u) / m2)));
}
export type LineRelation = 'parallel' | 'identical' | 'intersecting' | 'skew';
/** Взаимное расположение прямых AB и CD. Допуски масштабируются длинами векторов. */
export function lineRelation(a: V3, b: V3, c: V3, d: V3): Res<LineRelation> {
  const u = sub(b, a), v = sub(d, c), nu = norm(u), nv = norm(v);
  if (nu < EPS || nv < EPS) return bad('zero_vector');
  const cr = cross(u, v);
  if (norm(cr) < EPS * nu * nv) return ok(norm(cross(sub(c, a), u)) < EPS * nu * Math.max(1, norm(sub(c, a))) ? 'identical' : 'parallel');
  return ok(Math.abs(dot(sub(c, a), cr)) < EPS * norm(cr) * Math.max(1, norm(sub(c, a))) ? 'intersecting' : 'skew');
}
export type LinePlaneRelation = 'in_plane' | 'parallel' | 'perpendicular' | 'intersecting';
/** Взаимное расположение прямой AB и плоскости; `perpendicular` — частный случай пересечения под прямым углом. */
export function linePlaneRelation(a: V3, b: V3, pl: Plane): Res<LinePlaneRelation> {
  const u = sub(b, a), nu = norm(u); if (nu < EPS) return bad('zero_vector');
  if (Math.abs(dot(u, pl.n)) < EPS * nu) return ok(Math.abs(dot(pl.n, a) - pl.d) < EPS * Math.max(1, norm(a)) ? 'in_plane' : 'parallel');
  return ok(norm(cross(u, pl.n)) < EPS * nu ? 'perpendicular' : 'intersecting');
}
