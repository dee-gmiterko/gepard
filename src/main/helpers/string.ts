// The renderer's `scope`/`message` are untrusted input; a line break would
// let one log.write call forge additional log lines.
export function oneLine(value: string): string {
  return value.replace(/\r\n|\r|\n/g, ' ');
}

// LSP textDocument/definition does not return the name of the symbol under
// the cursor.
export function identifierAt(lineText: string, col1: number): string {
  const idx = col1 - 1;
  const isWordChar = (c: string | undefined): boolean => !!c && /[A-Za-z0-9_$]/.test(c);
  let start = idx;
  while (start > 0 && isWordChar(lineText[start - 1])) start--;
  let end = idx;
  while (isWordChar(lineText[end])) end++;
  if (end <= start) return lineText.slice(Math.max(0, idx), idx + 1);
  return lineText.slice(start, end);
}

export function utf16ByteBoundaries(text: string): number[] {
  const boundaries = new Array<number>(text.length + 1);
  boundaries[0] = 0;
  let i = 0;
  let bytes = 0;
  while (i < text.length) {
    const codePoint = text.codePointAt(i) ?? 0;
    bytes += Buffer.byteLength(String.fromCodePoint(codePoint), 'utf8');
    if (codePoint > 0xffff) {
      boundaries[i + 1] = bytes;
      boundaries[i + 2] = bytes;
      i += 2;
    } else {
      boundaries[i + 1] = bytes;
      i += 1;
    }
  }
  return boundaries;
}

export function byteOffsetToUtf16(boundaries: number[], byteOffset: number): number {
  let lo = 0;
  let hi = boundaries.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (boundaries[mid] < byteOffset) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
