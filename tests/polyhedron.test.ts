import { describe, it, expect } from 'vitest';
import { regularPrism, regularPyramid, volume, surfaceArea, edgesOf, eulerCharacteristic, isConvex } from '../src/core/polyhedron';
import { planeFrom3, sectionPolygon, polygonArea, type V3 } from '../src/core/geometry';
const edges = (p: ReturnType<typeof regularPrism>) => edgesOf(p).map(([a, b]) => [p.verts[a], p.verts[b]] as [V3, V3]);
describe('polyhedra', () => {
  it('triangular prism a=2 h=3: V=3√3, S=18+2√3', () => { const p = regularPrism(3, 2, 3); expect(volume(p)).toBeCloseTo(3 * Math.sqrt(3), 9); expect(surfaceArea(p)).toBeCloseTo(18 + 2 * Math.sqrt(3), 9); });
  it('square pyramid a=4 h=3: V=16, S=16+8√13', () => { const p = regularPyramid(4, 4, 3); expect(volume(p)).toBeCloseTo(16, 9); expect(surfaceArea(p)).toBeCloseTo(16 + 8 * Math.sqrt(13), 9); });
  it('hexagonal prism a=2 h=1: V=6√3', () => expect(volume(regularPrism(6, 2, 1))).toBeCloseTo(6 * Math.sqrt(3), 9));
  it('Euler characteristic is 2 and solids are convex', () => { for (const p of [regularPrism(3, 1, 1), regularPrism(5, 1, 2), regularPyramid(3, 1, 1), regularPyramid(6, 2, 3)]) { expect(eulerCharacteristic(p)).toBe(2); expect(isConvex(p)).toBe(true); } });
  it('edge counts: prism 3n, pyramid 2n', () => { expect(edgesOf(regularPrism(5, 1, 1))).toHaveLength(15); expect(edgesOf(regularPyramid(5, 1, 1))).toHaveLength(10); });
  it('pyramid section through apex and base diagonal is a triangle of area 6√2', () => {
    const p = regularPyramid(4, 4, 3), pl = planeFrom3(p.verts[1], p.verts[3], p.verts[4]); if (!pl.ok) throw new Error();
    const poly = sectionPolygon(edges(p), pl.value); expect(poly).toHaveLength(3); expect(polygonArea(poly)).toBeCloseTo(6 * Math.SQRT2, 9);
  });
  it('mid-height section of a hexagonal prism equals its base area', () => {
    const p = regularPrism(6, 2, 4), pl = planeFrom3([0, 0, 2], [1, 0, 2], [0, 1, 2]); if (!pl.ok) throw new Error();
    expect(polygonArea(sectionPolygon(edges(p), pl.value))).toBeCloseTo(6 * Math.sqrt(3), 9);
  });
  it('rejects invalid parameters', () => { expect(() => regularPrism(2, 1, 1)).toThrow(); expect(() => regularPyramid(4, -1, 1)).toThrow(); });
});
