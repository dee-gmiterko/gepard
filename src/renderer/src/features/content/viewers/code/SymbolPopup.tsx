import { useMemo, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import { defineMessages, FormattedMessage } from 'react-intl';
import type {
  SymbolPopupEntry,
  SymbolPortals,
} from '../../../../components/CodeEditor/symbolTooltip';
import { Caption } from '../../../../components/Caption';
import { MatchLine } from '../../../../components/MatchLine';
import { Message } from '../../../../components/Message';
import { PathAndLine } from '../../../../components/PathAndLine';
import { PathLabel } from '../../../../components/PathLabel';
import { useFileContent } from '../../../../queries/files';
import { useSearch, type SearchParams } from '../../../../queries/search';

const messages = defineMessages({
  definition: {
    id: 'codeViewer.symbolPopup.definition',
    defaultMessage: 'Definition',
  },
  externalDefinition: {
    id: 'codeViewer.symbolPopup.externalDefinition',
    defaultMessage: 'Defined outside this repository',
  },
  references: {
    id: 'codeViewer.symbolPopup.references',
    defaultMessage: 'References',
  },
  loading: {
    id: 'codeViewer.symbolPopup.loading',
    defaultMessage: 'Loading…',
  },
  noReferences: {
    id: 'codeViewer.symbolPopup.noReferences',
    defaultMessage: 'No references found.',
  },
  moreReferences: {
    id: 'codeViewer.symbolPopup.moreReferences',
    defaultMessage: 'Only the first references are shown.',
  },
});

const REFERENCE_FILES = 12;
const REFERENCES_PER_FILE = 6;

const Popup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[2]};
  min-width: 240px;
  max-width: 480px;
  max-height: 320px;
  overflow: auto;
  padding: ${({ theme }) => theme.space[2]};
`;

const Name = styled.div`
  font-family: ${({ theme }) => theme.font.mono};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.fg};
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const Row = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.space[2]};
  min-width: 0;
  padding: 2px ${({ theme }) => theme.space[1]};
  border-radius: ${({ theme }) => theme.radius.sm};
  cursor: pointer;

  &:hover,
  &:focus-visible {
    background: ${({ theme }) => theme.colors.bgHover};
    outline: none;
  }
`;

const DefinitionEntry = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`;

const FilePath = styled(PathLabel)`
  padding: ${({ theme }) => theme.space[1]} ${({ theme }) => theme.space[1]} 0;
  font-size: ${({ theme }) => theme.font.size.xs};
`;

function Link({
  onActivate,
  children,
}: {
  onActivate: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Row
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        onActivate();
      }}
    >
      {children}
    </Row>
  );
}

function DefinitionPreview({
  sha,
  path,
  line,
}: {
  sha: string;
  path: string;
  line: number;
}): React.JSX.Element | null {
  const content = useFileContent(sha, path);
  if (content.data?.kind !== 'text') return null;
  const preview = content.data.text.split(/\r?\n/)[line - 1];
  if (preview === undefined) return null;
  return <MatchLine line={line} preview={preview} spans={[]} />;
}

function SymbolPopup({
  sha,
  path,
  entry,
  onOpen,
}: {
  sha: string;
  path: string;
  entry: SymbolPopupEntry;
  onOpen: (path: string, line: number) => void;
}): React.JSX.Element {
  const { symbol, definitions } = entry;
  const internal = definitions.filter((d) => !d.external);
  const params = useMemo<SearchParams>(
    () => ({
      kind: 'references',
      scope: 'all',
      targetedPaths: [],
      text: symbol.name,
      at: { path, pos: { line: symbol.line, col: symbol.col } },
      limit: REFERENCE_FILES,
      maxMatchesPerFile: REFERENCES_PER_FILE,
    }),
    [path, symbol],
  );
  const references = useSearch(sha, params);
  const files = references.data?.files ?? [];
  const partial =
    references.data?.hasMore || references.data?.truncated || files.some((f) => f.moreMatches);

  return (
    <Popup>
      <Name>{symbol.name}</Name>
      <Section>
        <Caption>
          <FormattedMessage {...messages.definition} />
        </Caption>
        {internal.map((d, i) => (
          <Link key={i} onActivate={() => onOpen(d.location.path, d.location.range.start.line)}>
            <DefinitionEntry>
              <PathAndLine path={d.location.path} line={d.location.range.start.line} />
              <DefinitionPreview
                sha={sha}
                path={d.location.path}
                line={d.location.range.start.line}
              />
            </DefinitionEntry>
          </Link>
        ))}
        {internal.length === 0 && (
          <Message layout="inline" tone="subtle">
            <FormattedMessage {...messages.externalDefinition} />
          </Message>
        )}
      </Section>
      <Section>
        <Caption>
          <FormattedMessage {...messages.references} />
        </Caption>
        {references.isFetching && !references.data && (
          <Message layout="inline" tone="subtle">
            <FormattedMessage {...messages.loading} />
          </Message>
        )}
        {references.data && files.length === 0 && (
          <Message layout="inline" tone="subtle">
            <FormattedMessage {...messages.noReferences} />
          </Message>
        )}
        {files.map((file) => (
          <Section key={file.path}>
            <FilePath title={file.path}>{file.path}</FilePath>
            {file.matches.map((m) => (
              <Link key={m.line} onActivate={() => onOpen(file.path, m.line)}>
                <MatchLine line={m.line} preview={m.preview} spans={m.spans} />
              </Link>
            ))}
          </Section>
        ))}
        {partial && (
          <Message layout="inline" tone="subtle">
            <FormattedMessage {...messages.moreReferences} />
          </Message>
        )}
      </Section>
    </Popup>
  );
}

export function SymbolPopupHost({
  portals,
  sha,
  path,
  onOpen,
}: {
  portals: SymbolPortals;
  sha: string;
  path: string;
  onOpen: (path: string, line: number) => void;
}): React.JSX.Element | null {
  const portal = useSyncExternalStore(portals.subscribe, portals.getSnapshot);
  if (!portal) return null;
  return createPortal(
    <SymbolPopup sha={sha} path={path} entry={portal.entry} onOpen={onOpen} />,
    portal.dom,
    String(portal.key),
  );
}
