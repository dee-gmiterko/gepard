import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { closeHoverTooltips, lineNumbers } from '@codemirror/view';
import { FormattedMessage } from 'react-intl';
import { useAppDispatch, useAppState } from '../../../../state/AppContext';
import { useCurrentHead } from '../../../../queries/projects';
import { useFileContent } from '../../../../queries/files';
import { useComments } from '../../../../queries/comments';
import { useDefinitionLookup } from '../../../../queries/search';
import { useReadOnlyEditor } from '../../../../components/CodeEditor/useReadOnlyEditor';
import { revealDocLine } from '../../../../components/CodeEditor/revealLine';
import { SymbolPortals, symbolTooltip } from '../../../../components/CodeEditor/symbolTooltip';
import {
  CommentPortals,
  commentAffordanceGutter,
  commentBlockDecorations,
} from '../../../../components/CodeEditor/commentWidgets';
import { codeViewCommentEntries } from '../../../../helpers/comment';
import { EditorHost } from '../../../../components/EditorHost';
import { Message } from '../../../../components/Message';
import { CommentPortalHost } from '../CommentPortalHost';
import { ImageViewer } from '../image/ImageViewer';
import { MissingViewer } from '../missing/MissingViewer';
import { viewerMessages } from '../messages';
import { SymbolPopupHost } from './SymbolPopup';

export function CodeViewer({ path }: { path: string }): React.JSX.Element {
  const sha = useCurrentHead() ?? '';
  const { data } = useFileContent(sha, path);

  if (!data)
    return (
      <Message layout="center">
        <FormattedMessage {...viewerMessages.loading} />
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
          <FormattedMessage {...viewerMessages.binaryNotShown} />
        </Message>
      );
    case 'text':
      return <CodeText path={path} text={data.text} />;
  }
}

function CodeText({ path, text }: { path: string; text: string }): React.JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const pr = state.targeting.pr;
  const commentsEnabled = pr !== null;
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
  // Kept stable: a new extensions value makes the editor reload the whole document.
  const extensions = useMemo(() => [lineNumbers(), symbolTooltip(symbolPortals)], [symbolPortals]);
  const { containerRef, view, comments, commentGutter } = useReadOnlyEditor(path, text, extensions);
  const [draft, setDraft] = useState<number | null>(null);
  const activeDraft = commentsEnabled ? draft : null;
  const portals = useMemo(() => new CommentPortals(), []);
  const openLocation = useCallback(
    (target: string, line: number) => {
      view?.dispatch({ effects: closeHoverTooltips });
      dispatch({ type: 'file/open', path: target, line });
    },
    [view, dispatch],
  );

  useEffect(() => {
    if (!view) return;
    view.dispatch({
      effects: commentGutter.reconfigure(
        commentsEnabled ? commentAffordanceGutter(() => true, setDraft) : [],
      ),
    });
  }, [commentsEnabled, view, commentGutter]);

  useEffect(() => {
    if (!view) return;
    const entries = commentsEnabled
      ? codeViewCommentEntries(threads ?? [], path, activeDraft, head)
      : [];
    view.dispatch({
      effects: comments.reconfigure(commentBlockDecorations(view.state.doc, entries, portals)),
    });
  }, [threads, activeDraft, commentsEnabled, path, head, view, comments, portals]);

  useEffect(() => {
    if (!view || state.activeFile !== path || state.revealLine == null) return;
    revealDocLine(view, state.revealLine.line);
  }, [view, path, state.activeFile, state.revealLine]);

  return (
    <>
      <EditorHost ref={containerRef} />
      <SymbolPopupHost portals={symbolPortals} sha={head} path={path} onOpen={openLocation} />
      {commentsEnabled && (
        <CommentPortalHost portals={portals} onCloseDraft={() => setDraft(null)} />
      )}
    </>
  );
}
