import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { Accordion } from '../../components/Accordion';
import { Checkbox } from '../../components/Checkbox';
import { Stack } from '../../components/Layout';
import { PathLabel } from '../../components/PathLabel';
import { MatchLine } from '../../components/MatchLine';
import { Message } from '../../components/Message';
import { ScopeToggle } from '../../components/ScopeToggle';
import type { SearchScope } from '@gepard/common';
import { SymbolDefinitionSection, type LineSymbol } from './SymbolDefinitionSection';
import {
  isPatternOpen,
  patternScopeOf,
  toggleRefIn,
  type ReferenceChoices,
} from '../../helpers/reference';
import type { CommentReference, GroupedResult } from '@gepard/common';
import type { RefAnchor } from '../../helpers/anchor';
import type { ExactDisabledReason, PatternView } from './useDerivedReferences';

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
    defaultMessage: 'Same pattern <small>{pattern}</small> in:',
  },
  truncated: {
    id: 'commentEditor.referencesPanel.truncated',
    defaultMessage: 'Too many matches: only the first ones are shown and included.',
  },
});

const MAX_LIST_HEIGHT = '240px';

const ScrollList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
  max-height: ${MAX_LIST_HEIGHT};
  overflow: auto;
`;

const PatternText = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ${({ theme }) => theme.font.mono};
`;

interface SearchRefsSectionProps {
  title: React.ReactNode;
  ariaLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: SearchScope;
  onScopeChange: (scope: SearchScope) => void;
  data: GroupedResult | undefined;
  isFetching: boolean;
}

function SearchRefsSection({
  title,
  ariaLabel,
  open,
  onOpenChange,
  scope,
  onScopeChange,
  data,
  isFetching,
}: SearchRefsSectionProps): React.JSX.Element {
  return (
    <Accordion
      open={open}
      onToggle={() => onOpenChange(!open)}
      leading={
        <Checkbox checked={open} ariaLabel={ariaLabel} onChange={() => onOpenChange(!open)} />
      }
      title={title}
    >
      <Stack>
        <ScopeToggle value={scope} onChange={onScopeChange} />
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
        {data && data.files.length > 0 && (
          <ScrollList>
            {data.files.map((f) => (
              <div key={f.path}>
                <PathLabel $small>{f.path}</PathLabel>
                {f.matches.map((m) => (
                  <MatchLine key={m.line} line={m.line} preview={m.preview} spans={m.spans} />
                ))}
              </div>
            ))}
          </ScrollList>
        )}
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
  patterns: PatternView[];
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
  patterns,
}: ReferencesPanelProps): React.JSX.Element | null {
  const intl = useIntl();
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
  function setPatternOpen(id: string, open: boolean): void {
    onChoicesChange((prev) => ({
      ...prev,
      patterns: { ...prev.patterns, [id]: { ...prev.patterns[id], open } },
    }));
  }
  function setExactScope(scope: SearchScope): void {
    onChoicesChange((prev) => ({ ...prev, exactScope: scope }));
  }
  function setPatternScope(id: string, scope: SearchScope): void {
    onChoicesChange((prev) => ({
      ...prev,
      patterns: { ...prev.patterns, [id]: { ...prev.patterns[id], scope } },
    }));
  }

  if (!refAnchor) {
    return null;
  }

  return (
    <Stack>
      {!symbolDisabled && (
        <SymbolDefinitionSection
          refAnchor={refAnchor}
          symbols={symbols}
          loading={symbolsLoading}
          disabled={false}
          selected={choices.symbols}
          onToggleRef={toggleSymbolRef}
          open={choices.symbolOpen}
          onOpenChange={setSymbolOpen}
        />
      )}

      {exactDisabled === null && (
        <SearchRefsSection
          title={<FormattedMessage {...messages.alsoIn} />}
          ariaLabel={intl.formatMessage(messages.alsoIn)}
          open={choices.exactOpen}
          onOpenChange={setExactOpen}
          scope={choices.exactScope}
          onScopeChange={setExactScope}
          data={exactData}
          isFetching={exactFetching}
        />
      )}

      {patterns.map((p) => (
        <SearchRefsSection
          key={p.id}
          title={
            <FormattedMessage
              {...messages.samePatternIn}
              values={{
                pattern: p.display,
                small: (chunks) => <PatternText>{chunks}</PatternText>,
              }}
            />
          }
          ariaLabel={p.display}
          open={isPatternOpen(choices, p.id)}
          onOpenChange={(open) => setPatternOpen(p.id, open)}
          scope={patternScopeOf(choices, p.id)}
          onScopeChange={(scope) => setPatternScope(p.id, scope)}
          data={p.data}
          isFetching={p.fetching}
        />
      ))}
    </Stack>
  );
}
