/** Логика занятия класса без UI и сервера. Индивидуальные состояния изолированы; сводка не содержит идентификаторов учеников и времени решения. */
export type TaskStatus = 'not_started' | 'in_progress' | 'needs_review' | 'done' | 'deferred' | 'repeat';
export type Mode = 'free' | 'sequential' | 'individual';
export interface Attempt { id: string; studentId: string; taskId: string; at: number; correct: boolean | null; hintsUsed: number; errorCodes: string[]; method?: string }
export interface TaskState { taskId: string; status: TaskStatus; attempts: Attempt[] }
export interface ClassSession { id: string; taskIds: string[]; mode: Mode; routes: Record<string, string[]>; studentIds: string[]; startedAt: number | null; endedAt: number | null; allowIndividualView: boolean }
export type States = Record<string, TaskState[]>; // studentId -> состояния задач (у каждого ученика свой массив)

export const createSession = (id: string, taskIds: string[], studentIds: string[], mode: Mode = 'free', routes: Record<string, string[]> = {}): ClassSession =>
  ({ id, taskIds: [...taskIds], mode, routes, studentIds: [...studentIds], startedAt: null, endedAt: null, allowIndividualView: false });
export const start = (s: ClassSession, at: number): ClassSession => ({ ...s, startedAt: s.startedAt ?? at });
export const end = (s: ClassSession, at: number): ClassSession => ({ ...s, endedAt: at });
export const newStates = (taskIds: string[]): TaskState[] => taskIds.map(taskId => ({ taskId, status: 'not_started', attempts: [] }));
const stOf = (states: TaskState[], id: string) => states.find(t => t.taskId === id)?.status ?? 'not_started';

