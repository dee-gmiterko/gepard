import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import styled from 'styled-components';
import { Checkbox } from '../../components/Checkbox';
import { Stack } from '../../components/Layout';
import { Section } from '../../components/Section';
import { SectionHeading } from '../../components/SectionHeading';
import { useCommands, type Commands } from '../../keyboard/useCommands';
import { useSetProjectHiddenFiles, useProjectHiddenFiles } from '../../queries/hiddenFiles';
import { useLayout } from '../../state/hooks';
import { HiddenFilesEditor } from './HiddenFilesEditor';

const messages = defineMessages({
  switchesTitle: {
    id: 'settings.project.switches.title',
    defaultMessage: 'Feature switches',
  },
  wrapLongLines: {
    id: 'settings.project.switches.wrapLongLines',
    defaultMessage: 'Wrap long lines',
  },
  fullFile: {
    id: 'settings.project.switches.fullFile',
    defaultMessage: 'Full file diff',
  },
  randomizeOrder: {
    id: 'settings.project.switches.randomizeOrder',
    defaultMessage: 'Randomize file order',
  },
  incrementalDiff: {
    id: 'settings.project.switches.incrementalDiff',
    defaultMessage: 'Incremental diff',
  },
  showCurrent: {
    id: 'settings.project.switches.showCurrent',
    defaultMessage: 'Show current',
  },
  hiddenFilesTitle: {
    id: 'settings.project.hiddenFiles.title',
    defaultMessage: 'Hidden files (this project)',
  },
});

type SwitchKey =
  'wrapLongLines' | 'fullFileDiff' | 'randomizeOrder' | 'incrementalDiff' | 'showCurrent';
type SwitchCommand = Extract<keyof Commands, `toggle${string}`> &
  (
    | 'toggleWrapLines'
    | 'toggleFullFileDiff'
    | 'toggleRandomizeOrder'
    | 'toggleIncrementalDiff'
    | 'toggleShowCurrent'
  );

const SWITCHES: {
  layoutKey: SwitchKey;
  command: SwitchCommand;
  label: MessageDescriptor;
}[] = [
  { layoutKey: 'wrapLongLines', command: 'toggleWrapLines', label: messages.wrapLongLines },
  { layoutKey: 'fullFileDiff', command: 'toggleFullFileDiff', label: messages.fullFile },
  { layoutKey: 'randomizeOrder', command: 'toggleRandomizeOrder', label: messages.randomizeOrder },
  {
    layoutKey: 'incrementalDiff',
    command: 'toggleIncrementalDiff',
    label: messages.incrementalDiff,
  },
  { layoutKey: 'showCurrent', command: 'toggleShowCurrent', label: messages.showCurrent },
];

const Columns = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[4]};
`;

export function ProjectSettingsPanel(): React.JSX.Element {
  const intl = useIntl();
  const layout = useLayout();
  const commands = useCommands();
  const { data: hiddenFiles } = useProjectHiddenFiles();
  const saveHiddenFiles = useSetProjectHiddenFiles();

  return (
    <Stack $gap={5}>
      <Section $flush>
        <SectionHeading title={<FormattedMessage {...messages.switchesTitle} />} />
        <Columns>
          {SWITCHES.map(({ layoutKey, command, label }) => (
            <Checkbox
              key={layoutKey}
              checked={layout[layoutKey]}
              label={intl.formatMessage(label)}
              onChange={() => commands[command]()}
            />
          ))}
        </Columns>
      </Section>
      <HiddenFilesEditor
        title={intl.formatMessage(messages.hiddenFilesTitle)}
        patterns={hiddenFiles}
        failed={saveHiddenFiles.isError}
        onSave={(patterns) => saveHiddenFiles.mutate(patterns)}
      />
    </Stack>
  );
}
