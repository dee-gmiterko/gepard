import { useMemo } from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import styled from 'styled-components';
import { useChangedFileOwners } from '../../../../queries/overview';
import {
  groupByExtension,
  groupByFolder,
  groupByOwner,
  NO_EXTENSION,
  UNOWNED,
} from '../../../../helpers/overview';
import { Panel } from '../shared/Panel';
import { QueryState } from '../shared/QueryState';
import { useOverviewActions } from '../shared/useOverviewActions';
import { GroupList } from './GroupList';
import { TopFilesPanel } from './TopFilesPanel';
import { useChangedFileList } from './useChangedFileList';

const messages = defineMessages({
  folders: { id: 'content.overview.pr.folders', defaultMessage: 'Folders' },
  types: { id: 'content.overview.pr.types', defaultMessage: 'File types' },
  owners: { id: 'content.overview.pr.owners', defaultMessage: 'Code owners' },
  rootFolder: { id: 'content.overview.pr.rootFolder', defaultMessage: '(root)' },
  noExtension: { id: 'content.overview.pr.noExtension', defaultMessage: '(no extension)' },
  unowned: { id: 'content.overview.pr.unowned', defaultMessage: 'Unowned' },
});

const Columns = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: ${({ theme }) => theme.space[5]};
`;

export function FileBreakdown(): React.JSX.Element {
  const actions = useOverviewActions();
  const { files, isLoading, error } = useChangedFileList();
  const owners = useChangedFileOwners();
  const ownersByPath = owners.data;

  const folders = useMemo(() => groupByFolder(files), [files]);
  const types = useMemo(() => groupByExtension(files), [files]);
  const ownerGroups = useMemo(
    () => (ownersByPath ? groupByOwner(files, ownersByPath) : null),
    [files, ownersByPath],
  );

  if (error && files.length === 0) return <QueryState isLoading={false} error={error} />;

  const ownersLoading = isLoading || owners.isLoading;

  return (
    <Columns aria-busy={isLoading}>
      <Panel title={<FormattedMessage {...messages.folders} />} isLoading={isLoading}>
        <GroupList
          groups={folders}
          label={(key) => key || <FormattedMessage {...messages.rootFolder} />}
          onOpen={(key) => {
            if (key) actions.openFolder(key);
          }}
        />
      </Panel>
      <Panel title={<FormattedMessage {...messages.types} />} isLoading={isLoading}>
        <GroupList
          groups={types}
          label={(key) =>
            key === NO_EXTENSION ? <FormattedMessage {...messages.noExtension} /> : key
          }
          onOpen={(key) => {
            if (key !== NO_EXTENSION) actions.openExtension(key);
          }}
        />
      </Panel>
      {(ownersLoading || ownerGroups) && (
        <Panel title={<FormattedMessage {...messages.owners} />} isLoading={ownersLoading}>
          {ownerGroups && (
            <GroupList
              groups={ownerGroups}
              label={(key) => (key === UNOWNED ? <FormattedMessage {...messages.unowned} /> : key)}
            />
          )}
        </Panel>
      )}
      <TopFilesPanel files={files} isLoading={isLoading} />
    </Columns>
  );
}
