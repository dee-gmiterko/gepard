import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { cli } from '../cli';
import { createDispatcher } from '../ipc/dispatch';
import { handlers } from '../di';
import { addEventSink } from '../ipc/registry';
import { markRendererReady } from '../notify';
import { setUserDataDir } from '../paths';
import { createIpcServer } from './server';
import { createStaticHandler } from './static';

// The directory Electron resolves for app.getPath('userData') with the app name "gepard".
function userDataDir(): string {
  if (process.platform === 'win32') return join(process.env['APPDATA'] ?? homedir(), 'gepard');
  if (process.platform === 'darwin')
    return join(homedir(), 'Library', 'Application Support', 'gepard');
  return join(process.env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config'), 'gepard');
}

if (cli.server === null) {
  process.stderr.write('gepard: --server host:port is required\n');
  process.exit(2);
}
setUserDataDir(userDataDir());
const { host, port } = cli.server;
createIpcServer(createServer(), {
  serveStatic: createStaticHandler(join(__dirname, '../renderer')),
  dispatch: createDispatcher(handlers, { window: null, remote: true }),
  subscribe: addEventSink,
  onConnection: markRendererReady,
})
  .on('error', (err) => {
    process.stderr.write(`gepard: ${err.message}\n`);
    process.exit(1);
  })
  .listen(port, host, () => process.stdout.write(`listening on http://${host}:${port}\n`));
