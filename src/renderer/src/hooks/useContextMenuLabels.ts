import { useCallback, useEffect } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ContextMenuLabels } from '@gepard/common';
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
});

export type ContextMenuLabelKey = keyof typeof messages;

export function useContextMenuLabels(): (key: ContextMenuLabelKey) => string {
  const intl = useIntl();
  const label = useCallback(
    (key: ContextMenuLabelKey): string => intl.formatMessage(messages[key]),
    [intl],
  );
  useEffect(() => {
    const labels = ContextMenuLabels.parse(
      Object.fromEntries(
        Object.entries(messages).map(([key, message]) => [key, intl.formatMessage(message)]),
      ),
    );
    invoke('contextMenu.setLabels', labels).catch((error: unknown) =>
      reportQueryError('contextMenu.setLabels', error),
    );
  }, [intl]);
  return label;
}
