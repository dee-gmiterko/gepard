import type { Extension } from '@codemirror/state';
import { gutter } from '@codemirror/view';
import type { Annotation } from '@gepard/common';
import { worstAnnotationByLine } from '../helpers/annotation';
import { PipelineMarker } from './PipelineMarker';

export function pipelineGutter(
  annotations: readonly Annotation[],
  docLineOf: (annotationLine: number) => number | null,
  onClick: (docLine: number) => void,
): Extension {
  const worst = worstAnnotationByLine(annotations, docLineOf);
  return gutter({
    class: 'cm-pipeline-gutter',
    lineMarker: (view, line) => {
      const a = worst.get(view.state.doc.lineAt(line.from).number);
      return a ? new PipelineMarker(a.level, `${a.checkName}: ${a.message}`) : null;
    },
    domEventHandlers: {
      click: (view, line) => {
        const docLine = view.state.doc.lineAt(line.from).number;
        if (!worst.has(docLine)) return false;
        onClick(docLine);
        return true;
      },
    },
  });
}
