import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const RENDERER_SRC_GLOB = path.join(ROOT_DIR, 'src/renderer/src/**/*.{ts,tsx}');
const LOCALES_DIR = path.join(ROOT_DIR, 'extensions/locales');
const MESSAGES_FILE_NAME = 'messages.json';
const STALE_DIR = path.join(LOCALES_DIR, '.stale');
const SOURCE_LOCALE = 'en';

export type LocaleCatalog = Record<string, string>;
export type ExtractedMessages = Record<string, { defaultMessage: string }>;

export interface RefreshedLocale {
  file: string;
  locale: string;
  catalog: LocaleCatalog;
  staleIds: string[];
}

export function mergeLocaleCatalog(
  existing: LocaleCatalog,
  extracted: ExtractedMessages,
  oldSource: LocaleCatalog,
  { isSource }: { isSource: boolean },
): { catalog: LocaleCatalog; staleIds: string[] } {
  const ids = Object.keys(extracted).sort();
  const catalog: LocaleCatalog = {};
  const staleIds: string[] = [];

  for (const id of ids) {
    const defaultText = extracted[id].defaultMessage;

    if (isSource) {
      catalog[id] = defaultText;
      continue;
    }

    const current = existing[id];
    if (current === undefined) {
      catalog[id] = defaultText;
      continue;
    }

    const previousSourceText = oldSource[id];
    const sourceChanged = previousSourceText !== undefined && previousSourceText !== defaultText;
    const wasTranslated = previousSourceText !== undefined && current !== previousSourceText;
    if (sourceChanged && wasTranslated) {
      staleIds.push(id);
    }
    catalog[id] = current;
  }

  return { catalog, staleIds };
}

export function refreshCatalogs(
  extracted: ExtractedMessages,
  localeFiles: string[],
  readCatalog: (file: string) => LocaleCatalog,
  localeOf: (file: string) => string,
): RefreshedLocale[] {
  const sourceFile = localeFiles.find((file) => localeOf(file) === SOURCE_LOCALE);
  const oldSource = sourceFile ? readCatalog(sourceFile) : {};

  return localeFiles.map((file) => {
    const locale = localeOf(file);
    const existing = readCatalog(file);
    const { catalog, staleIds } = mergeLocaleCatalog(existing, extracted, oldSource, {
      isSource: locale === SOURCE_LOCALE,
    });
    return { file, locale, catalog, staleIds };
  });
}

function resolveFormatjsBin(): string {
  const require = createRequire(import.meta.url);
  return require.resolve('@formatjs/cli/bin/formatjs');
}

function extractMessages(): ExtractedMessages {
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'gepard-intl-'));
  const outFile = path.join(tmpDir, 'extracted.json');
  try {
    execFileSync(
      process.execPath,
      [
        resolveFormatjsBin(),
        'extract',
        RENDERER_SRC_GLOB,
        '--ignore',
        '**/*.d.ts',
        '--out-file',
        outFile,
      ],
      { stdio: ['ignore', 'inherit', 'inherit'] },
    );
    return JSON.parse(readFileSync(outFile, 'utf8')) as ExtractedMessages;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function localeFileOf(file: string): string {
  return path.basename(path.dirname(file));
}

function readCatalogFile(file: string): LocaleCatalog {
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
  try {
    return JSON.parse(raw) as LocaleCatalog;
  } catch (error) {
    throw new Error(
      `${file} is not valid JSON, refusing to overwrite it: ${(error as Error).message}`,
      { cause: error },
    );
  }
}

function readStaleFile(locale: string): string[] | null {
  const staleFile = path.join(STALE_DIR, `${locale}.json`);
  try {
    return JSON.parse(readFileSync(staleFile, 'utf8')) as string[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function sameStaleIds(onDisk: string[] | null, staleIds: string[]): boolean {
  if (onDisk === null) return staleIds.length === 0;
  if (onDisk.length !== staleIds.length) return false;
  return onDisk.every((id, i) => id === staleIds[i]);
}

function main({ check }: { check: boolean }): void {
  const extracted = extractMessages();
  const localeDirs = readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== '.stale')
    .map((entry) => entry.name);
  const localeFiles = localeDirs.map((name) => path.join(LOCALES_DIR, name, MESSAGES_FILE_NAME));

  const refreshed = refreshCatalogs(extracted, localeFiles, readCatalogFile, localeFileOf);

  if (check) {
    const outdated = refreshed.filter(({ file, locale, catalog, staleIds }) => {
      const onDiskCatalog = readCatalogFile(file);
      if (JSON.stringify(onDiskCatalog) !== JSON.stringify(catalog)) return true;
      if (locale === SOURCE_LOCALE) return false;
      return !sameStaleIds(readStaleFile(locale), staleIds);
    });

    if (outdated.length > 0) {
      console.error(
        `Locale files are out of date: ${outdated.map((r) => path.basename(r.file)).join(', ')}. ` +
          'Run `yarn locales:refresh` and commit the result.',
      );
      process.exitCode = 1;
      return;
    }

    console.log('Locale files are up to date.');
    return;
  }

  for (const { file, locale, catalog, staleIds } of refreshed) {
    writeFileSync(file, `${JSON.stringify(catalog, null, 2)}\n`);
    if (locale === SOURCE_LOCALE) continue;
    const staleFile = path.join(STALE_DIR, `${locale}.json`);
    if (staleIds.length > 0) {
      mkdirSync(STALE_DIR, { recursive: true });
      writeFileSync(staleFile, `${JSON.stringify(staleIds, null, 2)}\n`);
    } else {
      rmSync(staleFile, { force: true });
    }
  }

  if (existsSync(STALE_DIR) && readdirSync(STALE_DIR).length === 0) {
    rmSync(STALE_DIR, { recursive: true, force: true });
  }

  console.log(
    `Refreshed ${refreshed.length} locale file(s) from ${Object.keys(extracted).length} message(s).`,
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const argv = yargs(hideBin(process.argv))
    .option('check', {
      type: 'boolean',
      default: false,
      description: 'Verify locale files are up to date without writing changes',
    })
    .strict()
    .parseSync();

  main({ check: argv.check });
}
