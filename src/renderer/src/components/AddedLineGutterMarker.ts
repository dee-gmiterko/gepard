import { GutterMarker } from '@codemirror/view';

export class AddedLineGutterMarker extends GutterMarker {
  override elementClass = 'cm-gutter-line-add';
  eq(other: AddedLineGutterMarker): boolean {
    return other instanceof AddedLineGutterMarker;
  }
}
