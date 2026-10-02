const GD_KEYWORDS = new Set([
  'and',
  'as',
  'assert',
  'await',
  'break',
  'breakpoint',
  'class',
  'class_name',
  'const',
  'continue',
  'elif',
  'else',
  'enum',
  'extends',
  'false',
  'for',
  'func',
  'if',
  'in',
  'is',
  'match',
  'not',
  'null',
  'or',
  'pass',
  'preload',
  'return',
  'self',
  'signal',
  'static',
  'super',
  'true',
  'var',
  'void',
  'when',
  'while',
  'yield',
  'INF',
  'NAN',
  'PI',
  'TAU',
]);

function maskStringsAndComments(line: string): string {
  const out = line.split('');
  let quote: string | null = null;
  for (let i = 0; i < out.length; i++) {
    const ch = out[i];
    if (quote) {
      if (ch === '\\' && i + 1 < out.length) {
        out[i] = ' ';
        out[++i] = ' ';
        continue;
      }
      if (ch === quote) quote = null;
      out[i] = ' ';
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      out[i] = ' ';
    } else if (ch === '#') {
      for (let j = i; j < out.length; j++) out[j] = ' ';
      break;
    }
  }
  return out.join('');
}

export function identifiersOn(line: string): Array<{ name: string; col0: number }> {
  const masked = maskStringsAndComments(line);
  const out: Array<{ name: string; col0: number }> = [];
  for (const m of masked.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
    if (GD_KEYWORDS.has(m[0])) continue;
    if (m.index > 0 && masked[m.index - 1] === '$') continue;
    out.push({ name: m[0], col0: m.index });
  }
  return out;
}
