import type { Lang } from '../i18n/i18n';
export interface Filter { query?: string; topic?: string; grade?: number; difficulty?: number; status?: string }
export interface CatalogTask { id: string; grade: number; topic: string; difficulty: number; validationStatus: string; languages: Record<string, { title: string; statement: string }> }
const norm = (s: string) => s.toLowerCase().normalize('NFC').replace(/ё/g, 'е');
/** Поиск и фильтрация каталога. Поиск идёт по тексту выбранного языка и по идентификатору; пустой фильтр не ограничивает. */
export function filterTasks<T extends CatalogTask>(tasks: T[], f: Filter, lang: Lang): T[] {
  const q = f.query ? norm(f.query.trim()) : '';
  return tasks.filter(t =>
    (!f.topic || t.topic === f.topic) && (!f.grade || t.grade === f.grade) && (!f.difficulty || t.difficulty === f.difficulty) && (!f.status || t.validationStatus === f.status) &&
    (!q || norm(t.id).includes(q) || norm(t.languages[lang]?.title ?? '').includes(q) || norm(t.languages[lang]?.statement ?? '').includes(q)));
}
export const topicsOf = (tasks: CatalogTask[]) => [...new Set(tasks.map(t => t.topic))].sort();
