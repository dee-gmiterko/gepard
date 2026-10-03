export interface CodeownersRule {
  pattern: RegExp;
  owners: string[];
}

export const CODEOWNERS_PATHS = ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS'] as const;

function escapeRegex(ch: string): string {
  return /[\\^$.|+(){}[\]]/.test(ch) ? `\\${ch}` : ch;
}

function globToRegex(glob: string): RegExp | null {
  if (glob.startsWith('!') || glob.includes('[')) return null;
  const anchored = glob.startsWith('/') || glob.replace(/\/$/, '').includes('/');
  const body = glob.replace(/^\//, '').replace(/\/$/, '');
  let out = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '*' && body[i + 1] === '*') {
      if (body[i + 2] === '/') {
        out += '(?:.*/)?';
        i += 2;
      } else {
        out += '.*';
        i += 1;
      }
    } else if (ch === '*') out += '[^/]*';
    else if (ch === '?') out += '[^/]';
    else out += escapeRegex(ch);
  }
  return new RegExp(`^${anchored ? '' : '(?:.*/)?'}${out}(?:/.*)?$`);
}

export function parseCodeowners(text: string): CodeownersRule[] {
  const rules: CodeownersRule[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/(^|\s)#.*$/, '').trim();
    if (!line) continue;
    const [glob, ...owners] = line.split(/\s+/);
    const pattern = globToRegex(glob);
    if (pattern) rules.push({ pattern, owners });
  }
  return rules;
}

export function ownersOf(rules: readonly CodeownersRule[], path: string): string[] {
  for (let i = rules.length - 1; i >= 0; i--) {
    if (rules[i].pattern.test(path)) return rules[i].owners;
  }
  return [];
}
