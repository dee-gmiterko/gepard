import { describe, expect, it } from 'vitest';
import { format, resolveConfig } from 'prettier';
import path from 'node:path';
import { formatJson } from '../helpers/format-json';

const FILE = path.resolve(__dirname, '../../release-please-config.json');

describe('formatJson', () => {
  it('produces output that prettier leaves unchanged', async () => {
    const value = { list: ['a'], nested: { items: [{ type: 'json', path: 'x' }] } };
    const output = await formatJson(value, FILE);
    const config = await resolveConfig(FILE);
    expect(await format(output, { ...config, filepath: FILE })).toBe(output);
    expect(JSON.parse(output)).toEqual(value);
    expect(output).toContain('"list": ["a"]');
  });
});
