import { useMemo } from 'react';
import styled from 'styled-components';
import { defineMessages, FormattedMessage } from 'react-intl';
import type { ReviewThread } from '@gepard/common';
import { useAppDispatch, useAppState } from '../../../state/AppContext';
import { useComments } from '../../../queries/comments';
import { Message } from '../../../components/Message';
import { PrCommentComposer } from '../../commentEditor/PrCommentComposer';
import { ThreadWidget } from '../../commentEditor/ThreadWidget';
import { ComposeIssueButton } from '../issue/ComposeIssueButton';
import { sortThreadsChronologically } from '../../../helpers/comment';

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
`;

const ThreadList = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: auto;
`;

const ComposerRow = styled.div`
  flex-shrink: 0;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  padding: ${({ theme }) => theme.space[3]};
`;

const Notice = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const ThreadGroup = styled.div`
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const messages = defineMessages({
  unassigned: {
    id: 'content.commentsTab.unassigned',
    defaultMessage:
      'No pull request is targeted. These local comments are not assigned to any pull request and can be composed into a new issue.',
  },
  loading: {
    id: 'content.commentsTab.loading',
    defaultMessage: 'Loading comments…',
  },
  empty: {
    id: 'content.commentsTab.empty',
    defaultMessage: 'No comments yet.',
  },
});

export function CommentsTab(): React.JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const pr = state.targeting.pr;

  const { data: threads = [], isLoading } = useComments();

  const ordered = useMemo(() => sortThreadsChronologically(threads), [threads]);

  if (isLoading)
    return (
      <Message>
        <FormattedMessage {...messages.loading} />
      </Message>
    );

  function openThread(thread: ReviewThread): void {
    if (thread.anchor.subjectType === 'PR') return;
    dispatch({
      type: 'file/open',
      path: thread.anchor.path,
      line: thread.anchor.line,
      side: thread.anchor.side,
    });
  }

  return (
    <Panel>
      {pr === null && (
        <Notice>
          <Message tone="subtle">
            <FormattedMessage {...messages.unassigned} />
          </Message>
          <ComposeIssueButton />
        </Notice>
      )}
      <ThreadList>
        {ordered.length === 0 ? (
          <Message>
            <FormattedMessage {...messages.empty} />
          </Message>
        ) : (
          ordered.map((thread) => (
            <ThreadGroup key={thread.id}>
              <ThreadWidget thread={thread} onOpen={() => openThread(thread)} />
            </ThreadGroup>
          ))
        )}
      </ThreadList>
      <ComposerRow>
        <PrCommentComposer />
      </ComposerRow>
    </Panel>
  );
}
