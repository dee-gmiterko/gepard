import styled from 'styled-components';
import { defineMessages, FormattedMessage } from 'react-intl';
import { useCurrentHead } from '../../../../queries/projects';
import { useFileContent, useFileDiff } from '../../../../queries/files';
import { Message } from '../../../../components/Message';
import {
  Markdown,
  markdownDiffSegments,
  type MarkdownSegment,
  type MarkdownViewType,
} from '../../../../components/markdown';
import { CodeViewer } from '../code/CodeViewer';
import { DiffViewer } from '../diff/DiffViewer';

const messages = defineMessages({
  loading: {
    id: 'content.viewer.loading',
    defaultMessage: 'Loading…',
  },
});

const Page = styled.div`
  flex: 1;
  min-width: 0;
  padding: ${({ theme }) => theme.space[3]};
  overflow: auto;
`;

const Block = styled.div<{ $kind: MarkdownSegment['kind'] }>`
  padding: 0 ${({ theme }) => theme.space[2]};
  ${({ $kind, theme }) =>
    $kind === 'add'
      ? `background: ${theme.colors.diffAddBg}; color: ${theme.colors.diffAddFg};`
      : $kind === 'delete'
        ? `background: ${theme.colors.diffDelBg}; color: ${theme.colors.diffDelFg};`
        : ''}
`;

function Loading(): React.JSX.Element {
  return (
    <Message layout="center">
      <FormattedMessage {...messages.loading} />
    </Message>
  );
}

function FilePreview({ path }: { path: string }): React.JSX.Element {
  const sha = useCurrentHead() ?? '';
  const { data } = useFileContent(sha, path);
  if (!data) return <Loading />;
  if (data.kind !== 'text') return <CodeViewer path={path} />;
  return (
    <Page>
      <Markdown>{data.text}</Markdown>
    </Page>
  );
}

function DiffPreview({ path }: { path: string }): React.JSX.Element {
  const { data } = useFileDiff(path);
  if (!data) return <Loading />;
  if (data.kind !== 'text' || data.rows.length === 0) return <DiffViewer path={path} />;
  return (
    <Page>
      {markdownDiffSegments(data.rows).map((segment) => (
        <Block key={segment.key} $kind={segment.kind}>
          <Markdown>{segment.text}</Markdown>
        </Block>
      ))}
    </Page>
  );
}

export function MarkdownViewer({
  path,
  type,
}: {
  path: string;
  type: MarkdownViewType;
}): React.JSX.Element {
  return type === 'diff' ? <DiffPreview path={path} /> : <FilePreview path={path} />;
}
