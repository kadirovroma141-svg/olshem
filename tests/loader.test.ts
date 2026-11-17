import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { loadExtraParts } from '../src/data/loader';
import { topicsOf } from '../src/data/catalog';
import ru from '../src/i18n/locales/ru/common.json';
const read = (dir: string) => readdirSync(dir).filter(f => f.endsWith('.json')).flatMap(f => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as any[]);
describe('lazy loader completeness', () => {
  it('loads EVERY task and solution file except the base ones (guards against forgetting a new data file)', async () => {
    const e = await loadExtraParts(), allTasks = read('data/tasks'), allSols = read('data/solutions');
    const base = JSON.parse(readFileSync('data/tasks/solid_geometry.json', 'utf8')).length, baseS = JSON.parse(readFileSync('data/solutions/solutions_part_01.json', 'utf8')).length;
    expect(e.tasks.length).toBe(allTasks.length - base); expect(e.sols.length).toBe(allSols.length - baseS);
    expect(new Set([...JSON.parse(readFileSync('data/tasks/solid_geometry.json', 'utf8')), ...e.tasks].map((t: any) => t.id)).size).toBe(allTasks.length);
  });
  it('every topic used by tasks has a label in all locales', () => {
    const topics = topicsOf(read('data/tasks')); for (const l of ['ru', 'kk', 'en']) { const d = JSON.parse(readFileSync(`src/i18n/locales/${l}/common.json`, 'utf8')); for (const t of topics) expect(d[`topic.${t}`], `${l}:${t}`).toBeTruthy(); }
    expect(Object.keys(ru).length).toBeGreaterThan(50);
  });
});
