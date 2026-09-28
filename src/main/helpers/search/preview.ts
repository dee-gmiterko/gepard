export const MAX_PREVIEW_CHARS = 300;
const LEADING_CONTEXT_CHARS = 80;

export interface ClippedPreview {
  preview: string;
  spans: Array<[number, number]>;
}

export function clipPreview(
  preview: string,
  spans: Array<[number, number]>,
  max = MAX_PREVIEW_CHARS,
): ClippedPreview {
  if (preview.length <= max) return { preview, spans };

  const firstMatchStart = spans.length > 0 ? spans[0][0] : 0;
  let start = Math.max(0, Math.min(firstMatchStart - LEADING_CONTEXT_CHARS, preview.length - max));
  let end = Math.min(preview.length, start + max);
  if (start > 0 && isLowSurrogate(preview.charCodeAt(start))) start += 1;
  if (end < preview.length && isHighSurrogate(preview.charCodeAt(end - 1))) end -= 1;

  return {
    preview: preview.slice(start, end),
    spans: spans
      .filter(([s, e]) => e > start && s < end)
      .map(([s, e]): [number, number] => [Math.max(s, start) - start, Math.min(e, end) - start]),
  };
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}
