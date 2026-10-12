import { GutterMarker } from '@codemirror/view';

export class DiffLineNumberMarker extends GutterMarker {
  constructor(private readonly label: string) {
    super();
  }
  eq(other: DiffLineNumberMarker): boolean {
    return other.label === this.label;
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-diff-linenumber';
    span.textContent = this.label;
    return span;
  }
}
