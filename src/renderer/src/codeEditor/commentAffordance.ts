import { defineMessages, type IntlShape } from 'react-intl';
import type { Extension } from '@codemirror/state';
import { gutter } from '@codemirror/view';
import { AffordanceMarker } from './AffordanceMarker';

const addCommentMessage = defineMessages({
  addComment: { id: 'codeEditor.addComment', defaultMessage: 'Add comment' },
});

export function commentAffordanceGutter(
  intl: IntlShape,
  isCommentable: (docLine: number) => boolean,
  onClick: (docLine: number) => void,
): Extension {
  const label = intl.formatMessage(addCommentMessage.addComment);
  return gutter({
    class: 'cm-comment-gutter',
    lineMarker: (view, line) => {
      const docLine = view.state.doc.lineAt(line.from).number;
      return isCommentable(docLine) ? new AffordanceMarker(label) : null;
    },
    initialSpacer: () => new AffordanceMarker(label),
    domEventHandlers: {
      click: (view, line) => {
        const docLine = view.state.doc.lineAt(line.from).number;
        if (!isCommentable(docLine)) return false;
        onClick(docLine);
        return true;
      },
    },
  });
}
