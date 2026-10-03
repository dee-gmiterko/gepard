import { useEffect } from 'react';
import { defineMessages, useIntl } from 'react-intl';
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

export function useContextMenuLabels(): void {
  const intl = useIntl();
  useEffect(() => {
    invoke('contextMenu.setLabels', {
      undo: intl.formatMessage(messages.undo),
      redo: intl.formatMessage(messages.redo),
      cut: intl.formatMessage(messages.cut),
      copy: intl.formatMessage(messages.copy),
      paste: intl.formatMessage(messages.paste),
      selectAll: intl.formatMessage(messages.selectAll),
      addToDictionary: intl.formatMessage(messages.addToDictionary),
      copyFilePath: intl.formatMessage(messages.copyFilePath),
      copyLineReference: intl.formatMessage(messages.copyLineReference),
    }).catch((error: unknown) => reportQueryError('contextMenu.setLabels', error));
  }, [intl]);
}
