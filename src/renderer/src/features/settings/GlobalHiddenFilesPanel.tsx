import { defineMessages, useIntl } from 'react-intl';
import { useGlobalHiddenFiles, useSetGlobalHiddenFiles } from '../../queries/hiddenFiles';
import { HiddenFilesEditor } from './HiddenFilesEditor';

const messages = defineMessages({
  title: {
    id: 'settings.hiddenFiles.globalTitle',
    defaultMessage: 'Hidden files (all projects)',
  },
});

export function GlobalHiddenFilesPanel(): React.JSX.Element {
  const intl = useIntl();
  const { data } = useGlobalHiddenFiles();
  const save = useSetGlobalHiddenFiles();
  return (
    <HiddenFilesEditor
      title={intl.formatMessage(messages.title)}
      patterns={data}
      failed={save.isError}
      onSave={(patterns) => save.mutate(patterns)}
    />
  );
}
