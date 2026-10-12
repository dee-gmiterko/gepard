import { WidgetType } from '@codemirror/view';

export class DeletedLinesWidget extends WidgetType {
  constructor(private readonly lines: readonly string[]) {
    super();
  }
  eq(other: DeletedLinesWidget): boolean {
    return (
      other.lines.length === this.lines.length && other.lines.every((l, i) => l === this.lines[i])
    );
  }
  toDOM(): HTMLElement {
    const block = document.createElement('div');
    block.className = 'cm-deleted-lines';
    for (const text of this.lines) {
      const line = document.createElement('div');
      line.className = 'cm-deleted-line';
      line.textContent = text || '​';
      block.append(line);
    }
    return block;
  }
}
