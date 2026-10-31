import type { ReactNode } from 'react';
import styled from 'styled-components';
import { defineMessages, FormattedMessage } from 'react-intl';
import { useFileDiff } from '../../../../queries/files';
import { Message } from '../../../../components/Message';
import { ImageViewer } from '../image/ImageViewer';
import { BinaryViewer } from '../binary/BinaryViewer';
import { BinaryDiffViewer } from '../binary/BinaryDiffViewer';
import { ImageDiffViewer } from '../imageDiff/ImageDiffViewer';
import { MissingViewer } from '../missing/MissingViewer';
import { DiffCodeViewer } from './DiffCodeViewer';

const messages = defineMessages({
  loading: {
    id: 'content.viewer.loading',
    defaultMessage: 'Loading…',
  },
  renamedWithoutChanges: {
    id: 'content.diffViewer.renamedWithoutChanges',
    defaultMessage: 'File renamed without changes.',
  },
  renamedPaths: {
    id: 'content.diffViewer.renamedPaths',
    defaultMessage: '{previousPath} → {path}',
  },
  noContentChanges: {
    id: 'content.diffViewer.noContentChanges',
    defaultMessage: 'No content changes.',
  },
});

const Split = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const Half = styled.div.attrs<{ 'data-gamepad-scroll': string }>({ 'data-gamepad-scroll': '' })`
  flex: 1 1 50%;
  min-height: 0;
  overflow: auto;

  & + & {
    border-top: 1px solid ${({ theme }) => theme.colors.border};
  }
`;

function RenamedMessage({
  previousPath,
  path,
}: {
  previousPath: string;
  path: string;
}): React.JSX.Element {
  return (
    <Message layout="center">
      <div>
        <FormattedMessage {...messages.renamedWithoutChanges} />
      </div>
      <div>
        <FormattedMessage {...messages.renamedPaths} values={{ previousPath, path }} />
      </div>
    </Message>
  );
}

function MovedContents({
  previousPath,
  path,
  children,
}: {
  previousPath: string;
  path: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <Split>
      <Half>
        <RenamedMessage previousPath={previousPath} path={path} />
      </Half>
      <Half>{children}</Half>
    </Split>
  );
}

export function DiffViewer({ path }: { path: string }): React.JSX.Element {
  const { data } = useFileDiff(path);

  if (!data)
    return (
      <Message layout="center">
        <FormattedMessage {...messages.loading} />
      </Message>
    );
  switch (data.kind) {
    case 'missing':
      return <MissingViewer path={path} />;
    case 'binary':
      if (data.moved && data.previousPath)
        return (
          <MovedContents previousPath={data.previousPath} path={path}>
            <BinaryViewer path={path} size={data.newSize ?? undefined} />
          </MovedContents>
        );
      return (
        <BinaryDiffViewer
          path={path}
          previousPath={data.previousPath}
          oldSize={data.oldSize}
          newSize={data.newSize}
        />
      );
    case 'image':
      if (data.moved && data.previousPath && data.after)
        return (
          <MovedContents previousPath={data.previousPath} path={path}>
            <ImageViewer path={path} image={data.after} />
          </MovedContents>
        );
      return <ImageDiffViewer path={path} before={data.before} after={data.after} />;
    case 'text':
      if (data.rows.length === 0)
        return data.previousPath ? (
          <RenamedMessage previousPath={data.previousPath} path={path} />
        ) : (
          <Message layout="center">
            <FormattedMessage {...messages.noContentChanges} />
          </Message>
        );
      return <DiffCodeViewer path={path} rows={data.rows} />;
  }
}
