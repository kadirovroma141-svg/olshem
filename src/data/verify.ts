import * as g from '../core/geometry';
import { evaluate, approxEqual } from '../core/expr';
import { cylinder, cone, sphere, sphereSectionRadius, type RevDef } from '../core/revolution';
import { regularPrism, regularPyramid, volume, surfaceArea, type Poly } from '../core/polyhedron';
const NM = ['A', 'B', 'C', 'D', 'A₁', 'B₁', 'C₁', 'D₁'];
const V: g.V3[] = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
const EDGES = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
export interface SolidDef { kind: 'prism' | 'pyramid'; n: number; side: number; h: number }
export interface Verification { op: 'distance' | 'pointPlane' | 'tetraVolume' | 'sectionArea' | 'solidVolume' | 'solidSurface' | 'solidEdge' | 'solidTanEdgeBase' | 'solidTanFaceBase' | 'revVolume' | 'revSurface' | 'revLateral' | 'revSectionRadius' | 'coordDistance' | 'coordCosAngle' | 'coordTetraVolume' | 'coordPointPlane' | 'coordSkewDistance' | 'relLines' | 'relLinePlane'; args: string[]; solid?: SolidDef; rev?: RevDef; coords?: Record<string, g.V3>; segs?: [string, string][]; planes?: string[][] }
export const buildSolid = (d: SolidDef): Poly => (d.kind === 'prism' ? regularPrism(d.n, d.side, d.h) : regularPyramid(d.n, d.side, d.h));
export interface Solution { id: string; taskId: string; edge?: number; steps: { id: string; type: string; ruleIds: string[]; text: Record<string, string> }[]; finalAnswer: { expression: string; value: number }; verification: Verification; validationStatus: string; validatedBy?: string }
/** Независимый пересчёт ответа из геометрической модели куба средствами ядра (не из текста решения). */
export function recompute(s: Solution): number {
  const op = s.verification.op, rv = s.verification.rev;
  if (op === 'relLines' || op === 'relLinePlane') {
    const e0 = s.edge ?? 1, P0 = (n: string) => { const i = NM.indexOf(n); if (i < 0) throw new Error('bad_vertex'); return g.mul(V[i], e0); }, a = s.verification.args.map(P0);
    if (op === 'relLines') { const r = g.lineRelation(a[0], a[1], a[2], a[3]); if (!r.ok) throw new Error(r.reason); const c = { parallel: 1, intersecting: 2, skew: 3, identical: -1 }[r.value]; if (c < 0) throw new Error('identical'); return c; }
    const pl0 = g.planeFrom3(a[2], a[3], a[4]); if (!pl0.ok) throw new Error(pl0.reason); const r = g.linePlaneRelation(a[0], a[1], pl0.value); if (!r.ok) throw new Error(r.reason);
    return { parallel: 1, in_plane: 2, perpendicular: 3, intersecting: 4 }[r.value];
  }
  if (op.startsWith('coord')) {
    const cs = s.verification.coords; if (!cs) throw new Error('no_coords');
    const a = s.verification.args.map(n => { if (!cs[n]) throw new Error('bad_point'); return cs[n]; });
    if (op === 'coordDistance') return g.distance(a[0], a[1]);
    if (op === 'coordCosAngle') { const u = g.sub(a[1], a[0]), v = g.sub(a[2], a[0]); if (g.norm(u) < g.EPS || g.norm(v) < g.EPS) throw new Error('zero_vector'); return g.dot(u, v) / (g.norm(u) * g.norm(v)); }
    if (op === 'coordTetraVolume') return g.tetraVolume(a[0], a[1], a[2], a[3]);
    if (op === 'coordPointPlane') { const pl = g.planeFrom3(a[1], a[2], a[3]); if (!pl.ok) throw new Error(pl.reason); return g.pointPlaneDistance(a[0], pl.value); }
    const r = g.skewLinesDistance(a[0], a[1], a[2], a[3]); if (!r.ok) throw new Error(r.reason); return r.value;
  }
  if (op.startsWith('rev')) {
    if (!rv) throw new Error('no_rev');
    const body = rv.kind === 'cylinder' ? cylinder(rv.r, rv.h ?? 0) : rv.kind === 'cone' ? cone(rv.r, rv.h ?? 0) : sphere(rv.r);
    if (op === 'revVolume') return body.volume;
    if (op === 'revLateral') { if (rv.kind === 'sphere') throw new Error('no_lateral'); return (body as ReturnType<typeof cone>).lateral; }
    if (op === 'revSurface') return rv.kind === 'sphere' ? (body as ReturnType<typeof sphere>).surface : (body as ReturnType<typeof cone>).total;
    const r = sphereSectionRadius(rv.r, rv.d ?? -1); if (!r.ok) throw new Error(r.reason); return r.value;
  }
  if (op === 'solidVolume' || op === 'solidSurface' || op === 'solidEdge' || op === 'solidTanEdgeBase' || op === 'solidTanFaceBase') {
    if (!s.verification.solid) throw new Error('no_solid');
    const poly = buildSolid(s.verification.solid), at = (n: string) => { const i = poly.names.indexOf(n); if (i < 0) throw new Error('bad_vertex'); return poly.verts[i]; };
    if (op === 'solidTanEdgeBase' || op === 'solidTanFaceBase') {
      const pl = (i: number, j: number, k: number) => { const r = g.planeFrom3(poly.verts[i], poly.verts[j], poly.verts[k]); if (!r.ok) throw new Error(r.reason); return r.value; }, base = pl(0, 1, 2);
      if (op === 'solidTanEdgeBase') { const r = g.linePlaneAngle(g.sub(at(s.verification.args[1]), at(s.verification.args[0])), base); if (!r.ok) throw new Error(r.reason); return Math.tan(r.value); }
      const a = s.verification.args.map(at), f = g.planeFrom3(a[0], a[1], a[2]); if (!f.ok) throw new Error(f.reason); return Math.tan(g.planesAngle(f.value, base));
    }
    return op === 'solidVolume' ? volume(poly) : op === 'solidSurface' ? surfaceArea(poly) : g.distance(at(s.verification.args[0]), at(s.verification.args[1]));
  }
  const e = s.edge ?? 1;
  const P = (n: string) => g.mul(V[NM.indexOf(n)], e), a = s.verification.args.map(P), pl = (x: g.V3, y: g.V3, z: g.V3) => { const r = g.planeFrom3(x, y, z); if (!r.ok) throw new Error(r.reason); return r.value; };
  switch (s.verification.op) {
    case 'distance': return g.distance(a[0], a[1]);
    case 'pointPlane': return g.pointPlaneDistance(a[0], pl(a[1], a[2], a[3]));
    case 'tetraVolume': return g.tetraVolume(a[0], a[1], a[2], a[3]);
    default: return g.polygonArea(g.sectionPolygon(EDGES.map(([i, j]) => [g.mul(V[i], e), g.mul(V[j], e)] as [g.V3, g.V3]), pl(a[0], a[1], a[2])));
  }
}
export function validateSolutions(sols: Solution[], taskIds: Set<string>, ruleIds: Set<string>): { id: string; problem: string }[] {
  const out: { id: string; problem: string }[] = [], seen = new Set<string>();
  for (const s of sols) {
    const add = (problem: string) => out.push({ id: s.id, problem });
    if (seen.has(s.id)) add('duplicate_id'); seen.add(s.id);
    if (!taskIds.has(s.taskId)) add('unknown_task');
    if (!s.steps?.length) add('no_steps');
    for (const st of s.steps ?? []) { for (const r of st.ruleIds) if (!ruleIds.has(r)) add(`unknown_rule:${r}`); for (const l of ['kk', 'ru', 'en']) if (!st.text?.[l]?.trim()) add(`missing_text:${st.id}:${l}`); }
    try {
      const v = recompute(s);
      if (!approxEqual(v, s.finalAnswer.value)) add('value_mismatch');
      if (!approxEqual(evaluate(s.finalAnswer.expression), v)) add('expression_mismatch');
    } catch { add('recompute_failed'); }
    if (s.validationStatus === 'validated' && !s.validatedBy) add('validated_without_proof');
  }
  return out;
}
