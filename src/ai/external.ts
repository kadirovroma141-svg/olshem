import type { AIContext, AIProvider, AIResponse } from './provider';
import { validateResponse } from './provider';
import type { FetchLike } from '../storage/sync';
/** Внешний поставщик через серверный прокси. Без явного согласия пользователя запрос не отправляется вообще. Отправляется только минимальный набор полей. */
export class ExternalAIProvider implements AIProvider {
  readonly name = 'external-proxy';
  constructor(private baseUrl: string, private getToken: () => string | null, private hasConsent: () => boolean, private f: FetchLike) {}
  async respond(ctx: AIContext, signal?: AbortSignal): Promise<AIResponse> {
    if (!this.hasConsent()) throw new Error('no_consent');
    const token = this.getToken(); if (!token) throw new Error('no_token');
    const body = { taskId: ctx.taskId, language: ctx.language, hintLevel: ctx.hintLevel, studentExpression: ctx.studentExpression.slice(0, 500), relevantRules: ctx.relevantRules.slice(0, 10), detectedErrors: ctx.detectedErrors.slice(0, 10) };
    const r = await this.f(`${this.baseUrl}/ai`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal });
    if (!r.ok) throw new Error(`http_${r.status}`);
    const j = await r.json(); if (!validateResponse(j?.response)) throw new Error('invalid_response'); return j.response;
  }
}
