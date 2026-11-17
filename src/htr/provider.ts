/** Рукописный ввод: интерфейс провайдера, подготовка штрихов, проверка фото, оценка результата. Результат распознавания никогда не считается истинным без подтверждения ученика. */
export interface Pt { x: number; y: number }
export type Strokes = Pt[][];
export type HtrInput = { kind: 'strokes'; strokes: Strokes } | { kind: 'image'; bytes: Uint8Array; mime: string };
export interface HtrFragment { text: string; confidence: number }
export interface HtrResult { text: string; confidence: number; fragments: HtrFragment[] }
export interface HtrProvider { readonly name: string; recognize(input: HtrInput, signal?: AbortSignal): Promise<HtrResult> }
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024, IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export type ImageCheck = { ok: true } | { ok: false; reason: 'bad_type' | 'too_large' | 'empty' };
export const validateImage = (f: { type: string; size: number }): ImageCheck => !IMAGE_TYPES.includes(f.type) ? { ok: false, reason: 'bad_type' } : f.size <= 0 ? { ok: false, reason: 'empty' } : f.size > MAX_IMAGE_BYTES ? { ok: false, reason: 'too_large' } : { ok: true };

const d2 = (p: Pt, a: Pt, b: Pt) => { const dx = b.x - a.x, dy = b.y - a.y, m = dx * dx + dy * dy; if (m === 0) return Math.hypot(p.x - a.x, p.y - a.y); const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / m)); return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)); };
/** Упрощение ломаной (Рамер — Дуглас — Пекер), без рекурсии. */
export function simplify(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts; const keep = new Array(pts.length).fill(false); keep[0] = keep[pts.length - 1] = true; const st: [number, number][] = [[0, pts.length - 1]];
  while (st.length) { const [i, j] = st.pop()!; let mx = 0, k = -1; for (let n = i + 1; n < j; n++) { const d = d2(pts[n], pts[i], pts[j]); if (d > mx) { mx = d; k = n; } } if (k >= 0 && mx > eps) { keep[k] = true; st.push([i, k], [k, j]); } }
  return pts.filter((_, i) => keep[i]);
}
const MAX_POINTS = 5000, SIDE = 1000;
/** Нормализация штрихов: отбрасывает шум и некорректные точки, упрощает, масштабирует в квадрат SIDE×SIDE с сохранением пропорций, ограничивает число точек. */
export function normalizeStrokes(strokes: Strokes): Strokes {
  let ss = strokes.map(s => s.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))).filter(s => s.length >= 2 && s.reduce((l, p, i) => (i ? l + Math.hypot(p.x - s[i - 1].x, p.y - s[i - 1].y) : 0), 0) >= 3);
  if (!ss.length) return [];
  for (let eps = 0.5; ss.reduce((n, s) => n + s.length, 0) > MAX_POINTS && eps < 1e4; eps *= 2) ss = ss.map(s => simplify(s, eps));
  ss = ss.map(s => simplify(s, 0.5)); const all = ss.flat(), x0 = Math.min(...all.map(p => p.x)), y0 = Math.min(...all.map(p => p.y)), k = SIDE / Math.max(Math.max(...all.map(p => p.x)) - x0, Math.max(...all.map(p => p.y)) - y0, 1e-9);
  return ss.map(s => s.map(p => ({ x: Math.round((p.x - x0) * k), y: Math.round((p.y - y0) * k) })));
}
/** Безопасная очистка распознанной строки: без управляющих символов, замена типичных OCR-символов, ограничение длины. Строка никогда не выполняется как код. */
export const sanitizeRecognized = (t: string): string => t.split('').map(c => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? ' ' : c)).join('').replace(/×|·/g, '*').replace(/÷/g, '/').replace(/[−–—]/g, '-').replace(/²/g, '^2').replace(/³/g, '^3').replace(/\s+/g, ' ').trim().slice(0, 500);
export interface Assessment { needsAttention: boolean; lowFragments: string[] }
export const assess = (r: HtrResult, threshold = 0.7): Assessment => { const low = r.fragments.filter(f => f.confidence < threshold).map(f => f.text); return { needsAttention: r.confidence < threshold || low.length > 0, lowFragments: low }; };
export type HtrOutcome = { status: 'recognized'; text: string; confidence: number; lowFragments: string[]; needsAttention: boolean; needsConfirmation: true } | { status: 'unavailable'; reason: 'no_provider' | 'offline' | 'failed' | 'timeout' | 'bad_type' | 'too_large' | 'empty' | 'no_strokes' };
/** Распознавание с проверками. Ошибка провайдера или отсутствие сети не блокируют работу: вызывающий код может сохранить фото на устройстве (с согласия) и повторить позже. */
export async function recognize(p: HtrProvider | null, input: HtrInput, o: { online?: boolean; timeoutMs?: number } = {}): Promise<HtrOutcome> {
  if (input.kind === 'image') { const c = validateImage({ type: input.mime, size: input.bytes.byteLength }); if (!c.ok) return { status: 'unavailable', reason: c.reason }; }
  const strokes = input.kind === 'strokes' ? normalizeStrokes(input.strokes) : null; if (strokes && !strokes.length) return { status: 'unavailable', reason: 'no_strokes' };
  if (!p) return { status: 'unavailable', reason: 'no_provider' }; if (o.online === false) return { status: 'unavailable', reason: 'offline' };
  const ac = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined; let timedOut = false;
  try {
    const r = await Promise.race([p.recognize(strokes ? { kind: 'strokes', strokes } : input, ac.signal), new Promise<never>((_, rej) => { timer = setTimeout(() => { timedOut = true; ac.abort(); rej(new Error('timeout')); }, o.timeoutMs ?? 15000); })]);
    const text = sanitizeRecognized(String(r.text ?? '')); if (!text || !Number.isFinite(r.confidence)) return { status: 'unavailable', reason: 'failed' };
    const a = assess({ ...r, fragments: (r.fragments ?? []).map(f => ({ text: sanitizeRecognized(String(f.text)), confidence: f.confidence })) });
    return { status: 'recognized', text, confidence: Math.max(0, Math.min(1, r.confidence)), lowFragments: a.lowFragments, needsAttention: a.needsAttention, needsConfirmation: true };
  } catch { return { status: 'unavailable', reason: timedOut ? 'timeout' : 'failed' }; } finally { clearTimeout(timer); }
}
