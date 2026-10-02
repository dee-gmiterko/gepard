import { useMemo } from 'react';
import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import { useAppDispatch } from '../../../state/AppContext';
import { useCurrentHead } from '../../../queries/projects';
import { useDocumentSymbols } from '../../../queries/search';
import { Tree, TreeLabel } from '../../../components/Tree';
import type { TreeNode } from '../../../helpers/tree';
import { Caption } from '../../../components/Caption';
import { Message } from '../../../components/Message';
import type { DocumentSymbol } from '@gepard/common';

type SymbolKind = DocumentSymbol['kind'];

const messages = defineMessages({
  title: {
    id: 'content.symbolsTree.title',
    defaultMessage: 'Symbols',
  },
  loading: {
    id: 'content.symbolsTree.loading',
    defaultMessage: 'Loading symbols…',
  },
  empty: {
    id: 'content.symbolsTree.empty',
    defaultMessage: 'No symbols in this file.',
  },
  kindNamespace: { id: 'content.symbolsTree.kind.namespace', defaultMessage: 'namespace' },
  kindClass: { id: 'content.symbolsTree.kind.class', defaultMessage: 'class' },
  kindInterface: { id: 'content.symbolsTree.kind.interface', defaultMessage: 'interface' },
  kindEnum: { id: 'content.symbolsTree.kind.enum', defaultMessage: 'enum' },
  kindEnumMember: { id: 'content.symbolsTree.kind.enumMember', defaultMessage: 'enum member' },
  kindType: { id: 'content.symbolsTree.kind.type', defaultMessage: 'type' },
  kindTypeParameter: {
    id: 'content.symbolsTree.kind.typeParameter',
    defaultMessage: 'type parameter',
  },
  kindFunction: { id: 'content.symbolsTree.kind.function', defaultMessage: 'function' },
  kindMethod: { id: 'content.symbolsTree.kind.method', defaultMessage: 'method' },
  kindProperty: { id: 'content.symbolsTree.kind.property', defaultMessage: 'property' },
  kindVariable: { id: 'content.symbolsTree.kind.variable', defaultMessage: 'variable' },
  kindParameter: { id: 'content.symbolsTree.kind.parameter', defaultMessage: 'parameter' },
  kindConstant: { id: 'content.symbolsTree.kind.constant', defaultMessage: 'constant' },
  kindUnknown: { id: 'content.symbolsTree.kind.unknown', defaultMessage: 'unknown' },
});

const kindMessages: Record<SymbolKind, MessageDescriptor> = {
  namespace: messages.kindNamespace,
  class: messages.kindClass,
  interface: messages.kindInterface,
  enum: messages.kindEnum,
  enumMember: messages.kindEnumMember,
  type: messages.kindType,
  typeParameter: messages.kindTypeParameter,
  function: messages.kindFunction,
  method: messages.kindMethod,
  property: messages.kindProperty,
  variable: messages.kindVariable,
  parameter: messages.kindParameter,
  constant: messages.kindConstant,
  unknown: messages.kindUnknown,
};

interface SymbolRowData {
  kind: SymbolKind;
  line: number;
}

const Section = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const SectionTitle = styled.div`
  flex-shrink: 0;
  padding: ${({ theme }) => theme.space[2]} ${({ theme }) => theme.space[3]};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.fg};
`;

const TreeBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
`;

function toNodes(symbols: DocumentSymbol[], parentPath: string): TreeNode<SymbolRowData>[] {
  return symbols.map((s, i) => {
    const path = `${parentPath}/${i}:${s.name}`;
    return {
      path,
      name: s.name,
      isFolder: false,
      data: { kind: s.kind, line: s.selectionRange.start.line },
      children: toNodes(s.children, path),
    };
  });
}

export function SymbolsTree({ path }: { path: string }): React.JSX.Element {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const sha = useCurrentHead() ?? '';
  const { data, isLoading, isFetching } = useDocumentSymbols(sha, path);

  const nodes = useMemo(() => toNodes(data?.symbols ?? [], path), [data, path]);
  const empty = !isLoading && nodes.length === 0;

  return (
    <Section>
      <SectionTitle>
        <FormattedMessage {...messages.title} />
      </SectionTitle>
      <TreeBody>
        {isLoading || (isFetching && nodes.length === 0) ? (
          <Message>
            <FormattedMessage {...messages.loading} />
          </Message>
        ) : empty ? (
          <Message>
            <FormattedMessage {...messages.empty} />
          </Message>
        ) : (
          <Tree<SymbolRowData>
            nodes={nodes}
            isSelected={() => false}
            onSelectFile={(node) => {
              if (!node.data) return;
              dispatch({ type: 'file/open', path, line: node.data.line });
            }}
            renderFile={(node) => (
              <>
                <TreeLabel title={node.name}>{node.name}</TreeLabel>
                {node.data && <Caption>{intl.formatMessage(kindMessages[node.data.kind])}</Caption>}
              </>
            )}
          />
        )}
      </TreeBody>
    </Section>
  );
}
