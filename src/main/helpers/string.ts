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
