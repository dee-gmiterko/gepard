import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { cli } from './cli';
import { bootstrap } from './app';

if (cli.server === null) {
  bootstrap();
} else {
  const { status } = spawnSync(
    process.execPath,
    [join(__dirname, 'server.js'), '--server', `${cli.server.host}:${cli.server.port}`],
    { stdio: 'inherit', env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } },
  );
  process.exit(status ?? 1);
}
