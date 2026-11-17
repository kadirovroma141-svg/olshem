import { describe, it, expect } from 'vitest';
import { evaluate } from '../src/core/expr';
describe('expression precedence', () => {
  it('unary minus binds weaker than power', () => { expect(evaluate('-2^2')).toBe(-4); expect(evaluate('(-2)^2')).toBe(4); expect(evaluate('2^-1')).toBe(0.5); expect(evaluate('-sqrt(4)^2')).toBe(-4); });
  it('power is right-associative', () => expect(evaluate('2^3^2')).toBe(512));
  it('implicit multiplication and fractions', () => { expect(evaluate('2sqrt(9)')).toBe(6); expect(evaluate('4√3/3')).toBeCloseTo(2.309401, 5); expect(evaluate('1/2*4')).toBe(2); expect(evaluate('8/2/2')).toBe(2); });
  it('still rejects junk', () => { for (const s of ['2^', '^2', '2**3', 'x', '--', '(1']) expect(() => evaluate(s)).toThrow(); });
});
