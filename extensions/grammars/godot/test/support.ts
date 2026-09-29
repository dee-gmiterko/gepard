import { StreamLanguage, type StreamParser } from '@codemirror/language';
import { highlightTree, tagHighlighter, tags as t } from '@lezer/highlight';

const highlighter = tagHighlighter([
  { tag: t.comment, class: 'comment' },
  { tag: t.special(t.string), class: 'string.special' },
  { tag: t.string, class: 'string' },
  { tag: t.number, class: 'number' },
  { tag: t.bool, class: 'bool' },
  { tag: t.null, class: 'null' },
  { tag: t.atom, class: 'atom' },
  { tag: t.controlKeyword, class: 'controlKeyword' },
  { tag: t.definitionKeyword, class: 'definitionKeyword' },
  { tag: t.operatorKeyword, class: 'operatorKeyword' },
  { tag: t.keyword, class: 'keyword' },
  { tag: t.className, class: 'className' },
  { tag: t.typeName, class: 'typeName' },
  { tag: t.function(t.propertyName), class: 'method' },
  { tag: t.propertyName, class: 'propertyName' },
  { tag: t.function(t.variableName), class: 'function' },
  { tag: t.constant(t.variableName), class: 'constant' },
  { tag: t.variableName, class: 'variableName' },
  { tag: t.attributeName, class: 'attributeName' },
  { tag: t.operator, class: 'operator' },
]);

export type Token = [text: string, cls: string];

export function tokenize<S>(parser: StreamParser<S>, text: string): Token[] {
  const language = StreamLanguage.define(parser);
  const tree = language.parser.parse(text);
  const out: Token[] = [];
  highlightTree(tree, highlighter, (from, to, cls) => out.push([text.slice(from, to), cls]));
  return out;
}

export function classOf(tokens: Token[], text: string, nth = 0): string | undefined {
  return tokens.filter(([tok]) => tok === text)[nth]?.[1];
}
