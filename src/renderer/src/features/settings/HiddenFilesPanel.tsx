import { defineMessages, useIntl } from 'react-intl';
import { useHiddenFiles, useSetHiddenFiles } from '../../queries/hiddenFiles';
import type { HiddenFilesScope } from '../../queries/keys';
import { HiddenFilesEditor } from './HiddenFilesEditor';

const messages = defineMessages({
  global: {
    id: 'settings.hiddenFiles.globalTitle',
    defaultMessage: 'Hidden files (all projects)',
  },
  project: {
    id: 'settings.project.hiddenFiles.title',
    defaultMessage: 'Hidden files (this project)',
  },
});

export function HiddenFilesPanel({ scope }: { scope: HiddenFilesScope }): React.JSX.Element {
  const intl = useIntl();
  const { data } = useHiddenFiles(scope);
  const save = useSetHiddenFiles(scope);
  return (
    <HiddenFilesEditor
      title={intl.formatMessage(messages[scope])}
      patterns={data}
      failed={save.isError}
      onSave={(patterns) => save.mutate(patterns)}
    />
  );
}
