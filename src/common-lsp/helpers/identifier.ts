export interface IdentifierSyntax {
  keywords: ReadonlySet<string>;
  lineComment: string;
  // Identifiers right after this character are skipped, e.g. GDScript node paths after $.
  skipAfter?: string;
}

export interface LineIdentifier {
  name: string;
  col0: number;
}

function maskStringsAndComments(line: string, lineComment: string): string {
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
    } else if (line.startsWith(lineComment, i)) {
      for (let j = i; j < out.length; j++) out[j] = ' ';
      break;
    }
  }
  return out.join('');
}

export function identifiersOn(line: string, syntax: IdentifierSyntax): LineIdentifier[] {
  const masked = maskStringsAndComments(line, syntax.lineComment);
  const out: LineIdentifier[] = [];
  for (const m of masked.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
    if (syntax.keywords.has(m[0])) continue;
    if (syntax.skipAfter && m.index > 0 && masked[m.index - 1] === syntax.skipAfter) continue;
    // A name directly before a quote is a string prefix such as f or b.
    const next = line[m.index + m[0].length];
    if (next === '"' || next === "'") continue;
    out.push({ name: m[0], col0: m.index });
  }
  return out;
}
