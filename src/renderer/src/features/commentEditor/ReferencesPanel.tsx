import type { ReactNode } from 'react';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import { Accordion } from '../../components/Accordion';
import { Checkbox } from '../../components/Checkbox';
import { Stack } from '../../components/Layout';
import { PathLabel } from '../../components/PathLabel';
import { MatchLine } from '../../components/MatchLine';
import { Message } from '../../components/Message';
import { ScopeToggle, type SearchScope } from '../../components/ScopeToggle';
import { Select } from '../../components/Select';
import { SymbolDefinitionSection, type LineSymbol } from './SymbolDefinitionSection';
import { toggleRefIn } from './refs';
import type { CommentReference } from '@shared/ipc/schemas/comment';
import type { GroupedResult } from '@shared/ipc/schemas/search';
import type { RefAnchor } from './anchorLine';
import type { ReferenceChoices } from './referenceChoices';

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
  alsoInDisabledHint: {
    id: 'commentEditor.referencesPanel.alsoInDisabledHint',
    defaultMessage: 'This line has no text to match elsewhere.',
  },
  samePatternIn: {
    id: 'commentEditor.referencesPanel.samePatternIn',
    defaultMessage: 'Same pattern in',
  },
  samePatternDisabledHint: {
    id: 'commentEditor.referencesPanel.samePatternDisabledHint',
    defaultMessage: 'No symbols on this line to match a pattern on.',
  },
  noAnchor: {
    id: 'commentEditor.referencesPanel.noAnchor',
    defaultMessage: 'References are not available for this comment (no anchor line).',
  },
});

interface SearchRefsSectionProps {
  title: MessageDescriptor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  disabledHint?: MessageDescriptor;
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
  disabledHint,
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
      trailing={
        disabled && disabledHint ? (
          <Message layout="inline">
            <FormattedMessage {...disabledHint} />
          </Message>
        ) : undefined
      }
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
  symbolsError: Error | null;
  exactDisabled: boolean;
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
  symbolsError,
  exactDisabled,
  exactData,
  exactFetching,
  patternDisabled,
  patternData,
  patternFetching,
  effectivePatternSymbol,
}: ReferencesPanelProps): React.JSX.Element {
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
    return (
      <Message layout="inline">
        <FormattedMessage {...messages.noAnchor} />
      </Message>
    );
  }

  return (
    <Stack>
      <SymbolDefinitionSection
        refAnchor={refAnchor}
        symbols={symbols}
        loading={symbolsLoading}
        error={symbolsError}
        selected={choices.symbols}
        onToggleRef={toggleSymbolRef}
        open={choices.symbolOpen}
        onOpenChange={setSymbolOpen}
      />

      <SearchRefsSection
        title={messages.alsoIn}
        open={choices.exactOpen}
        onOpenChange={setExactOpen}
        disabled={exactDisabled}
        disabledHint={messages.alsoInDisabledHint}
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
        disabledHint={messages.samePatternDisabledHint}
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
