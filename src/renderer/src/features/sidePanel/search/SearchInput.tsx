import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import type { WorkspaceSymbol } from '@gepard/common';
import { useWorkspaceSymbols } from '../../../queries/search';
import { Combobox } from '../../../components/Combobox';
import { HighlightedText } from '../../../components/HighlightedText';
import { Caption } from '../../../components/Caption';
import { Inline } from '../../../components/Layout';
import { fuzzyRanges } from '../../../helpers/fuzzy';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

type SymbolKind = WorkspaceSymbol['kind'];

const messages = defineMessages({
  placeholder: {
    id: 'sidePanel.search.placeholder',
    defaultMessage: 'Search…',
  },
  symbolKindNamespace: { id: 'sidePanel.search.symbolKind.namespace', defaultMessage: 'namespace' },
  symbolKindClass: { id: 'sidePanel.search.symbolKind.class', defaultMessage: 'class' },
  symbolKindInterface: { id: 'sidePanel.search.symbolKind.interface', defaultMessage: 'interface' },
  symbolKindEnum: { id: 'sidePanel.search.symbolKind.enum', defaultMessage: 'enum' },
  symbolKindEnumMember: {
    id: 'sidePanel.search.symbolKind.enumMember',
    defaultMessage: 'enum member',
  },
  symbolKindType: { id: 'sidePanel.search.symbolKind.type', defaultMessage: 'type' },
  symbolKindTypeParameter: {
    id: 'sidePanel.search.symbolKind.typeParameter',
    defaultMessage: 'type parameter',
  },
  symbolKindFunction: { id: 'sidePanel.search.symbolKind.function', defaultMessage: 'function' },
  symbolKindMethod: { id: 'sidePanel.search.symbolKind.method', defaultMessage: 'method' },
  symbolKindProperty: { id: 'sidePanel.search.symbolKind.property', defaultMessage: 'property' },
  symbolKindVariable: { id: 'sidePanel.search.symbolKind.variable', defaultMessage: 'variable' },
  symbolKindParameter: { id: 'sidePanel.search.symbolKind.parameter', defaultMessage: 'parameter' },
  symbolKindConstant: { id: 'sidePanel.search.symbolKind.constant', defaultMessage: 'constant' },
  symbolKindUnknown: { id: 'sidePanel.search.symbolKind.unknown', defaultMessage: 'unknown' },
});

const symbolKindMessages: Record<SymbolKind, MessageDescriptor> = {
  namespace: messages.symbolKindNamespace,
  class: messages.symbolKindClass,
  interface: messages.symbolKindInterface,
  enum: messages.symbolKindEnum,
  enumMember: messages.symbolKindEnumMember,
  type: messages.symbolKindType,
  typeParameter: messages.symbolKindTypeParameter,
  function: messages.symbolKindFunction,
  method: messages.symbolKindMethod,
  property: messages.symbolKindProperty,
  variable: messages.symbolKindVariable,
  parameter: messages.symbolKindParameter,
  constant: messages.symbolKindConstant,
  unknown: messages.symbolKindUnknown,
};

const InputArea = styled.div`
  padding: ${({ theme }) => theme.space[2]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

interface SearchInputProps {
  onQueryChange: (query: string) => void;
  onPick: (symbol: WorkspaceSymbol) => void;
}

export function SearchInput({ onQueryChange, onPick }: SearchInputProps): React.JSX.Element {
  const intl = useIntl();
  const [text, setText] = useState('');
  const debouncedText = useDebouncedValue(text, 100);
  const suggestions = useWorkspaceSymbols(debouncedText, 8);
  const suggestionList = text.length > 0 ? (suggestions.data ?? []) : [];

  const onQueryChangeRef = useRef(onQueryChange);
  useEffect(() => {
    onQueryChangeRef.current = onQueryChange;
  });
  useEffect(() => {
    onQueryChangeRef.current(debouncedText);
  }, [debouncedText]);

  return (
    <InputArea>
      <Combobox<WorkspaceSymbol>
        items={suggestionList}
        value={null}
        freeText={{ text, onTextChange: setText, searchText: debouncedText }}
        onSelect={(symbol) => {
          if (!symbol) return;
          setText(symbol.name);
          onPick(symbol);
        }}
        getKey={(symbol) =>
          `${symbol.location.path}:${symbol.location.range.start.line}:${symbol.location.range.start.col}`
        }
        getLabel={(symbol) => symbol.name}
        placeholder={intl.formatMessage(messages.placeholder)}
        loading={suggestions.isFetching}
        renderOption={(symbol, { searchText }) => (
          <Inline $gap={1}>
            <span>
              <HighlightedText text={symbol.name} ranges={fuzzyRanges(searchText, symbol.name)} />
            </span>
            <Caption>{intl.formatMessage(symbolKindMessages[symbol.kind])}</Caption>
          </Inline>
        )}
      />
    </InputArea>
  );
}
