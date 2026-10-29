import { RuleType, type MarkdownToJSX } from 'markdown-to-jsx/react';
import { MermaidBlock } from './MermaidBlock';

export const renderRule: MarkdownToJSX.Options['renderRule'] = (next, node, _render, state) => {
  if (node.type === RuleType.codeBlock && node.lang?.trim().toLowerCase() === 'mermaid') {
    return <MermaidBlock key={state.key} source={node.text} />;
  }
  return next();
};
