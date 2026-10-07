import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { Plus } from 'react-feather';
import { defineMessages, FormattedMessage } from 'react-intl';
import type { ReviewThread } from '@gepard/common';
import { useCheckout, useTargeting } from '../../state/hooks';
import { Accordion } from '../../components/Accordion';
import { Button } from '../../components/Button';
import { Caption } from '../../components/Caption';
import { Ellipsis } from '../../components/Ellipsis';
import { Stack } from '../../components/Layout';
import { LineTag } from '../../components/LineTag';
import { Message } from '../../components/Message';
import { ResolvedBadge } from '../../components/StatusBadge';
import { useComments } from '../../queries/comments';
import { ThreadWidget } from './ThreadWidget';

const messages = defineMessages({
  fileTag: {
    id: 'commentEditor.fileComments.fileTag',
    defaultMessage: 'file',
  },
  lineTag: {
    id: 'commentEditor.fileComments.lineTag',
    defaultMessage: 'L{line}',
  },
  replies: {
    id: 'commentEditor.fileComments.replies',
    defaultMessage: '{count, plural, one {# reply} other {# replies}}',
  },
  empty: {
    id: 'commentEditor.fileComments.empty',
    defaultMessage: 'No comments on this file.',
  },
  newFileComment: {
    id: 'commentEditor.fileComments.newFileComment',
    defaultMessage: 'New file comment',
  },
});

interface FileCommentsProps {
  path: string;
}

const Snippet = styled(Ellipsis)`
  color: ${({ theme }) => theme.colors.fg};
`;

function ThreadSummary({ thread }: { thread: ReviewThread }): React.JSX.Element {
  const root = thread.comments[0];
  const replies = thread.comments.length - 1;
  return (
    <>
      <LineTag>
        {thread.anchor.line != null ? (
          <FormattedMessage {...messages.lineTag} values={{ line: thread.anchor.line }} />
        ) : (
          <FormattedMessage {...messages.fileTag} />
        )}
      </LineTag>
      <Snippet>{root?.body.slice(0, 80) ?? ''}</Snippet>
      {replies > 0 && (
        <Caption>
          <FormattedMessage {...messages.replies} values={{ count: replies }} />
        </Caption>
      )}
      {thread.isResolved && <ResolvedBadge />}
    </>
  );
}

export function FileComments({ path }: FileCommentsProps): React.JSX.Element {
  const checkout = useCheckout();
  const targeting = useTargeting();
  const unassigned = targeting.pr === null;
  const checkedOutHead = checkout?.head ?? null;
  const { data: threads = [] } = useComments();
  const [openId, setOpenId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  // Must stay in sync with the inline gutter filter in components/CodeEditor.ts.
  const fileThreads = useMemo(
    () =>
      threads
        .filter(
          (t) =>
            t.anchor.path === path &&
            !t.isOutdated &&
            (unassigned || t.anchor.commitOid === checkedOutHead),
        )
        .sort(
          (a, b) =>
            (a.anchor.line ?? Number.POSITIVE_INFINITY) -
            (b.anchor.line ?? Number.POSITIVE_INFINITY),
        ),
    [threads, path, unassigned, checkedOutHead],
  );

  return (
    <Stack>
      {fileThreads.length === 0 && !addingNew && (
        <Message>
          <FormattedMessage {...messages.empty} />
        </Message>
      )}

      {fileThreads.map((thread) => (
        <Accordion
          key={thread.id}
          open={openId === thread.id}
          onToggle={() => setOpenId(openId === thread.id ? null : thread.id)}
          title={<ThreadSummary thread={thread} />}
        >
          <ThreadWidget thread={thread} />
        </Accordion>
      ))}

      {addingNew ? (
        <ThreadWidget
          draftAnchor={{
            path,
            subjectType: 'FILE',
            side: 'RIGHT',
            line: null,
            startLine: null,
            startSide: null,
          }}
          onClose={() => setAddingNew(false)}
        />
      ) : (
        <div>
          <Button onClick={() => setAddingNew(true)}>
            <Plus size={14} /> <FormattedMessage {...messages.newFileComment} />
          </Button>
        </div>
      )}
    </Stack>
  );
}
