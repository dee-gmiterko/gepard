import { createServer } from 'node:http';
import { join } from 'node:path';
import { parseProcessCli } from '../cli';
import { composeCore, composeHandlers } from '../di';
import { Paths, resolveUserDataDir } from '../paths';
import { IpcDispatchService } from '../ipc/dispatch';
import { NoContextMenu } from '../contextMenuPort';
import {
  DefaultSystemPreferenceSource,
  SystemPreferenceService,
} from '../services/systemPreference';
import { createIpcServer } from './server';
import { createStaticHandler } from './static';
import { ServerFolderPicker } from './folderPicker';

const APP_ROOT_FROM_MAIN_OUTPUT = join('..', '..');

export function startServer(): void {
  const cli = parseProcessCli();
  if (cli.server === null) {
    process.stderr.write('gepard: --server host:port is required\n');
    process.exit(2);
  }
  const { host, port } = cli.server;
  const paths = new Paths(
    resolveUserDataDir(process.platform, process.env),
    join(__dirname, APP_ROOT_FROM_MAIN_OUTPUT),
    __dirname.includes('app.asar'),
  );
  const core = composeCore(paths, cli, () => undefined);
  const dispatch = new IpcDispatchService(
    composeHandlers(
      core,
      new ServerFolderPicker(paths),
      new NoContextMenu(),
      new SystemPreferenceService(new DefaultSystemPreferenceSource()),
    ),
  );
  createIpcServer(createServer(), {
    serveStatic: createStaticHandler(join(__dirname, '../renderer')),
    dispatch: dispatch.bind({ window: null, remote: true }),
    subscribe: (sink) => core.events.subscribe(sink),
    onConnection: () => core.notify.rendererReady(),
  })
    .on('error', (err) => {
      process.stderr.write(`gepard: ${err.message}\n`);
      process.exit(1);
    })
    .listen(port, host, () => process.stdout.write(`listening on http://${host}:${port}\n`));
}
