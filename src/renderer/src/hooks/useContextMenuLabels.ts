import { useCallback, useEffect } from 'react';
import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { ContextMenuLabelKey, ContextMenuLabels } from '@gepard/common';
import { reportQueryError } from '../errors/report';
import { invoke } from '../ipc/client';

const messages = defineMessages({
  undo: { id: 'contextMenu.undo', defaultMessage: 'Undo' },
  redo: { id: 'contextMenu.redo', defaultMessage: 'Redo' },
  cut: { id: 'contextMenu.cut', defaultMessage: 'Cut' },
  copy: { id: 'contextMenu.copy', defaultMessage: 'Copy' },
  paste: { id: 'contextMenu.paste', defaultMessage: 'Paste' },
  selectAll: { id: 'contextMenu.selectAll', defaultMessage: 'Select all' },
  addToDictionary: { id: 'contextMenu.addToDictionary', defaultMessage: 'Add to dictionary' },
  copyFilePath: { id: 'contextMenu.copyFilePath', defaultMessage: 'Copy file path' },
  copyLineReference: {
    id: 'contextMenu.copyLineReference',
    defaultMessage: 'Copy line reference',
  },
  wrapLongLines: { id: 'contextMenu.wrapLongLines', defaultMessage: 'Wrap long lines' },
  fullFile: { id: 'contextMenu.fullFile', defaultMessage: 'Full file' },
  randomizeOrder: { id: 'contextMenu.randomizeOrder', defaultMessage: 'Randomize order' },
  incrementalDiff: { id: 'contextMenu.incrementalDiff', defaultMessage: 'Show incremental' },
  showCurrent: { id: 'contextMenu.showCurrent', defaultMessage: 'Show current' },
}) satisfies Record<ContextMenuLabelKey, MessageDescriptor>;

export function useContextMenuLabel(): (key: ContextMenuLabelKey) => string {
  const intl = useIntl();
  return useCallback(
    (key: ContextMenuLabelKey): string => intl.formatMessage(messages[key]),
    [intl],
  );
}

export function useContextMenuLabels(): (key: ContextMenuLabelKey) => string {
  const label = useContextMenuLabel();
  useEffect(() => {
    const labels = ContextMenuLabels.parse(
      Object.fromEntries(ContextMenuLabelKey.options.map((key) => [key, label(key)])),
    );
    invoke('contextMenu.setLabels', labels).catch((error: unknown) =>
      reportQueryError('contextMenu.setLabels', error),
    );
  }, [label]);
  return label;
}
