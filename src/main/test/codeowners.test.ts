import { describe, expect, it } from 'vitest';
import { ownersOf, parseCodeowners } from '../helpers/codeowners';

describe('codeowners', () => {
  const rules = parseCodeowners(`
# comment
* @everyone
*.ts @ts-team   # trailing
/docs/ @docs
src/api/** @api @lead
/README.md
!negated @nobody
`);

  it('lets the last matching rule win', () => {
    expect(ownersOf(rules, 'a.js')).toEqual(['@everyone']);
    expect(ownersOf(rules, 'x/y.ts')).toEqual(['@ts-team']);
    expect(ownersOf(rules, 'src/api/v1/user.ts')).toEqual(['@api', '@lead']);
  });

  it('anchors leading-slash patterns and matches directories', () => {
    expect(ownersOf(rules, 'docs/guide/a.md')).toEqual(['@docs']);
    expect(ownersOf(rules, 'other/docs/a.md')).toEqual(['@everyone']);
  });

  it('treats a rule without owners as unowned and ignores negations', () => {
    expect(ownersOf(rules, 'README.md')).toEqual([]);
    expect(ownersOf(rules, 'negated')).toEqual(['@everyone']);
  });
});
