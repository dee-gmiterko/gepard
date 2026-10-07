import { useEffect, useMemo, useState } from 'react';
import { EditorView } from '@codemirror/view';
import type { DiffRow, DiffSide } from '@gepard/common';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import {
  useActiveFile,
  useCheckoutHead,
  useLayout,
  useRevealLine,
  useTargetPr,
  useTargeting,
} from '../../../../state/hooks';
import { useFileDiff } from '../../../../queries/files';
import { useComments } from '../../../../queries/comments';
import {
  buildDiffDoc,
  commentAffordanceGutter,
  commentBlockDecorations,
  diffGutters,
  diffLineDecorations,
  revealDocLine,
  useReadOnlyEditor,
} from '../../../../components/CodeEditor';
import { diffViewCommentEntries } from '../../../../helpers/comment';
import { findDiffDocLine } from '../../../../helpers/diff';
import { CommentPortals } from '../../../../components/CommentPortals';
import { EditorHost } from '../../../../components/EditorHost';
import { Message } from '../../../../components/Message';
import { CommentPortalHost } from '../CommentPortalHost';
import { ImageDiffViewer } from '../imageDiff/ImageDiffViewer';
import { MissingViewer } from '../missing/MissingViewer';

const messages = defineMessages({
  loading: {
    id: 'content.viewer.loading',
    defaultMessage: 'Loading…',
  },
  binaryNotShown: {
    id: 'content.viewer.binaryNotShown',
    defaultMessage: 'Binary file not shown',
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
      return (
        <Message layout="center">
          <FormattedMessage {...messages.binaryNotShown} />
        </Message>
      );
    case 'image':
      return <ImageDiffViewer path={path} before={data.before} after={data.after} />;
    case 'text':
      if (data.rows.length === 0)
        return (
          <Message layout="center">
            {data.previousPath ? (
              <>
                <FormattedMessage {...messages.renamedWithoutChanges} />
                {'\n'}
                <FormattedMessage
                  {...messages.renamedPaths}
                  values={{ previousPath: data.previousPath, path }}
                />
              </>
            ) : (
              <FormattedMessage {...messages.noContentChanges} />
            )}
          </Message>
        );
      return <DiffText path={path} rows={data.rows} />;
  }
}

function DiffText({ path, rows }: { path: string; rows: DiffRow[] }): React.JSX.Element {
  const intl = useIntl();
  const activeFile = useActiveFile();
  const checkoutHead = useCheckoutHead();
  const layout = useLayout();
  const revealLine = useRevealLine();
  const targeting = useTargeting();
  const pr = useTargetPr();
  const { data: threads } = useComments();
  const head = checkoutHead?.head ?? '';
  const singleCommitInPr = pr !== null && targeting.commit !== null;

  const { doc, infos } = useMemo(() => buildDiffDoc(rows), [rows]);
  const wrapLongLines = layout.wrapLongLines;
  const extensions = useMemo(
    () => [
      ...diffGutters(infos),
      diffLineDecorations(doc, infos),
      wrapLongLines ? EditorView.lineWrapping : [],
    ],
    [doc, infos, wrapLongLines],
  );
  const { containerRef, view, comments, commentGutter } = useReadOnlyEditor(path, doc, extensions);
  const [draft, setDraft] = useState<{ docLine: number; side: DiffSide } | null>(null);
  const portals = useMemo(() => new CommentPortals(), []);

  useEffect(() => {
    if (!view) return;
    view.dispatch({
      effects: commentGutter.reconfigure(
        commentAffordanceGutter(
          intl,
          (docLine) => {
            const kind = infos[docLine - 1]?.kind;
            if (kind === undefined || kind === 'hunk') return false;
            return !(singleCommitInPr && kind === 'delete');
          },
          (docLine) => {
            const kind = infos[docLine - 1]?.kind;
            setDraft({ docLine, side: kind === 'delete' ? 'LEFT' : 'RIGHT' });
          },
        ),
      ),
    });
  }, [infos, singleCommitInPr, view, commentGutter, intl]);

  useEffect(() => {
    if (!view) return;
    const entries = diffViewCommentEntries(
      threads ?? [],
      path,
      infos,
      draft,
      pr === null ? null : head,
    );
    view.dispatch({
      effects: comments.reconfigure(commentBlockDecorations(view.state.doc, entries, portals)),
    });
  }, [threads, draft, pr, path, infos, head, view, comments, portals]);

  useEffect(() => {
    if (!view || activeFile !== path || revealLine == null) return;
    const docLine = findDiffDocLine(infos, revealLine.line, revealLine.side);
    if (docLine != null) revealDocLine(view, docLine);
  }, [view, path, infos, activeFile, revealLine]);

  return (
    <>
      <EditorHost ref={containerRef} />
      <CommentPortalHost portals={portals} onCloseDraft={() => setDraft(null)} />
    </>
  );
}
