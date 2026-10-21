import { useCallback, useEffect, useMemo, useState } from 'react';
import { EditorView } from '@codemirror/view';
import { useIntl } from 'react-intl';
import type { DiffRow, DiffSide } from '@gepard/common';
import {
  useActiveFile,
  useCheckoutHead,
  useLayout,
  useRevealLine,
  useTargetPr,
  useTargeting,
} from '../../../../state/hooks';
import { useComments } from '../../../../queries/comments';
import { commentAffordanceGutter } from '../../../../codeEditor/commentAffordance';
import { commentBlockDecorations } from '../../../../codeEditor/commentBlocks';
import { CommentPortals } from '../../../../codeEditor/CommentPortals';
import { diffGutters, diffLineDecorations } from '../../../../codeEditor/diff';
import { useSetLineTarget } from '../../../../hooks/useSetLineTarget';
import { lineContextMenu } from '../../../../codeEditor/lineContextMenu';
import { pipelineGutter } from '../../../../codeEditor/pipeline';
import { useReadOnlyEditor } from '../../../../codeEditor/readOnlyEditor';
import { revealDocLine } from '../../../../codeEditor/reveal';
import { symbolTooltip } from '../../../../codeEditor/symbols';
import { diffViewCommentEntries } from '../../../../helpers/comment';
import { buildDiffDoc, findDiffDocLine, newLineOfDocLine } from '../../../../helpers/diff';
import { EditorHost, NARROW_EDITOR_QUERY } from '../../../../components/EditorHost';
import { useMediaQuery } from '../../../../hooks/useMediaQuery';
import { CommentPortalHost } from '../CommentPortalHost';
import { useGotoDefinition, useOpenLocation, useSymbolPortals } from '../useSymbolNavigation';
import { useViewerAnnotations } from '../useViewerAnnotations';
import { SymbolPopupHost } from '../code/SymbolPopup';

export function DiffCodeViewer({
  path,
  rows,
}: {
  path: string;
  rows: DiffRow[];
}): React.JSX.Element {
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
  const newSideIsHead = targeting.commit === null || targeting.commit === head;
  const annotations = useViewerAnnotations(path, newSideIsHead);
  const symbolPortals = useSymbolPortals(head, path);

  const { doc, infos } = useMemo(() => buildDiffDoc(rows), [rows]);
  const gotoLine = useCallback(
    (docLine: number): number | null => (newSideIsHead ? newLineOfDocLine(infos, docLine) : null),
    [infos, newSideIsHead],
  );
  const goto = useGotoDefinition(path, symbolPortals, gotoLine);
  const setLineTarget = useSetLineTarget();
  const wrapLongLines = layout.wrapLongLines;
  const narrow = useMediaQuery(NARROW_EDITOR_QUERY);
  const extensions = useMemo(() => {
    const fileLineOf = (docLine: number): number | null => newLineOfDocLine(infos, docLine);
    return [
      ...(narrow ? [] : diffGutters(infos)),
      diffLineDecorations(doc, infos),
      symbolTooltip(symbolPortals, newSideIsHead ? fileLineOf : () => null),
      goto,
      lineContextMenu(path, setLineTarget, fileLineOf),
      wrapLongLines ? EditorView.lineWrapping : [],
    ];
  }, [narrow, doc, infos, symbolPortals, goto, newSideIsHead, path, setLineTarget, wrapLongLines]);
  const { containerRef, view, comments, commentGutter } = useReadOnlyEditor(path, doc, extensions);
  const [draft, setDraft] = useState<{ docLine: number; side: DiffSide } | null>(null);
  const portals = useMemo(() => new CommentPortals(), []);
  const openLocation = useOpenLocation(view);

  useEffect(() => {
    if (!view) return;
    view.dispatch({
      effects: commentGutter.reconfigure([
        pipelineGutter(
          annotations,
          (line) => findDiffDocLine(infos, line, 'RIGHT'),
          (docLine) => setDraft({ docLine, side: 'RIGHT' }),
        ),
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
      ]),
    });
  }, [infos, singleCommitInPr, view, commentGutter, intl, annotations]);

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
      <SymbolPopupHost portals={symbolPortals} sha={head} path={path} onOpen={openLocation} />
      <CommentPortalHost portals={portals} onCloseDraft={() => setDraft(null)} />
    </>
  );
}
