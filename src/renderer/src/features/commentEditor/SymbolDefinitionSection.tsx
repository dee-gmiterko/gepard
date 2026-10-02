import styled from 'styled-components';
import { useState } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { Accordion } from '../../components/Accordion';
import { Checkbox } from '../../components/Checkbox';
import { Inline, Stack } from '../../components/Layout';
import { PathAndLine } from '../../components/PathAndLine';
import { Message } from '../../components/Message';
import { ScopeToggle, type SearchScope } from '../../components/ScopeToggle';
import { useDefinition } from '../../queries/search';
import { useTargetedFiles } from '../../queries/files';
import { sameRef } from '../../helpers/reference';
import { isTargeted, type CommentReference, type LineSymbolsResult } from '@gepard/common';
import type { RefAnchor } from '../../helpers/anchor';

export type LineSymbol = LineSymbolsResult['symbols'][number];

const messages = defineMessages({
  title: {
    id: 'commentEditor.symbolDefinition.title',
    defaultMessage: 'Symbol definition',
  },
  resolving: {
    id: 'commentEditor.symbolDefinition.resolving',
    defaultMessage: '{name}…',
  },
  loading: {
    id: 'commentEditor.symbolDefinition.loading',
    defaultMessage: 'Loading symbols…',
  },
  empty: {
    id: 'commentEditor.symbolDefinition.empty',
    defaultMessage: 'No symbols on this line.',
  },
  addReference: {
    id: 'commentEditor.symbolDefinition.addReference',
    defaultMessage: 'Add {symbol} reference at {path}:{line}',
  },
});

const SymbolName = styled.span`
  font-family: ${({ theme }) => theme.font.mono};
  color: ${({ theme }) => theme.colors.fg};
  flex-shrink: 0;
`;

function DefinitionRow({
  refAnchor,
  symbol,
  scope,
  selected,
  onToggleRef,
}: {
  refAnchor: RefAnchor;
  symbol: LineSymbol;
  scope: SearchScope;
  selected: CommentReference[];
  onToggleRef: (ref: CommentReference) => void;
}): React.JSX.Element | null {
  const intl = useIntl();
  const targetedPaths = useTargetedFiles();
  const pos = { line: symbol.range.start.line, col: symbol.range.start.col };
  const { data, isFetching } = useDefinition(refAnchor.sha, refAnchor.path, pos);

  if (isFetching)
    return (
      <Message layout="inline">
        <FormattedMessage {...messages.resolving} values={{ name: symbol.name }} />
      </Message>
    );

  const targets = (data?.definitions ?? []).filter(
    (d) =>
      !d.external &&
      !(d.location.path === refAnchor.path && d.location.range.start.line === refAnchor.line) &&
      (scope === 'all' || isTargeted(d.location.path, targetedPaths)),
  );
  if (targets.length === 0) return null;

  return (
    <>
      {targets.map((t, i) => {
        const ref: CommentReference = {
          path: t.location.path,
          line: t.location.range.start.line,
          kind: 'symbol',
        };
        const checked = selected.some((r) => sameRef(r, ref));
        return (
          <Inline key={`${symbol.name}-${i}`}>
            <Checkbox
              checked={checked}
              ariaLabel={intl.formatMessage(messages.addReference, {
                symbol: symbol.name,
                path: t.location.path,
                line: t.location.range.start.line,
              })}
              onChange={() => onToggleRef(ref)}
            />
            <SymbolName>{symbol.name}</SymbolName>
            <PathAndLine path={t.location.path} line={t.location.range.start.line} />
          </Inline>
        );
      })}
    </>
  );
}

export function SymbolDefinitionSection({
  refAnchor,
  symbols,
  loading,
  error,
  selected,
  onToggleRef,
  open,
  onOpenChange,
}: {
  refAnchor: RefAnchor;
  symbols: LineSymbol[];
  loading: boolean;
  error: Error | null;
  selected: CommentReference[];
  onToggleRef: (ref: CommentReference) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): React.JSX.Element {
  const intl = useIntl();
  const [scope, setScope] = useState<SearchScope>('all');
  const empty = !loading && !error && symbols.length === 0;

  return (
    <Accordion
      open={open}
      disabled={empty}
      onToggle={() => onOpenChange(!open)}
      leading={
        <Checkbox
          checked={open}
          disabled={empty}
          ariaLabel={intl.formatMessage(messages.title)}
          onChange={() => onOpenChange(!open)}
        />
      }
      title={<FormattedMessage {...messages.title} />}
      trailing={
        empty ? (
          <Message layout="inline">
            <FormattedMessage {...messages.empty} />
          </Message>
        ) : undefined
      }
    >
      <Stack $gap={1}>
        <ScopeToggle value={scope} onChange={setScope} />
        {loading && (
          <Message layout="inline">
            <FormattedMessage {...messages.loading} />
          </Message>
        )}
        {symbols.map((symbol, i) => (
          <DefinitionRow
            key={`${symbol.name}-${symbol.range.start.line}-${symbol.range.start.col}-${i}`}
            refAnchor={refAnchor}
            symbol={symbol}
            scope={scope}
            selected={selected}
            onToggleRef={onToggleRef}
          />
        ))}
      </Stack>
    </Accordion>
  );
}
