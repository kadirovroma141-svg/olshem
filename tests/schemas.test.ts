import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import tasks from '../data/tasks/solid_geometry.json';
import sols from '../data/solutions/solutions_part_01.json';
import rules from '../data/mathematics/theorems.json';
import errs from '../data/tutoring/error_patterns.json';
import sTask from '../data/schemas/task.schema.json';
import sSol from '../data/schemas/solution.schema.json';
import sRule from '../data/schemas/rule.schema.json';
import sErr from '../data/schemas/error_pattern.schema.json';
const ajv = new Ajv({ allErrors: true, strict: false });
const cases: [string, object, unknown][] = [['tasks', sTask, tasks], ['solutions', sSol, sols], ['rules', sRule, rules], ['error patterns', sErr, errs]];
describe('JSON Schema', () => {
  for (const [name, schema, data] of cases) it(`${name} conform to schema`, () => { const v = ajv.compile(schema); expect(v(data) ? [] : v.errors).toEqual([]); });
  it('schema rejects broken data', () => {
    const v = ajv.compile(sTask); const t = JSON.parse(JSON.stringify(tasks[0]));
    delete t.languages.kk.statement; t.grade = 9; t.id = 'X1';
    expect(v([t])).toBe(false); expect((v.errors ?? []).length).toBeGreaterThanOrEqual(3);
  });
});
