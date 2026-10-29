const MARKDOWN_PATH = /\.(?:md|markdown|mkd)$/i;

export function isMarkdownPath(path: string): boolean {
  return MARKDOWN_PATH.test(path);
}
