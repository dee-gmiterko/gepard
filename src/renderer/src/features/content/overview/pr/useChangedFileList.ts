import type { ChangedFile } from '@gepard/common';
import { useOverviewChangedFiles } from '../../../../queries/overview';

const NO_FILES: readonly ChangedFile[] = [];

export function useChangedFileList(): {
  files: readonly ChangedFile[];
  isPending: boolean;
  error: Error | null;
} {
  const { data, isPending, error } = useOverviewChangedFiles();
  return { files: data ?? NO_FILES, isPending, error };
}
