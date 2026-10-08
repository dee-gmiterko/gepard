import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

const CONFIG = '[semantic_tokens]\nmode = "full"\n';

export async function prepareConfig(dataDir: string): Promise<NodeJS.ProcessEnv> {
  const home = path.join(dataDir, 'home');
  const configDir =
    process.platform === 'win32'
      ? path.join(home, 'AppData', 'Roaming', 'phpantom_lsp')
      : path.join(home, 'config', 'phpantom_lsp');
  await mkdir(configDir, { recursive: true });
  await writeFile(path.join(configDir, '.phpantom.toml'), CONFIG);
  return process.platform === 'win32'
    ? { ...process.env, USERPROFILE: home }
    : { ...process.env, XDG_CONFIG_HOME: path.join(home, 'config') };
}
