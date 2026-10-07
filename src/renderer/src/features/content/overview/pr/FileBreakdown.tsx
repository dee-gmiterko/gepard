import { useMemo } from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import styled from 'styled-components';
import { useCheckoutHead } from '../../../../state/hooks';
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
  const checkoutHead = useCheckoutHead();
  const { files, isLoading, error } = useChangedFileList();
  const ownersByPath = useChangedFileOwners().data;

  const folders = useMemo(() => groupByFolder(files), [files]);
  const types = useMemo(() => groupByExtension(files), [files]);
  const owners = useMemo(
    () => (ownersByPath ? groupByOwner(files, ownersByPath) : null),
    [files, ownersByPath],
  );

  if (files.length === 0)
    return <QueryState isLoading={isLoading || !checkoutHead} error={error} />;

  return (
    <Columns>
      <Panel title={<FormattedMessage {...messages.folders} />}>
        <GroupList
          groups={folders}
          label={(key) => key || <FormattedMessage {...messages.rootFolder} />}
          onOpen={(key) => {
            if (key) actions.openFolder(key);
          }}
        />
      </Panel>
      <Panel title={<FormattedMessage {...messages.types} />}>
        <GroupList
          groups={types}
          label={(key) =>
            key === NO_EXTENSION ? <FormattedMessage {...messages.noExtension} /> : key
          }
        />
      </Panel>
      {owners && (
        <Panel title={<FormattedMessage {...messages.owners} />}>
          <GroupList
            groups={owners}
            label={(key) => (key === UNOWNED ? <FormattedMessage {...messages.unowned} /> : key)}
          />
        </Panel>
      )}
      <TopFilesPanel files={files} />
    </Columns>
  );
}
