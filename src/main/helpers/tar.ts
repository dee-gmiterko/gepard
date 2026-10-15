import { mkdir } from 'node:fs/promises';
import * as tar from 'tar';
import { AppError, errorMessage } from '@gepard/common';

const EXTRACTABLE_TYPES = new Set(['File', 'OldFile', 'ContiguousFile', 'Directory']);

export async function extractTarGz(archivePath: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  const unsupported: string[] = [];
  try {
    await tar.extract({
      file: archivePath,
      cwd: destDir,
      strict: true,
      filter: (entryPath, entry) => {
        const type = 'type' in entry ? entry.type : 'File';
        if (EXTRACTABLE_TYPES.has(type)) return true;
        unsupported.push(`archive entry "${entryPath}" has unsupported type ${type}`);
        return false;
      },
    });
  } catch (e) {
    throw new AppError('EXTENSION_INVALID_ARCHIVE', `could not read archive: ${errorMessage(e)}`);
  }
  if (unsupported.length > 0) throw new AppError('EXTENSION_INVALID_ARCHIVE', unsupported[0]);
}
