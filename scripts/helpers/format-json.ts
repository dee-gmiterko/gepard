import { format, resolveConfig } from 'prettier';

export async function formatJson(value: unknown, file: string): Promise<string> {
  const config = await resolveConfig(file);
  return format(JSON.stringify(value), { ...config, filepath: file, parser: 'json' });
}
