import { useState } from 'react';
import { ArrowUp } from 'react-feather';
import { defineMessages, FormattedMessage } from 'react-intl';
import { countComments } from '@gepard/common';
import { useComments } from '../../../queries/comments';
import { useUiDispatch } from '../../../state/UiContext';
import { Button } from '../../../components/Button';
import { ComposeIssueModal } from './ComposeIssueModal';

const messages = defineMessages({
  composeIssue: {
    id: 'content.composeIssueButton.composeIssue',
    defaultMessage: 'Compose issue',
  },
  composeIssueWithCount: {
    id: 'content.composeIssueButton.composeIssueWithCount',
    defaultMessage: 'Compose issue <b>+{count}</b>',
  },
  issueCreated: {
    id: 'content.composeIssueButton.issueCreated',
    defaultMessage: 'Issue created',
  },
});

export function ComposeIssueButton({ block = false }: { block?: boolean }): React.JSX.Element {
  const dispatch = useUiDispatch();
  const { data: threads = [] } = useComments();
  const [open, setOpen] = useState(false);
  const count = countComments(threads);

  return (
    <>
      <Button block={block} disabled={count === 0} onClick={() => setOpen(true)}>
        <ArrowUp size={14} />
        {count > 0 ? (
          <FormattedMessage
            {...messages.composeIssueWithCount}
            values={{ count, b: (chunks) => <strong>{chunks}</strong> }}
          />
        ) : (
          <FormattedMessage {...messages.composeIssue} />
        )}
      </Button>
      {open && (
        <ComposeIssueModal
          threads={threads}
          commentCount={count}
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            dispatch({ type: 'headerStatus/publish', message: messages.issueCreated });
          }}
        />
      )}
    </>
  );
}
