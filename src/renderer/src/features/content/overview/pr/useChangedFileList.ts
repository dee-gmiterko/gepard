import type { ChangedFile } from '@gepard/common';
import { useChangedFiles } from '../../../../queries/files';

const NO_FILES: readonly ChangedFile[] = [];

export function useChangedFileList(): {
  files: readonly ChangedFile[];
  isPending: boolean;
  error: Error | null;
} {
  const { data, isPending, error } = useChangedFiles();
  return { files: data ?? NO_FILES, isPending, error };
}
