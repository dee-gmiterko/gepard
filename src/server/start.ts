import { createServer } from 'node:http';
import { join } from 'node:path';
import { composeCore, composeHandlers } from '@gepard/main/di';
import { Paths, resolveUserDataDir } from '@gepard/main/paths';
import { IpcDispatchService } from '@gepard/main/ipc/dispatch';
import { SystemPreferenceService } from '@gepard/main/services/systemPreference';
import { parseProcessCli } from './cli';
import { createIpcServer } from './server';
import { createStaticHandler } from './static';
import { ServerFolderPicker } from './folderPicker';
import { DefaultSystemPreferenceSource } from './systemPreference';
import { NoContextMenu } from './noContextMenu';
import { NoInstanceLauncher } from './noInstanceLauncher';

const BUILTIN_EXTENSIONS_FROM_OUTPUT = join('..', '..', '..', 'dist', 'extensions');

export function startServer(): void {
  const { host, port } = parseProcessCli();
  const paths = new Paths(resolveUserDataDir(process.platform, process.env));
  const core = composeCore(paths, {
    target: null,
    builtinExtensionsDir: join(import.meta.dirname, BUILTIN_EXTENSIONS_FROM_OUTPUT),
    logToConsole: true,
    instances: () => new NoInstanceLauncher(),
    focusWindow: () => undefined,
  });
  const dispatch = new IpcDispatchService(
    composeHandlers(
      core,
      new ServerFolderPicker(paths),
      new NoContextMenu(),
      new SystemPreferenceService(new DefaultSystemPreferenceSource()),
    ),
  );
  createIpcServer(createServer(), {
    serveStatic: createStaticHandler(join(import.meta.dirname, 'renderer')),
    dispatch: dispatch.bind({ window: null }),
    subscribe: (sink) => core.events.subscribe(sink),
    onConnection: () => core.notify.rendererReady(),
  })
    .on('error', (err) => {
      process.stderr.write(`gepard: ${err.message}\n`);
      process.exit(1);
    })
    .listen(port, host, () => process.stdout.write(`listening on http://${host}:${port}\n`));
}
