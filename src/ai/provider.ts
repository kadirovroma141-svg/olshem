import { t, type Lang } from '../i18n/i18n';
import { evaluate, approxEqual } from '../core/expr';
export interface AIContext { taskId: string; language: Lang; currentStep: number; studentExpression: string; recentActions: string[]; detectedErrors: string[]; relevantRules: string[]; hintLevel: 1 | 2 | 3 | 4 | 5 }
export interface AIResponse { type: 'hint' | 'error_analysis'; message: string; identifiedIssue: string | null; ruleReferences: string[]; suggestedAction: string | null; nextQuestion: string | null; confidence: number }
export interface AIProvider { readonly name: string; respond(ctx: AIContext, signal?: AbortSignal): Promise<AIResponse> }
export interface ErrorPattern { code: string; taskId: string; wrongExpression: string; relatedRules: string[]; languages: Record<string, { title: string; hint: string; selfCheck: string }> }

/** Строгая проверка ответа провайдера. Всё, что не соответствует схеме, не показывается ученику. */
export function validateResponse(r: unknown): r is AIResponse {
  const o = r as any; if (!o || typeof o !== 'object') return false;
  return ['hint', 'error_analysis'].includes(o.type) && typeof o.message === 'string' && o.message.trim().length > 0 && o.message.length <= 1200 &&
    (o.identifiedIssue === null || typeof o.identifiedIssue === 'string') && Array.isArray(o.ruleReferences) && o.ruleReferences.every((x: unknown) => typeof x === 'string') &&
    (o.suggestedAction === null || typeof o.suggestedAction === 'string') && (o.nextQuestion === null || typeof o.nextQuestion === 'string') &&
    typeof o.confidence === 'number' && o.confidence >= 0 && o.confidence <= 1;
}
const fmtNum = (n: number) => [String(Math.round(n * 1e4) / 1e4), String(Math.round(n * 100) / 100)];
/** Защита от утечки ответа: сообщение не должно содержать эталонное выражение или значение. */
export function leaksAnswer(text: string, answer: { expression: string; value: number }): boolean {
  const flat = text.replace(/\s/g, '').toLowerCase();
  return flat.includes(answer.expression.replace(/\s/g, '').toLowerCase()) || fmtNum(answer.value).some(v => new RegExp(`(^|[^\\d.,])${v.replace('.', '[.,]')}($|[^\\d])`).test(text));
}
export function detectErrors(patterns: ErrorPattern[], taskId: string, expr: string): ErrorPattern[] {
  let v: number; try { v = evaluate(expr); } catch { return []; }
  return patterns.filter(p => p.taskId === taskId && approxEqual(v, evaluate(p.wrongExpression)));
}
/** Детерминированный поставщик: работает без сети. Ошибка объявляется только как предположение (confidence < 1). */
export class LocalRuleProvider implements AIProvider {
  readonly name = 'local-rules';
  constructor(private patterns: ErrorPattern[], private rulesByTask: Record<string, string[]>) {}
  async respond(ctx: AIContext): Promise<AIResponse> {
    const err = detectErrors(this.patterns, ctx.taskId, ctx.studentExpression)[0], L = err?.languages[ctx.language];
    if (err && L) return { type: 'error_analysis', message: t(ctx.language, 'ai.maybeError') + L.hint, identifiedIssue: err.code, ruleReferences: err.relatedRules, suggestedAction: null, nextQuestion: L.selfCheck, confidence: 0.6 };
    const lvl = Math.min(ctx.hintLevel, 4);
    return { type: 'hint', message: t(ctx.language, `hint.${lvl}`), identifiedIssue: null, ruleReferences: lvl >= 3 ? this.rulesByTask[ctx.taskId] ?? [] : [], suggestedAction: null, nextQuestion: null, confidence: 1 };
  }
}
export class RateLimiter {
  private hits: number[] = [];
  constructor(private max: number, private windowMs: number, private now: () => number = Date.now) {}
  tryAcquire(): boolean { const n = this.now(); this.hits = this.hits.filter(h => n - h < this.windowMs); if (this.hits.length >= this.max) return false; this.hits.push(n); return true; }
}
export interface SafeResult { response: AIResponse; provider: string; degraded: boolean }
/** Внешний провайдер → проверка схемы и утечки ответа → при любой проблеме локальный резерв. */
export async function safeRespond(primary: AIProvider | null, fallback: AIProvider, ctx: AIContext, answer: { expression: string; value: number }, opts: { timeoutMs?: number; limiter?: RateLimiter } = {}): Promise<SafeResult> {
  if (primary && (!opts.limiter || opts.limiter.tryAcquire())) {
    const ac = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const r = await Promise.race([primary.respond(ctx, ac.signal), new Promise<never>((_, rej) => { timer = setTimeout(() => { ac.abort(); rej(new Error('timeout')); }, opts.timeoutMs ?? 8000); })]);
      if (validateResponse(r) && !leaksAnswer(r.message, answer) && !(r.nextQuestion && leaksAnswer(r.nextQuestion, answer))) return { response: r, provider: primary.name, degraded: false };
    } catch { /* сеть, тайм-аут, исключение провайдера: идём в резерв */ } finally { clearTimeout(timer); }
  }
  return { response: await fallback.respond(ctx), provider: fallback.name, degraded: !!primary };
}
