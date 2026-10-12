import { GutterMarker } from '@codemirror/view';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AlertCircle, AlertTriangle, Info } from 'react-feather';
import type { AnnotationLevel } from '@gepard/common';

const ICONS = { failure: AlertCircle, warning: AlertTriangle, notice: Info } as const;
const iconMarkup = new Map<AnnotationLevel, string>();

export class PipelineMarker extends GutterMarker {
  constructor(
    private readonly level: AnnotationLevel,
    private readonly label: string,
  ) {
    super();
  }
  eq(other: PipelineMarker): boolean {
    return (
      other instanceof PipelineMarker && other.level === this.level && other.label === this.label
    );
  }
  toDOM(): HTMLElement {
    let markup = iconMarkup.get(this.level);
    if (markup === undefined) {
      markup = renderToStaticMarkup(createElement(ICONS[this.level], { size: 12 }));
      iconMarkup.set(this.level, markup);
    }
    const el = document.createElement('span');
    el.className = `cm-pipeline-marker cm-pipeline-${this.level}`;
    el.innerHTML = markup;
    el.title = this.label;
    return el;
  }
}
