import { describe, it, expect } from 'vitest';
import { cylinder, cone, sphere, sphereSectionRadius, coneRadius, axialSection } from '../src/core/revolution';
describe('solids of revolution', () => {
  it('cylinder r=3 h=5', () => { const c = cylinder(3, 5); expect(c.volume).toBeCloseTo(45 * Math.PI, 10); expect(c.lateral).toBeCloseTo(30 * Math.PI, 10); expect(c.total).toBeCloseTo(48 * Math.PI, 10); });
  it('cone r=3 h=4 has slant 5, lateral 15π, volume 12π, total 24π', () => { const c = cone(3, 4); expect(c.slant).toBe(5); expect(c.lateral).toBeCloseTo(15 * Math.PI, 10); expect(c.volume).toBeCloseTo(12 * Math.PI, 10); expect(c.total).toBeCloseTo(24 * Math.PI, 10); });
  it('sphere r=3: V=36π, S=36π', () => { const s = sphere(3); expect(s.volume).toBeCloseTo(36 * Math.PI, 10); expect(s.surface).toBeCloseTo(36 * Math.PI, 10); });
  it('sphere section: r=5, d=3 -> 4; tangent and outside rejected', () => {
    expect(sphereSectionRadius(5, 3)).toEqual({ ok: true, value: 4 }); expect(sphereSectionRadius(5, 5)).toEqual({ ok: false, reason: 'outside' }); expect(sphereSectionRadius(5, 7).ok).toBe(false); expect(sphereSectionRadius(5, 0)).toEqual({ ok: true, value: 5 });
  });
  it('cone radius from slant and height; impossible when h >= l', () => { expect(coneRadius(13, 12)).toEqual({ ok: true, value: 5 }); expect(coneRadius(5, 5)).toEqual({ ok: false, reason: 'impossible' }); });
  it('invalid parameters throw', () => { expect(() => cylinder(0, 1)).toThrow(); expect(() => cone(1, -1)).toThrow(); expect(() => sphere(NaN)).toThrow(); });
  it('axial section shapes', () => { expect(axialSection({ kind: 'cone', r: 3, h: 4 }).pts).toHaveLength(3); expect(axialSection({ kind: 'cylinder', r: 2, h: 5 }).segs).toHaveLength(4); });
});
