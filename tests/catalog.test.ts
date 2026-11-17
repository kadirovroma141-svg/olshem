import { describe, it, expect } from 'vitest';
import { filterTasks, topicsOf } from '../src/data/catalog';
import tasks from '../data/tasks/solid_geometry.json';
const T = tasks as any[];
describe('catalog', () => {
  it('empty filter returns all', () => expect(filterTasks(T, {}, 'ru')).toHaveLength(T.length));
  it('filters by topic and difficulty', () => {
    expect(filterTasks(T, { topic: 'distances' }, 'ru').map(t => t.id)).toEqual(['ST-0001', 'ST-0002']);
    expect(filterTasks(T, { difficulty: 1 }, 'ru').map(t => t.id)).toEqual(['ST-0001']);
    expect(filterTasks(T, { topic: 'volumes', difficulty: 1 }, 'ru')).toEqual([]);
  });
  it('searches in the selected language only, ё/е and case insensitive', () => {
    expect(filterTasks(T, { query: 'ТЕТРАЭДР' }, 'ru').map(t => t.id)).toEqual(['ST-0003']);
    expect(filterTasks(T, { query: 'tetrahedron' }, 'ru')).toEqual([]);
    expect(filterTasks(T, { query: 'tetrahedron' }, 'en').map(t => t.id)).toEqual(['ST-0003']);
    expect(filterTasks(T, { query: 'найдите' }, 'kk')).toEqual([]);
    expect(filterTasks(T, { query: 'st-0002' }, 'kk').map(t => t.id)).toEqual(['ST-0002']);
  });
  it('status filter and topics list', () => { expect(filterTasks(T, { status: 'validated' }, 'ru')).toEqual([]); expect(topicsOf(T)).toEqual(['cross_sections', 'distances', 'volumes']); });
});
