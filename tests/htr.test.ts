import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { validateImage, simplify, normalizeStrokes, sanitizeRecognized, assess, recognize, MAX_IMAGE_BYTES, type HtrProvider, type HtrResult } from '../src/htr/provider';
import { openDb, Store } from '../src/storage/db';
import { evaluate } from '../src/core/expr';
const line = (n: number) => Array.from({ length: n }, (_, i) => ({ x: i, y: 0 }));
const prov = (r: Partial<HtrResult> | (() => Promise<HtrResult>)): HtrProvider => ({ name: 'mock', recognize: typeof r === 'function' ? r : async () => ({ text: '4*sqrt(3)', confidence: 0.95, fragments: [], ...r }) });
const strokes = [[{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 90, y: 10 }], [{ x: 10, y: 50 }, { x: 90, y: 90 }]];
describe('image validation', () => {
  it('accepts png/jpeg/webp within limit, rejects others', () => {
    expect(validateImage({ type: 'image/png', size: 1000 })).toEqual({ ok: true }); expect(validateImage({ type: 'image/svg+xml', size: 10 })).toEqual({ ok: false, reason: 'bad_type' });
    expect(validateImage({ type: 'image/jpeg', size: MAX_IMAGE_BYTES + 1 })).toEqual({ ok: false, reason: 'too_large' }); expect(validateImage({ type: 'image/webp', size: 0 })).toEqual({ ok: false, reason: 'empty' });
  });
});
describe('ink preprocessing', () => {
  it('simplify removes collinear points and keeps corners', () => { expect(simplify(line(100), 0.1)).toHaveLength(2); expect(simplify([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }], 0.1)).toHaveLength(3); });
  it('normalize scales into 1000x1000 keeping aspect, drops noise and invalid points', () => {
    const n = normalizeStrokes([...strokes, [{ x: 0, y: 0 }, { x: 1, y: 0 }], [{ x: NaN, y: 1 }, { x: 2, y: 2 }]]); expect(n).toHaveLength(2);
    const xs = n.flat().map(p => p.x), ys = n.flat().map(p => p.y); expect(Math.min(...xs)).toBe(0); expect(Math.max(...xs, ...ys)).toBe(1000);
    expect(normalizeStrokes([])).toEqual([]);
  });
  it('limits the number of points for huge input', () => { const wiggle = Array.from({ length: 20000 }, (_, i) => ({ x: i, y: (i % 2) * 5 + (i % 7) })); expect(normalizeStrokes([wiggle]).flat().length).toBeLessThanOrEqual(5000); });
});
describe('recognition flow', () => {
  it('sanitizes recognized text; OCR symbols become parseable and nothing is executed', () => {
    expect(sanitizeRecognized('4×√3 \u0000 ÷ 3')).toBe('4*√3 / 3'); expect(evaluate(sanitizeRecognized('2²'))).toBe(4); expect(sanitizeRecognized('x'.repeat(900))).toHaveLength(500);
  });
  it('always requires confirmation and reports low-confidence fragments', async () => {
    const r = await recognize(prov({ confidence: 0.9, fragments: [{ text: '4', confidence: 0.99 }, { text: 'sqr?t', confidence: 0.3 }] }), { kind: 'strokes', strokes });
    expect(r).toMatchObject({ status: 'recognized', needsConfirmation: true, needsAttention: true, lowFragments: ['sqr?t'] });
    expect(assess({ text: 'a', confidence: 0.5, fragments: [] }).needsAttention).toBe(true);
  });
  it('unavailable cases never throw and never block', async () => {
    const img = { kind: 'image' as const, bytes: new Uint8Array(10), mime: 'image/png' };
    expect(await recognize(null, img)).toEqual({ status: 'unavailable', reason: 'no_provider' }); expect(await recognize(prov({}), img, { online: false })).toEqual({ status: 'unavailable', reason: 'offline' });
    expect(await recognize(prov({}), { ...img, mime: 'text/html' })).toEqual({ status: 'unavailable', reason: 'bad_type' }); expect(await recognize(prov({}), { kind: 'strokes', strokes: [] })).toEqual({ status: 'unavailable', reason: 'no_strokes' });
    expect(await recognize(prov(async () => { throw new Error('x'); }), img)).toEqual({ status: 'unavailable', reason: 'failed' });
    expect(await recognize(prov(() => new Promise<HtrResult>(() => {})), img, { timeoutMs: 20 })).toEqual({ status: 'unavailable', reason: 'timeout' });
    expect(await recognize(prov({ text: '   ' }), img)).toEqual({ status: 'unavailable', reason: 'failed' });
  });
});
describe('pending photo storage', () => {
  const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
  it('requires consent, validates, and isolates profiles', async () => {
    const s = new Store(await openDb('htr-' + Math.random())), a = await s.createProfile('A'), b = await s.createProfile('B');
    expect(await s.queueImage(a.id, 'T1', png, 'image/png', false)).toEqual({ ok: false, error: 'no_consent' }); expect(await s.queueImage(a.id, 'T1', png, 'text/html', true)).toEqual({ ok: false, error: 'bad_type' });
    expect(await s.listImages(a.id)).toEqual([]);
    const r = await s.queueImage(a.id, 'T1', png, 'image/png', true); if (!r.ok) throw new Error('fail');
    expect(await s.listImages(a.id)).toHaveLength(1); expect(await s.listImages(b.id)).toEqual([]); expect(await s.getImage(b.id, r.id)).toBeNull(); expect(await s.deleteImage(b.id, r.id)).toBe(false);
    expect((await s.getImage(a.id, r.id))!.bytes).toEqual(png); expect(await s.deleteImage(a.id, r.id)).toBe(true); expect(await s.listImages(a.id)).toEqual([]);
  });
  it('migration v2 -> v3 keeps data', async () => {
    const n = 'mig3-' + Math.random(), d2 = await openDb(n, 2), s2 = new Store(d2), p = await s2.createProfile('A'); await s2.saveSession(p.id, 'T', { keep: 1 }); d2.close();
    const d3 = await openDb(n, 3); expect([...d3.objectStoreNames]).toContain('pendingImages'); expect((await new Store(d3).loadSession(p.id, 'T'))!.data).toEqual({ keep: 1 });
  });
});
