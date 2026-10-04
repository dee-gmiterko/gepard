import { useState } from 'react';
import { AlertCircle } from 'react-feather';
import { defineMessages, FormattedMessage } from 'react-intl';
import { countComments } from '@gepard/common';
import { useComments } from '../../../queries/comments';
import { useAppDispatch } from '../../../state/AppContext';
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

// Only meaningful without a targeted PR, where useComments lists the unassigned local comments.
export function ComposeIssueButton({ block = false }: { block?: boolean }): React.JSX.Element {
  const dispatch = useAppDispatch();
  const { data: threads = [] } = useComments();
  const [open, setOpen] = useState(false);
  const count = countComments(threads);

  return (
    <>
      <Button block={block} disabled={count === 0} onClick={() => setOpen(true)}>
        <AlertCircle size={14} />
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
