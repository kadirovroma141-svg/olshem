import type { Solution } from './verify';
import type { CatalogTask } from './catalog';
/** Ленивая подгрузка частей каталога отдельными чанками (динамические import). Новые части добавляются сюда. */
export async function loadExtraParts(): Promise<{ tasks: CatalogTask[]; sols: Solution[] }> {
  const [t2, t3, t4, t5, t6, s2, s3, s4, s5, s6] = await Promise.all([
    import('../../data/tasks/generated_polyhedra.json'), import('../../data/tasks/generated_angles.json'), import('../../data/tasks/generated_revolution.json'), import('../../data/tasks/generated_coordinates.json'), import('../../data/tasks/generated_relations.json'),
    import('../../data/solutions/solutions_part_02.json'), import('../../data/solutions/solutions_part_03.json'), import('../../data/solutions/solutions_part_04.json'), import('../../data/solutions/solutions_part_05.json'), import('../../data/solutions/solutions_part_06.json'),
  ]);
  return { tasks: [...t2.default, ...t3.default, ...t4.default, ...t5.default, ...t6.default] as unknown as CatalogTask[], sols: [...s2.default, ...s3.default, ...s4.default, ...s5.default, ...s6.default] as unknown as Solution[] };
}
