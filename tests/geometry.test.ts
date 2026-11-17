import { describe, it, expect } from 'vitest';
import * as g from '../src/core/geometry';
import { evaluate, approxEqual } from '../src/core/expr';
const a = 4, A: g.V3 = [0,0,0], B: g.V3 = [a,0,0], C: g.V3 = [a,a,0], D: g.V3 = [0,a,0];
const A1: g.V3 = [0,0,a], B1: g.V3 = [a,0,a], C1: g.V3 = [a,a,a], D1: g.V3 = [0,a,a];
const cubeEdges: [g.V3,g.V3][] = [[A,B],[B,C],[C,D],[D,A],[A1,B1],[B1,C1],[C1,D1],[D1,A1],[A,A1],[B,B1],[C,C1],[D,D1]];
const pl = (p: g.V3, q: g.V3, r: g.V3) => { const x = g.planeFrom3(p,q,r); if (!x.ok) throw new Error(x.reason); return x.value; };
describe('geometry', () => {
  it('cube diagonal = a√3', () => expect(g.distance(A, C1)).toBeCloseTo(4*Math.sqrt(3), 10));
  it('distance A to plane BDA1 = a/√3', () => expect(g.pointPlaneDistance(A, pl(B,D,A1))).toBeCloseTo(4/Math.sqrt(3), 10));
  it('tetra ABDA1 volume = a³/6', () => expect(g.tetraVolume(A,B,D,A1)).toBeCloseTo(64/6, 10));
  it('skew lines AA1 and BD: a/√2', () => { const r = g.skewLinesDistance(A,A1,B,D); expect(r.ok && r.value).toBeCloseTo(4/Math.SQRT2, 10); });
  it('parallel lines reported', () => { const r = g.skewLinesDistance(A,B,D,C); expect(r.ok).toBe(false); });
  it('collinear / coincident points rejected', () => {
    expect(g.planeFrom3(A,B,[8,0,0])).toEqual({ ok:false, reason:'collinear' });
    expect(g.planeFrom3(A,A,B)).toEqual({ ok:false, reason:'coincident' });
  });
  it('angle AC1 with base plane: arctan(1/√2)', () => {
    const r = g.linePlaneAngle(g.sub(C1,A), pl(A,B,C)); expect(r.ok && r.value).toBeCloseTo(Math.atan(1/Math.SQRT2), 10);
  });
  it('dihedral angle between BDA1 and base ABCD', () => expect(g.planesAngle(pl(B,D,A1), pl(A,B,C))).toBeCloseTo(Math.acos(1/Math.sqrt(3)), 10));
  it('diagonal section A A1 C1 C is a rectangle a × a√2', () => {
    const poly = g.sectionPolygon(cubeEdges, pl(A,A1,C1));
    expect(poly.length).toBe(4); expect(g.polygonArea(poly)).toBeCloseTo(16*Math.SQRT2, 8);
  });
  it('section by plane BDA1 is an equilateral triangle with side a√2', () => {
    const poly = g.sectionPolygon(cubeEdges, pl(B,D,A1));
    expect(poly.length).toBe(3); expect(g.polygonArea(poly)).toBeCloseTo((Math.sqrt(3)/4)*(4*Math.SQRT2)**2, 8);
  });
  it('plane through edge midpoints gives regular hexagon, area 12√3', () => {
    const poly = g.sectionPolygon(cubeEdges, pl([2,0,0],[4,2,0],[0,0,2]));
    expect(poly.length).toBe(6); expect(g.polygonArea(poly)).toBeCloseTo(12*Math.sqrt(3), 8);
  });
  it('line-plane: parallel, coplanar, intersecting', () => {
    const base = pl(A,B,C);
    expect(g.linePlane([0,0,1],[1,0,0],base)).toEqual({ ok:false, reason:'parallel' });
    expect(g.linePlane([1,1,0],[1,0,0],base)).toEqual({ ok:false, reason:'coplanar' });
    const r = g.linePlane([1,1,2],[0,0,-1],base); expect(r.ok && r.value.point).toEqual([1,1,0]);
  });
  it('segment-plane outside segment', () => expect(g.segmentPlane([0,0,1],[0,0,2],pl(A,B,C))).toEqual({ ok:false, reason:'outside' }));
});
describe('expr', () => {
  it('evaluates', () => { expect(evaluate('4*sqrt(3)')).toBeCloseTo(6.928203, 5); expect(evaluate('4√3/3')).toBeCloseTo(2.309401, 5); expect(evaluate('2(1+3)^2')).toBe(32); expect(evaluate('4,5')).toBe(4.5); });
  it('rejects junk, no code execution', () => { for (const s of ['','alert(1)','1+','sqrt(-1)','process.exit()','1/0']) expect(()=>evaluate(s)).toThrow(); });
  it('approxEqual', () => expect(approxEqual(1.3333334, 4/3)).toBe(true));
});
describe('projections', () => {
  const plane = (() => { const r = g.planeFrom3(B, D, A1); if (!r.ok) throw new Error(); return r.value; })();
  it('foot of perpendicular from A to plane BDA1 is the centroid of the triangle', () => {
    const h = g.projectToPlane(A, plane); expect(h[0]).toBeCloseTo(4 / 3, 10); expect(h[1]).toBeCloseTo(4 / 3, 10); expect(h[2]).toBeCloseTo(4 / 3, 10);
    expect(g.distance(A, h)).toBeCloseTo(g.pointPlaneDistance(A, plane), 10); expect(g.pointPlaneDistance(h, plane)).toBeCloseTo(0, 10);
  });
  it('projection of a point already on the plane is itself', () => expect(g.distance(g.projectToPlane(B, plane), B)).toBeLessThan(1e-10));
  it('foot on a line is perpendicular to it; degenerate line rejected', () => {
    const r = g.projectToLine(C1, A, B); expect(r.ok && r.value).toEqual([4, 0, 0]);
    expect(g.projectToLine(C1, A, A)).toEqual({ ok: false, reason: 'coincident' });
    const f = r.ok ? r.value : A; expect(g.dot(g.sub(C1, f), g.sub(B, A))).toBeCloseTo(0, 10);
  });
});
describe('relative position', () => {
  const rel = (a: g.V3, b: g.V3, c: g.V3, d: g.V3) => { const r = g.lineRelation(a, b, c, d); return r.ok ? r.value : r.reason; };
  it('lines of the cube', () => {
    expect(rel(A, B, A1, B1)).toBe('parallel'); expect(rel(A, B, B, C)).toBe('intersecting'); expect(rel(A, B, C, C1)).toBe('skew'); expect(rel(A, B, [8, 0, 0], [12, 0, 0])).toBe('identical');
    expect(rel(A, C1, B, D1)).toBe('intersecting'); expect(rel(A, B1, C, D1)).toBe('skew'); expect(rel(A, A, B, C)).toBe('zero_vector');
  });
  it('line and plane', () => {
    const base = pl(A, B, C), r = (p: g.V3, q: g.V3, plane = base) => { const x = g.linePlaneRelation(p, q, plane); return x.ok ? x.value : x.reason; };
    expect(r(A, A1)).toBe('perpendicular'); expect(r(A1, B1)).toBe('parallel'); expect(r(A, B)).toBe('in_plane'); expect(r(A, C1)).toBe('intersecting'); expect(r(A, A)).toBe('zero_vector');
  });
});
