import { GutterMarker } from '@codemirror/view';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Plus } from 'react-feather';
// CodeMirror gutter markers are plain DOM outside the React tree.
let plusIconMarkup: string | null = null;

export class AffordanceMarker extends GutterMarker {
  constructor(private readonly label: string) {
    super();
  }
  eq(other: AffordanceMarker): boolean {
    return other instanceof AffordanceMarker && other.label === this.label;
  }
  toDOM(): HTMLElement {
    plusIconMarkup ??= renderToStaticMarkup(createElement(Plus, { size: 12 }));
    // A native button's Enter/Space click bubbles to CodeMirror's gutter-level click handler.
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cm-comment-affordance';
    button.innerHTML = plusIconMarkup;
    button.setAttribute('aria-label', this.label);
    return button;
  }
}
