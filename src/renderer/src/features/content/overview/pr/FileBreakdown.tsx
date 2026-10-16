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
import { PanelBody } from '../shared/PanelBody';
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
  const { files, isPending, error } = useChangedFileList();
  const owners = useChangedFileOwners();
  const ownersByPath = owners.data;

  const folders = useMemo(() => groupByFolder(files), [files]);
  const types = useMemo(() => groupByExtension(files), [files]);
  const ownerGroups = useMemo(
    () => (ownersByPath ? groupByOwner(files, ownersByPath) : null),
    [files, ownersByPath],
  );

  if (error && files.length === 0) return <QueryState isLoading={false} error={error} />;

  const ownersPending = isPending || owners.isPending;

  return (
    <Columns aria-busy={isPending}>
      <Panel title={<FormattedMessage {...messages.folders} />}>
        <PanelBody isPending={isPending}>
          <GroupList
            groups={folders}
            label={(key) => key || <FormattedMessage {...messages.rootFolder} />}
            onOpen={(key) => {
              if (key) actions.openFolder(key);
            }}
          />
        </PanelBody>
      </Panel>
      <Panel title={<FormattedMessage {...messages.types} />}>
        <PanelBody isPending={isPending}>
          <GroupList
            groups={types}
            label={(key) =>
              key === NO_EXTENSION ? <FormattedMessage {...messages.noExtension} /> : key
            }
            onOpen={(key) => {
              if (key !== NO_EXTENSION) actions.openExtension(key);
            }}
          />
        </PanelBody>
      </Panel>
      {(ownersPending || ownerGroups) && (
        <Panel title={<FormattedMessage {...messages.owners} />}>
          <PanelBody isPending={ownersPending}>
            {ownerGroups && (
              <GroupList
                groups={ownerGroups}
                label={(key) =>
                  key === UNOWNED ? <FormattedMessage {...messages.unowned} /> : key
                }
              />
            )}
          </PanelBody>
        </Panel>
      )}
      <TopFilesPanel files={files} isPending={isPending} />
    </Columns>
  );
}
