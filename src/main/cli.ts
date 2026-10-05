import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export const REPORT_WINDOW_SHOWN = 'report-window-shown';

export interface Cli {
  target: string | null;
  reportWindowShown: boolean;
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

export function parseCli(args: string[]): Cli {
  const parsed = yargs(args)
    .parserConfiguration({
      'unknown-options-as-args': true,
      'parse-positional-numbers': false,
      'populate--': true,
    })
    .option(REPORT_WINDOW_SHOWN, { type: 'boolean', default: false, hidden: true })
    .help(false)
    .version(false)
    .exitProcess(false)
    .parseSync();
  const positional = [
    ...parsed._.filter((arg) => !String(arg).startsWith('-')),
    ...stringsOf(parsed['--']),
  ];
  return {
    target: positional.length > 0 ? String(positional[0]) : null,
    reportWindowShown: parsed[REPORT_WINDOW_SHOWN],
  };
}

export const cli = parseCli(hideBin(process.argv));
