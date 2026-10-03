import { defineMessages, FormattedMessage } from 'react-intl';
import type { ChangedFile } from '@gepard/common';
import { Lines } from '../shared/Lines';
import { LinkButton, PAIR_COLUMNS, RowGrid, Truncated } from '../shared/overviewStyles';

const messages = defineMessages({
  viewedMark: { id: 'content.overview.pr.viewedMark', defaultMessage: '✓ {path}' },
});

export function TopFileRow({
  file,
  viewed,
  onOpen,
}: {
  file: ChangedFile;
  viewed: boolean;
  onOpen: (path: string) => void;
}): React.JSX.Element {
  return (
    <RowGrid $columns={PAIR_COLUMNS}>
      <LinkButton onClick={() => onOpen(file.path)} title={file.path}>
        <Truncated>
          {viewed ? (
            <FormattedMessage {...messages.viewedMark} values={{ path: file.path }} />
          ) : (
            file.path
          )}
        </Truncated>
      </LinkButton>
      <Lines additions={file.additions} deletions={file.deletions} />
    </RowGrid>
  );
}
