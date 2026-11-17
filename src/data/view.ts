import type { Lang } from '../i18n/i18n';
import type { Solution } from './verify';
export interface RuleLike { id: string; type: string; languages: Record<string, { title: string; statement: string }>; validationStatus: string }
export interface RuleView { id: string; type: string; title: string; statement: string; status: string }
/** Данные для отображения справочника на выбранном языке; пропуски перевода заменяются русским вариантом. */
export const ruleViews = (rules: RuleLike[], lang: Lang): RuleView[] => rules.map(r => { const L = r.languages[lang] ?? r.languages.ru; return { id: r.id, type: r.type, title: L.title, statement: L.statement, status: r.validationStatus }; });
export interface SolutionView { steps: { n: number; type: string; text: string; rules: string[] }[]; answer: string; status: string }
export const solutionView = (s: Solution, lang: Lang): SolutionView => ({ steps: s.steps.map((st, i) => ({ n: i + 1, type: st.type, text: st.text[lang] ?? st.text.ru, rules: st.ruleIds })), answer: s.finalAnswer.expression, status: s.validationStatus });
