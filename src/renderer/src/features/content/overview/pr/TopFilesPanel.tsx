import { useMemo } from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import type { ChangedFile } from '@gepard/common';
import { topChangedFiles } from '../../../../helpers/overview';
import { Panel } from '../shared/Panel';
import { Table } from '../shared/overviewStyles';
import { useOverviewActions } from '../shared/useOverviewActions';
import { TopFileRow } from './TopFileRow';
import { useViewedPaths } from './useViewedPaths';

const messages = defineMessages({
  title: { id: 'content.overview.pr.topFiles', defaultMessage: 'Top changed files' },
});

const LIMIT = 5;

export function TopFilesPanel({ files }: { files: readonly ChangedFile[] }): React.JSX.Element {
  const actions = useOverviewActions();
  const viewedPaths = useViewedPaths();
  const top = useMemo(() => topChangedFiles(files, LIMIT), [files]);
  return (
    <Panel title={<FormattedMessage {...messages.title} />}>
      <Table>
        {top.map((f) => (
          <TopFileRow
            key={f.path}
            file={f}
            viewed={viewedPaths.has(f.path)}
            onOpen={actions.openFile}
          />
        ))}
      </Table>
    </Panel>
  );
}
