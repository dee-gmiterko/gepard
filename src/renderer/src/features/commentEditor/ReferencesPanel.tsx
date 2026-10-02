import type { ReactNode } from 'react';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import { Accordion } from '../../components/Accordion';
import { Checkbox } from '../../components/Checkbox';
import { Stack } from '../../components/Layout';
import { PathLabel } from '../../components/PathLabel';
import { MatchLine } from '../../components/MatchLine';
import { Message } from '../../components/Message';
import { ScopeToggle } from '../../components/ScopeToggle';
import type { SearchScope } from '@gepard/common';
import { Select } from '../../components/Select';
import { SymbolDefinitionSection, type LineSymbol } from './SymbolDefinitionSection';
import { toggleRefIn, type ReferenceChoices } from '../../helpers/reference';
import type { CommentReference, GroupedResult } from '@gepard/common';
import type { RefAnchor } from '../../helpers/anchor';
import type { ExactDisabledReason } from './useDerivedReferences';

const messages = defineMessages({
  searching: {
    id: 'commentEditor.referencesPanel.searching',
    defaultMessage: 'Searching…',
  },
  noMatches: {
    id: 'commentEditor.referencesPanel.noMatches',
    defaultMessage: 'No matches — nothing will be included.',
  },
  alsoIn: {
    id: 'commentEditor.referencesPanel.alsoIn',
    defaultMessage: 'Also in',
  },
  samePatternIn: {
    id: 'commentEditor.referencesPanel.samePatternIn',
    defaultMessage: 'Same pattern in',
  },
  truncated: {
    id: 'commentEditor.referencesPanel.truncated',
    defaultMessage: 'Too many matches: only the first ones are shown and included.',
  },
});

interface SearchRefsSectionProps {
  title: MessageDescriptor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  scope: SearchScope;
  onScopeChange: (scope: SearchScope) => void;
  data: GroupedResult | undefined;
  isFetching: boolean;
  extra?: ReactNode;
}

function SearchRefsSection({
  title,
  open,
  onOpenChange,
  disabled,
  scope,
  onScopeChange,
  data,
  isFetching,
  extra,
}: SearchRefsSectionProps): React.JSX.Element {
  const intl = useIntl();

  return (
    <Accordion
      open={open}
      disabled={disabled}
      onToggle={() => onOpenChange(!open)}
      leading={
        <Checkbox
          checked={open}
          disabled={disabled}
          ariaLabel={intl.formatMessage(title)}
          onChange={() => onOpenChange(!open)}
        />
      }
      title={<FormattedMessage {...title} />}
    >
      <Stack>
        <ScopeToggle value={scope} onChange={onScopeChange} />
        {extra}
        {isFetching && (
          <Message layout="inline">
            <FormattedMessage {...messages.searching} />
          </Message>
        )}
        {data && data.files.length === 0 && (
          <Message layout="inline">
            <FormattedMessage {...messages.noMatches} />
          </Message>
        )}
        {data?.files.map((f) => (
          <div key={f.path}>
            <PathLabel $small>{f.path}</PathLabel>
            {f.matches.map((m) => (
              <MatchLine key={m.line} line={m.line} preview={m.preview} spans={m.spans} />
            ))}
          </div>
        ))}
        {data?.truncated && (
          <Message layout="inline">
            <FormattedMessage {...messages.truncated} />
          </Message>
        )}
      </Stack>
    </Accordion>
  );
}

interface ReferencesPanelProps {
  refAnchor: RefAnchor | null;
  choices: ReferenceChoices;
  onChoicesChange: React.Dispatch<React.SetStateAction<ReferenceChoices>>;
  symbols: LineSymbol[];
  symbolsLoading: boolean;
  symbolDisabled: boolean;
  exactDisabled: ExactDisabledReason | null;
  exactData: GroupedResult | undefined;
  exactFetching: boolean;
  patternDisabled: boolean;
  patternData: GroupedResult | undefined;
  patternFetching: boolean;
  effectivePatternSymbol: string;
}

export function ReferencesPanel({
  refAnchor,
  choices,
  onChoicesChange,
  symbols,
  symbolsLoading,
  symbolDisabled,
  exactDisabled,
  exactData,
  exactFetching,
  patternDisabled,
  patternData,
  patternFetching,
  effectivePatternSymbol,
}: ReferencesPanelProps): React.JSX.Element | null {
  function toggleSymbolRef(symbolRef: CommentReference): void {
    onChoicesChange((prev) => ({ ...prev, symbols: toggleRefIn(prev.symbols, symbolRef) }));
  }

  function setSymbolOpen(open: boolean): void {
    onChoicesChange((prev) =>
      open ? { ...prev, symbolOpen: true } : { ...prev, symbolOpen: false, symbols: [] },
    );
  }
  function setExactOpen(open: boolean): void {
    onChoicesChange((prev) => ({ ...prev, exactOpen: open }));
  }
  function setPatternOpen(open: boolean): void {
    onChoicesChange((prev) => ({ ...prev, patternOpen: open }));
  }
  function setExactScope(scope: SearchScope): void {
    onChoicesChange((prev) => ({ ...prev, exactScope: scope }));
  }
  function setPatternScope(scope: SearchScope): void {
    onChoicesChange((prev) => ({ ...prev, patternScope: scope }));
  }
  function setPatternSymbol(symbol: string): void {
    onChoicesChange((prev) => ({ ...prev, patternSymbol: symbol }));
  }

  if (!refAnchor) {
    return null;
  }

  return (
    <Stack>
      <SymbolDefinitionSection
        refAnchor={refAnchor}
        symbols={symbols}
        loading={symbolsLoading}
        disabled={symbolDisabled}
        selected={choices.symbols}
        onToggleRef={toggleSymbolRef}
        open={choices.symbolOpen}
        onOpenChange={setSymbolOpen}
      />

      <SearchRefsSection
        title={messages.alsoIn}
        open={choices.exactOpen}
        onOpenChange={setExactOpen}
        disabled={exactDisabled !== null}
        scope={choices.exactScope}
        onScopeChange={setExactScope}
        data={exactData}
        isFetching={exactFetching}
      />

      <SearchRefsSection
        title={messages.samePatternIn}
        open={choices.patternOpen}
        onOpenChange={setPatternOpen}
        disabled={patternDisabled}
        scope={choices.patternScope}
        onScopeChange={setPatternScope}
        data={patternData}
        isFetching={patternFetching}
        extra={
          symbols.length > 1 ? (
            <Select
              value={effectivePatternSymbol}
              onChange={(e) => setPatternSymbol(e.target.value)}
            >
              {symbols.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </Select>
          ) : undefined
        }
      />
    </Stack>
  );
}
