/** Безопасный парсер: числа, + - * / ^, скобки, sqrt(), pi, неявное умножение. Без eval. */
export function evaluate(src: string): number {
  const s = src.replace(/√/g, 'sqrt').replace(/,/g, '.').replace(/π/g, 'pi').toLowerCase();
  const T = s.match(/\d+\.?\d*|[a-z]+|[-+*/^()]/g);
  if (!T || T.join('').length < s.replace(/\s/g, '').length) throw new Error('syntax');
  let p = 0;
  const pk = () => T[p], nx = () => T[p++];
  const expr = (): number => { let v = term(); while (pk() === '+' || pk() === '-') v = nx() === '+' ? v + term() : v - term(); return v; };
  const term = (): number => {
    let v = unary();
    for (;;) {
      const k = pk();
      if (k === '*') { nx(); v *= unary(); } else if (k === '/') { nx(); v /= unary(); }
      else if (k !== undefined && /^(\d|[a-z]|\()/.test(k)) v *= unary(); else break;
    }
    return v;
  };
  // Приоритет как в математике: степень выше унарного минуса, то есть -2^2 = -4; степень правоассоциативна: 2^3^2 = 2^9.
  const unary = (): number => { if (pk() === '-') { nx(); return -unary(); } if (pk() === '+') { nx(); return unary(); } return pow(); };
  const pow = (): number => { const b = atom(); if (pk() === '^') { nx(); return Math.pow(b, unary()); } return b; };
  const atom = (): number => {
    const k = nx();
    if (k === undefined) throw new Error('syntax');
    if (/^\d/.test(k)) return parseFloat(k);
    if (k === 'pi') return Math.PI;
    if (k === 'sqrt') {
      if (pk() !== '(') { const v = atom(); if (v < 0) throw new Error('domain'); return Math.sqrt(v); }
      nx(); const v = expr(); if (nx() !== ')' || v < 0) throw new Error('domain'); return Math.sqrt(v);
    }
    if (k === '(') { const v = expr(); if (nx() !== ')') throw new Error('syntax'); return v; }
    throw new Error('syntax');
  };
  const r = expr();
  if (p < T.length || !Number.isFinite(r)) throw new Error('syntax');
  return r;
}
export const approxEqual = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