/** Какие задачи ученик вправе открыть сейчас. До старта и после завершения занятия — никакие. */
export function allowedTasks(s: ClassSession, studentId: string, states: TaskState[]): string[] {
  if (s.startedAt === null || s.endedAt !== null) return [];
  const list = s.mode === 'individual' ? s.routes[studentId] ?? [] : s.taskIds;
  if (s.mode === 'free') return [...list];
  const out: string[] = [];
  for (const id of list) { out.push(id); if (!['done', 'deferred'].includes(stOf(states, id))) break; } // последовательно: дальше после выполненной или отложенной
  return out;
}
const TRANS: Record<TaskStatus, TaskStatus[]> = {
  not_started: ['in_progress', 'deferred'], in_progress: ['needs_review', 'done', 'deferred'], needs_review: ['in_progress', 'done', 'repeat'],
  done: ['repeat'], deferred: ['in_progress'], repeat: ['in_progress', 'done'],
};
export const canTransition = (from: TaskStatus, to: TaskStatus) => from === to || TRANS[from].includes(to);
export function setStatus(states: TaskState[], taskId: string, to: TaskStatus): TaskState[] {
  const cur = states.find(t => t.taskId === taskId); if (!cur) throw new Error('unknown_task');
  if (!canTransition(cur.status, to)) throw new Error(`bad_transition:${cur.status}->${to}`);
  return states.map(t => (t.taskId === taskId ? { ...t, status: to } : t));
}
/** Запись попытки идемпотентна по id. Верная попытка → done; неверная → in_progress; непроверяемая автоматически → needs_review. Выполненная задача не «откатывается». */
export function recordAttempt(states: TaskState[], a: Attempt): TaskState[] {
  return states.map(t => {
    if (t.taskId !== a.taskId) return t;
    if (t.attempts.some(x => x.id === a.id)) return t;
    const status: TaskStatus = t.status === 'done' ? 'done' : a.correct === true ? 'done' : a.correct === null ? 'needs_review' : 'in_progress';
    return { ...t, status, attempts: [...t.attempts, a] };
  });
}
/** Слияние двух копий состояния (разные устройства/синхронизация): попытки объединяются без потерь, статус — «наиболее продвинутый» без отката done. */
const RANK: Record<TaskStatus, number> = { not_started: 0, deferred: 1, in_progress: 2, repeat: 3, needs_review: 4, done: 5 };
export function mergeStates(a: TaskState[], b: TaskState[]): TaskState[] {
  const ids = [...new Set([...a, ...b].map(t => t.taskId))].sort();
  return ids.map(id => {
    const x = a.find(t => t.taskId === id), y = b.find(t => t.taskId === id), att = new Map<string, Attempt>();
    for (const t of [x, y]) for (const at of t?.attempts ?? []) att.set(at.id, at);
    const status = [x?.status, y?.status].filter((v): v is TaskStatus => !!v).sort((p, q) => RANK[q] - RANK[p])[0] ?? 'not_started';
    return { taskId: id, status, attempts: [...att.values()].sort((p, q) => p.at - q.at || p.id.localeCompare(q.id)) };
  });
}
export interface TaskMeta { id: string; topic: string; difficulty: number }
export type Recommendation = { kind: 'analogous' | 'harder' | 'repeat' | 'combine'; taskId: string | null };
/** Рекомендация по качеству, а не скорости: учитываются верность, подсказки и ошибки; время попыток не используется. */
export function recommend(current: TaskMeta, state: TaskState, catalog: TaskMeta[], states: TaskState[]): Recommendation {
  const open = (c: TaskMeta) => c.id !== current.id && !['done'].includes(stOf(states, c.id));
  const last = state.attempts[state.attempts.length - 1], errs = state.attempts.flatMap(a => a.errorCodes);
  if (!last || last.correct !== true) return { kind: 'repeat', taskId: current.id };
  const clean = last.hintsUsed <= 1 && errs.length === 0 && state.attempts.length === 1;
  const same = catalog.filter(c => open(c) && c.topic === current.topic);
  if (clean) {
    const harder = same.filter(c => c.difficulty > current.difficulty).sort((p, q) => p.difficulty - q.difficulty || p.id.localeCompare(q.id))[0];
    if (harder) return { kind: 'harder', taskId: harder.id };
    const other = catalog.filter(c => open(c) && c.topic !== current.topic && c.difficulty >= current.difficulty).sort((p, q) => p.id.localeCompare(q.id))[0];
    return { kind: 'combine', taskId: other?.id ?? null };
  }
  const analog = same.filter(c => c.difficulty <= current.difficulty).sort((p, q) => p.id.localeCompare(q.id))[0];
  return { kind: 'analogous', taskId: analog?.id ?? null };
}
export interface TaskSummary { taskId: string; counts: Record<TaskStatus, number> }
export interface ClassSummary { students: number; tasks: TaskSummary[]; needSupport: number; topErrors: { code: string; count: number }[] }
/** Сводка для учителя: только числа и коды ошибок. Нет имён/идентификаторов, нет времени решения и рейтингов. */
export function summarize(s: ClassSession, all: States): ClassSummary {
  const tasks: TaskSummary[] = s.taskIds.map(id => ({ taskId: id, counts: { not_started: 0, in_progress: 0, needs_review: 0, done: 0, deferred: 0, repeat: 0 } }));
  const errs = new Map<string, number>(); let need = 0;
  for (const sid of s.studentIds) {
    const st = all[sid] ?? [];
    for (const t of tasks) t.counts[stOf(st, t.taskId)]++;
    const wrong = st.reduce((n, t) => n + t.attempts.filter(a => a.correct === false).length, 0);
    if (st.some(t => t.status === 'needs_review') || wrong >= 3) need++;
    for (const a of st.flatMap(t => t.attempts)) for (const c of a.errorCodes) errs.set(c, (errs.get(c) ?? 0) + 1);
  }
  return { students: s.studentIds.length, tasks, needSupport: need, topErrors: [...errs].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)).slice(0, 3) };
}
/** Индивидуальный просмотр решения ученика — только если это разрешено занятием (на сервере проверка должна повторяться). */
export const teacherView = (s: ClassSession, all: States, studentId: string): TaskState[] | null => (s.allowIndividualView && s.studentIds.includes(studentId) ? all[studentId] ?? [] : null);
