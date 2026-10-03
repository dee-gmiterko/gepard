import type { ChangedFile } from '@gepard/common';
import { useChangedFiles } from '../../../../queries/files';

const NO_FILES: readonly ChangedFile[] = [];

export function useChangedFileList(): {
  files: readonly ChangedFile[];
  isLoading: boolean;
  error: Error | null;
} {
  const { data, isLoading, error } = useChangedFiles();
  return { files: data ?? NO_FILES, isLoading, error };
}
