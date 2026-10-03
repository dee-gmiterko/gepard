import { GutterMarker } from '@codemirror/view';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Plus } from 'react-feather';
import { defineMessages } from 'react-intl';
import { intl } from '../i18n/intl';

const messages = defineMessages({
  addComment: {
    id: 'codeEditor.addComment',
    defaultMessage: 'Add comment',
  },
});

// CodeMirror gutter markers are plain DOM outside the React tree.
let plusIconMarkup: string | null = null;

export class AffordanceMarker extends GutterMarker {
  eq(other: AffordanceMarker): boolean {
    return other instanceof AffordanceMarker;
  }
  toDOM(): HTMLElement {
    plusIconMarkup ??= renderToStaticMarkup(createElement(Plus, { size: 12 }));
    // A native button's Enter/Space click bubbles to CodeMirror's gutter-level click handler.
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cm-comment-affordance';
    button.innerHTML = plusIconMarkup;
    button.setAttribute('aria-label', intl.formatMessage(messages.addComment));
    return button;
  }
}
