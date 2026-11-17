import { LANGS } from '../i18n/i18n';
export interface TaskIssue { id: string; problem: string }
const REQ = ['id', 'grade', 'topic', 'difficulty', 'languages', 'source', 'validationStatus'];
/** Проверка структуры базы задач: уникальные id, обязательные поля, три языка, источник, статус. */
export function validateTasks(tasks: any[], solutionIds: Set<string> = new Set()): TaskIssue[] {
  const out: TaskIssue[] = [], seen = new Set<string>();
  tasks.forEach((t, i) => {
    const id = t?.id ?? `#${i}`, add = (problem: string) => out.push({ id, problem });
    for (const k of REQ) if (t?.[k] === undefined) add(`missing:${k}`);
    if (seen.has(t?.id)) add('duplicate_id'); seen.add(t?.id);
    if (![10, 11].includes(t?.grade)) add('bad_grade');
    if (!(t?.difficulty >= 1 && t?.difficulty <= 5)) add('bad_difficulty');
    for (const l of LANGS) if (!t?.languages?.[l]?.title?.trim() || !t?.languages?.[l]?.statement?.trim()) add(`missing_lang:${l}`);
    if (t?.source?.type === 'textbook' && !t.source.citation) add('textbook_without_citation');
    if (!['original', 'open', 'licensed', 'textbook'].includes(t?.source?.type)) add('bad_source_type');
    if (t?.validationStatus === 'validated' && !t?.validatedBy) add('validated_without_proof');
    if (t?.solutionId && solutionIds.size && !solutionIds.has(t.solutionId)) add('dangling_solution');
  });
  return out;
}
