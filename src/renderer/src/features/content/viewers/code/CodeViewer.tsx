import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Compartment } from '@codemirror/state';
import { closeHoverTooltips, EditorView, lineNumbers } from '@codemirror/view';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import type { DiffRow } from '@gepard/common';
import { useUiDispatch } from '../../../../state/UiContext';
import { useActiveFile, useLayout, useRevealLine, useTargeting } from '../../../../state/hooks';
import { useCurrentHead } from '../../../../queries/projects';
import { useFileContent } from '../../../../queries/files';
import { useComments } from '../../../../queries/comments';
import { useDefinitionLookup } from '../../../../queries/search';
import {
  commentAffordanceGutter,
  commentBlockDecorations,
  fullFileDiffDecorations,
  revealDocLine,
  symbolTooltip,
  useReadOnlyEditor,
} from '../../../../components/CodeEditor';
import { lineContextMenu } from '../../../../components/lineContextMenu';
import { SymbolPortals } from '../../../../components/SymbolPortals';
import { CommentPortals } from '../../../../components/CommentPortals';
import { codeViewCommentEntries } from '../../../../helpers/comment';
import { deletedLineDocLines, fullFileDiffMarks } from '../../../../helpers/diff';
import { EditorHost } from '../../../../components/EditorHost';
import { Message } from '../../../../components/Message';
import { CommentPortalHost } from '../CommentPortalHost';
import { ImageViewer } from '../image/ImageViewer';
import { MissingViewer } from '../missing/MissingViewer';
import { SymbolPopupHost } from './SymbolPopup';

const messages = defineMessages({
  loading: {
    id: 'content.viewer.loading',
    defaultMessage: 'Loading…',
  },
  binaryNotShown: {
    id: 'content.viewer.binaryNotShown',
    defaultMessage: 'Binary file not shown',
  },
});

export function CodeViewer({
  path,
  diffRows = null,
}: {
  path: string;
  diffRows?: readonly DiffRow[] | null;
}): React.JSX.Element {
  const sha = useCurrentHead() ?? '';
  const { data } = useFileContent(sha, path);

  if (!data)
    return (
      <Message layout="center">
        <FormattedMessage {...messages.loading} />
      </Message>
    );
  switch (data.kind) {
    case 'missing':
      return <MissingViewer path={path} />;
    case 'image':
      return <ImageViewer path={path} image={data.image} />;
    case 'binary':
      return (
        <Message layout="center">
          <FormattedMessage {...messages.binaryNotShown} />
        </Message>
      );
    case 'text':
      return <CodeText path={path} text={data.text} diffRows={diffRows} />;
  }
}

function CodeText({
  path,
  text,
  diffRows,
}: {
  path: string;
  text: string;
  diffRows: readonly DiffRow[] | null;
}): React.JSX.Element {
  const intl = useIntl();
  const activeFile = useActiveFile();
  const layout = useLayout();
  const revealLine = useRevealLine();
  const targeting = useTargeting();
  const dispatch = useUiDispatch();
  const unassigned = targeting.pr === null;
  const { data: threads } = useComments();
  const head = useCurrentHead() ?? '';
  const lookupDefinition = useDefinitionLookup(head, path);
  const symbolPortals = useMemo(() => new SymbolPortals(), []);
  useLayoutEffect(() => {
    symbolPortals.setResolver((symbol) =>
      lookupDefinition({ line: symbol.line, col: symbol.col }).then(
        (result) => result.definitions,
        () => [],
      ),
    );
  }, [symbolPortals, lookupDefinition]);
  const wrapLongLines = layout.wrapLongLines;
  const diffCompartment = useMemo(() => new Compartment(), []);
  const extensions = useMemo(
    () => [
      lineNumbers(),
      symbolTooltip(symbolPortals),
      lineContextMenu(path),
      wrapLongLines ? EditorView.lineWrapping : [],
      diffCompartment.of([]),
    ],
    [symbolPortals, path, wrapLongLines, diffCompartment],
  );
  const { containerRef, view, comments, commentGutter } = useReadOnlyEditor(path, text, extensions);
  const [draft, setDraft] = useState<number | null>(null);
  const portals = useMemo(() => new CommentPortals(), []);
  const openLocation = useCallback(
    (target: string, line: number) => {
      view?.dispatch({ effects: closeHoverTooltips });
      dispatch({ type: 'file/open', path: target, line });
    },
    [view, dispatch],
  );

  const diffMarks = useMemo(() => (diffRows ? fullFileDiffMarks(diffRows) : null), [diffRows]);
  useEffect(() => {
    if (!view) return;
    view.dispatch({
      effects: diffCompartment.reconfigure(
        diffMarks ? fullFileDiffDecorations(view.state.doc, diffMarks) : [],
      ),
    });
  }, [diffMarks, view, diffCompartment, extensions, text]);

  useEffect(() => {
    if (!view) return;
    view.dispatch({
      effects: commentGutter.reconfigure(commentAffordanceGutter(intl, () => true, setDraft)),
    });
  }, [view, commentGutter, intl]);

  useEffect(() => {
    if (!view) return;
    const entries = codeViewCommentEntries(
      threads ?? [],
      path,
      draft,
      unassigned ? null : head,
      diffRows,
    );
    view.dispatch({
      effects: comments.reconfigure(commentBlockDecorations(view.state.doc, entries, portals)),
    });
  }, [threads, draft, unassigned, path, head, diffRows, view, comments, portals, text]);

  useEffect(() => {
    if (!view || activeFile !== path || revealLine == null) return;
    const { line, side } = revealLine;
    const docLine = side === 'LEFT' && diffRows ? deletedLineDocLines(diffRows).get(line) : line;
    if (docLine != null) revealDocLine(view, docLine);
  }, [view, path, activeFile, revealLine, diffRows]);

  return (
    <>
      <EditorHost ref={containerRef} />
      <SymbolPopupHost portals={symbolPortals} sha={head} path={path} onOpen={openLocation} />
      <CommentPortalHost portals={portals} onCloseDraft={() => setDraft(null)} />
    </>
  );
}
