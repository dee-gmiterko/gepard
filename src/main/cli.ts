import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { REPORT_WINDOW_SHOWN_SWITCH } from './helpers/process/instance';

export interface Cli {
  target: string | null;
  reportWindowShown: boolean;
}

export function parseCli(args: string[]): Cli {
  const parsed = yargs(args)
    .parserConfiguration({ 'parse-positional-numbers': false })
    .command('$0 [target]', false, (command) => command.positional('target', { type: 'string' }))
    .option(REPORT_WINDOW_SHOWN_SWITCH, { type: 'boolean', default: false })
    .help(false)
    .version(false)
    .exitProcess(false)
    .parseSync();
  return {
    target: typeof parsed['target'] === 'string' ? parsed['target'] : null,
    reportWindowShown: parsed[REPORT_WINDOW_SHOWN_SWITCH],
  };
}

export const cli = parseCli(hideBin(process.argv));
