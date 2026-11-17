import { type V3, add, sub, mul, cross, norm, dot, polygonArea, planeFrom3, pointPlaneDistance } from './geometry';
/** Выпуклый многогранник: вершины и грани (индексы вершин по обходу). */
export interface Poly { verts: V3[]; faces: number[][]; names: string[] }
const SUB = ['₁', '₂', '₃'];
const baseNames = (n: number) => Array.from({ length: n }, (_, i) => 'ABCDEFGH'[i]);
function ring(n: number, side: number, z: number): V3[] {
  const R = side / (2 * Math.sin(Math.PI / n)); // радиус описанной окружности правильного n-угольника
  return Array.from({ length: n }, (_, i) => [R * Math.cos((2 * Math.PI * i) / n), R * Math.sin((2 * Math.PI * i) / n), z] as V3);
}
export function regularPrism(n: number, side: number, h: number): Poly {
  if (!(n >= 3 && n <= 8 && side > 0 && h > 0)) throw new Error('bad_params');
  const b = baseNames(n), faces = [Array.from({ length: n }, (_, i) => i), Array.from({ length: n }, (_, i) => n + i)];
  for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n + ((i + 1) % n), n + i]);
  return { verts: [...ring(n, side, 0), ...ring(n, side, h)], faces, names: [...b, ...b.map(x => x + SUB[0])] };
}
export function regularPyramid(n: number, side: number, h: number): Poly {
  if (!(n >= 3 && n <= 8 && side > 0 && h > 0)) throw new Error('bad_params');
  const faces = [Array.from({ length: n }, (_, i) => i)]; for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n]);
  return { verts: [...ring(n, side, 0), [0, 0, h]], faces, names: [...baseNames(n), 'S'] };
}
export const edgesOf = (p: Poly): [number, number][] => {
  const seen = new Set<string>(), out: [number, number][] = [];
  for (const f of p.faces) f.forEach((a, i) => { const b = f[(i + 1) % f.length], k = a < b ? `${a}-${b}` : `${b}-${a}`; if (!seen.has(k)) { seen.add(k); out.push([a, b]); } });
  return out;
};
const faceArea = (p: Poly, f: number[]) => polygonArea(f.map(i => p.verts[i]));
export const surfaceArea = (p: Poly) => p.faces.reduce((s, f) => s + faceArea(p, f), 0);
/** Объём выпуклого многогранника: разбиение на пирамиды с вершиной во внутренней точке (центроиде вершин). */
export function volume(p: Poly): number {
  const c = mul(p.verts.reduce(add, [0, 0, 0] as V3), 1 / p.verts.length); let v = 0;
  for (const f of p.faces) { const pl = planeFrom3(p.verts[f[0]], p.verts[f[1]], p.verts[f[2]]); if (!pl.ok) throw new Error('degenerate_face'); v += faceArea(p, f) * pointPlaneDistance(c, pl.value) / 3; }
  return v;
}
export const eulerCharacteristic = (p: Poly) => p.verts.length - edgesOf(p).length + p.faces.length;
/** Выпуклость по граням: все вершины по одну сторону от плоскости каждой грани. */
export function isConvex(p: Poly): boolean {
  return p.faces.every(f => { const a = p.verts[f[0]], nv = cross(sub(p.verts[f[1]], a), sub(p.verts[f[2]], a)); if (norm(nv) < 1e-12) return false; const s = p.verts.map(v => dot(nv, sub(v, a))); return s.every(x => x <= 1e-9) || s.every(x => x >= -1e-9); });
}
