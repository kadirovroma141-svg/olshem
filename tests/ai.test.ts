import { describe, it, expect } from 'vitest';
import { LocalRuleProvider, safeRespond, validateResponse, leaksAnswer, RateLimiter, detectErrors, type AIContext, type AIProvider, type ErrorPattern } from '../src/ai/provider';
import { LANGS } from '../src/i18n/i18n';
import patterns from '../data/tutoring/error_patterns.json';
import sols from '../data/solutions/solutions_part_01.json';
import tasks from '../data/tasks/solid_geometry.json';
const P = patterns as unknown as ErrorPattern[];
const rules = Object.fromEntries((sols as any[]).map(s => [s.taskId, [...new Set(s.steps.flatMap((x: any) => x.ruleIds))]]));
const local = new LocalRuleProvider(P, rules as Record<string, string[]>);
const ctx = (o: Partial<AIContext> = {}): AIContext => ({ taskId: 'ST-0001', language: 'ru', currentStep: 1, studentExpression: '', recentActions: [], detectedErrors: [], relevantRules: [], hintLevel: 1, ...o });
const ans = (id: string) => (sols as any[]).find(s => s.taskId === id).finalAnswer;
describe('local provider', () => {
  it('hint levels progress and are valid responses', async () => {
    const msgs = new Set<string>(); for (const l of [1, 2, 3, 4, 5] as const) { const r = await local.respond(ctx({ hintLevel: l })); expect(validateResponse(r)).toBe(true); msgs.add(r.message); }
    expect(msgs.size).toBe(4);
  });
  it('never leaks the final answer at any level, task or language', async () => {
    for (const t of tasks) for (const language of LANGS) for (const l of [1, 2, 3, 4, 5] as const) { const r = await local.respond(ctx({ taskId: t.id, language, hintLevel: l })); expect(leaksAnswer(r.message, ans(t.id))).toBe(false); }
  });
  it('detects a known wrong answer with hedged wording and low confidence', async () => {
    const r = await local.respond(ctx({ studentExpression: '4*sqrt(2)' }));
    expect(r.type).toBe('error_analysis'); expect(r.identifiedIssue).toBe('ERR-FACE-DIAGONAL'); expect(r.confidence).toBeLessThan(1); expect(r.message.startsWith('Возможно')).toBe(true); expect(r.nextQuestion).toBeTruthy();
  });
  it('correct or unparsable answers do not trigger an error claim', async () => {
    expect((await local.respond(ctx({ studentExpression: '4*sqrt(3)' }))).type).toBe('hint');
    expect((await local.respond(ctx({ studentExpression: '(((' }))).type).toBe('hint');
    expect(detectErrors(P, 'ST-0001', '4√2')).toHaveLength(1);
  });
  it('error pattern wrong values differ from correct answers', () => { for (const p of P) { expect(ans(p.taskId).expression).not.toBe(p.wrongExpression); for (const l of LANGS) expect(p.languages[l].hint.length).toBeGreaterThan(10); } });
});
describe('safeRespond', () => {
  const good = { type: 'hint', message: 'Подумайте о перпендикуляре.', identifiedIssue: null, ruleReferences: [], suggestedAction: null, nextQuestion: null, confidence: 0.8 };
  const prov = (f: () => Promise<any>, name = 'ext'): AIProvider => ({ name, respond: f });
  it('uses the external provider when its answer is valid', async () => { const r = await safeRespond(prov(async () => good), local, ctx(), ans('ST-0001')); expect(r).toMatchObject({ provider: 'ext', degraded: false }); });
  it('falls back on error, timeout, bad schema and answer leak', async () => {
    for (const f of [async () => { throw new Error('net'); }, () => new Promise<any>(() => {}), async () => ({ foo: 1 }), async () => ({ ...good, message: 'Ответ: 4*sqrt(3)' }), async () => ({ ...good, message: 'Это примерно 6.93' })]) {
      const r = await safeRespond(prov(f), local, ctx(), ans('ST-0001'), { timeoutMs: 30 }); expect(r).toMatchObject({ provider: 'local-rules', degraded: true });
    }
  });
  it('works without any external provider and respects the rate limit', async () => {
    expect(await safeRespond(null, local, ctx(), ans('ST-0001'))).toMatchObject({ provider: 'local-rules', degraded: false });
    let t = 0, calls = 0; const lim = new RateLimiter(2, 1000, () => t); const p = prov(async () => { calls++; return good; });
    for (let i = 0; i < 3; i++) await safeRespond(p, local, ctx(), ans('ST-0001'), { limiter: lim }); expect(calls).toBe(2);
    t = 1500; await safeRespond(p, local, ctx(), ans('ST-0001'), { limiter: lim }); expect(calls).toBe(3);
  });
});
