import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { errorMessage } from '@gepard/common';
import { REPORT_WINDOW_SHOWN_SWITCH } from './helpers/process/instance';

export interface ServerAddress {
  host: string;
  port: number;
}

export interface Cli {
  target: string | null;
  reportWindowShown: boolean;
  server: ServerAddress | null;
}

function parseHostPort(value: string): ServerAddress {
  const at = value.lastIndexOf(':');
  const port = Number(value.slice(at + 1));
  if (at < 1 || !/^\d+$/.test(value.slice(at + 1)) || port < 1 || port > 65535)
    throw new Error(`--server expects host:port, got "${value}"`);
  return { host: value.slice(0, at), port };
}

export function parseCli(args: string[]): Cli {
  const parsed = yargs(args)
    .parserConfiguration({ 'parse-positional-numbers': false })
    .command('$0 [target]', false, (command) => command.positional('target', { type: 'string' }))
    .option(REPORT_WINDOW_SHOWN_SWITCH, { type: 'boolean', default: false })
    .option('server', { type: 'string' })
    .help(false)
    .version(false)
    .exitProcess(false)
    .parseSync();
  return {
    target: typeof parsed['target'] === 'string' ? parsed['target'] : null,
    reportWindowShown: parsed[REPORT_WINDOW_SHOWN_SWITCH],
    server: parsed['server'] === undefined ? null : parseHostPort(parsed['server']),
  };
}

function parseProcessCli(): Cli {
  // hideBin assumes Electron's argv layout, which does not apply when the binary runs as Node.
  const args = process.env['ELECTRON_RUN_AS_NODE'] ? process.argv.slice(2) : hideBin(process.argv);
  try {
    return parseCli(args);
  } catch (e) {
    process.stderr.write(`gepard: ${errorMessage(e)}\n`);
    process.exit(2);
  }
}

export const cli = parseProcessCli();
