import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { errorMessage } from '@gepard/common';

export interface ServerAddress {
  host: string;
  port: number;
}

export function parseCli(args: string[]): ServerAddress {
  const parsed = yargs(args)
    .parserConfiguration({ 'parse-positional-numbers': false })
    .command('$0 <host> <port>', false, (command) =>
      command
        .positional('host', { type: 'string', demandOption: true })
        .positional('port', { type: 'string', demandOption: true }),
    )
    .help(false)
    .version(false)
    .exitProcess(false)
    .parseSync();
  const { host, port } = parsed;
  if (typeof host !== 'string' || typeof port !== 'string')
    throw new Error('expected <host> <port>');
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
    throw new Error(`port must be 1-65535, got "${port}"`);
  return { host, port: Number(port) };
}

export function parseProcessCli(): ServerAddress {
  try {
    return parseCli(hideBin(process.argv));
  } catch (e) {
    process.stderr.write(`gepard: ${errorMessage(e)}\nusage: yarn server <host> <port>\n`);
    process.exit(2);
  }
}
