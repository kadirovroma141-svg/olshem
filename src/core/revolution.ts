/** Тела вращения: формулы ядра (точные, без приближений кроме самого числа π). */
export type Res<T> = { ok: true; value: T } | { ok: false; reason: 'nonpositive' | 'outside' | 'impossible' };
const pos = (...x: number[]) => x.every(v => Number.isFinite(v) && v > 0);
export const cylinder = (r: number, h: number) => { if (!pos(r, h)) throw new Error('nonpositive'); return { volume: Math.PI * r * r * h, lateral: 2 * Math.PI * r * h, total: 2 * Math.PI * r * (r + h) }; };
export const cone = (r: number, h: number) => { if (!pos(r, h)) throw new Error('nonpositive'); const l = Math.hypot(r, h); return { slant: l, volume: Math.PI * r * r * h / 3, lateral: Math.PI * r * l, total: Math.PI * r * (l + r) }; };
export const sphere = (r: number) => { if (!pos(r)) throw new Error('nonpositive'); return { volume: 4 * Math.PI * r ** 3 / 3, surface: 4 * Math.PI * r * r }; };
/** Радиус круга сечения шара радиуса r плоскостью на расстоянии d от центра. */
export function sphereSectionRadius(r: number, d: number): Res<number> {
  if (!pos(r) || !(d >= 0)) return { ok: false, reason: 'nonpositive' };
  if (d >= r) return { ok: false, reason: 'outside' }; // d = r — касание (одна точка), d > r — пересечения нет
  return { ok: true, value: Math.sqrt(r * r - d * d) };
}
/** Радиус основания конуса по образующей и высоте. */
export function coneRadius(l: number, h: number): Res<number> { if (!pos(l, h)) return { ok: false, reason: 'nonpositive' }; if (h >= l) return { ok: false, reason: 'impossible' }; return { ok: true, value: Math.sqrt(l * l - h * h) }; }
export interface RevDef { kind: 'cylinder' | 'cone' | 'sphere'; r: number; h?: number; d?: number }
/** Осевое сечение как набор именованных точек и отрезков для 2D/3D-сцены (шар: центр и два радиуса). */
export function axialSection(d: RevDef): { pts: { n: string; p: [number, number, number] }[]; segs: [string, string][] } {
  const { r } = d, h = d.h ?? r;
  if (d.kind === 'cylinder') return { pts: [{ n: 'A', p: [-r, 0, 0] }, { n: 'B', p: [r, 0, 0] }, { n: 'B₁', p: [r, 0, h] }, { n: 'A₁', p: [-r, 0, h] }], segs: [['A', 'B'], ['B', 'B₁'], ['B₁', 'A₁'], ['A₁', 'A']] };
  if (d.kind === 'cone') return { pts: [{ n: 'A', p: [-r, 0, 0] }, { n: 'B', p: [r, 0, 0] }, { n: 'S', p: [0, 0, h] }], segs: [['A', 'B'], ['B', 'S'], ['S', 'A']] };
  return { pts: [{ n: 'O', p: [0, 0, 0] }, { n: 'M', p: [r, 0, 0] }, { n: 'N', p: [0, 0, r] }], segs: [['O', 'M'], ['O', 'N']] };
}
