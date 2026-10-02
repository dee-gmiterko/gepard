import { useCallback, useMemo, useState } from 'react';
import { GitCommit } from 'react-feather';
import { defineMessages, useIntl } from 'react-intl';
import { Combobox } from '../../components/Combobox';
import { IconField } from '../../components/IconField';
import { usePrCommits, useCommits } from '../../queries/prs';
import { unionByKey } from '../../helpers/array';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useAppState } from '../../state/AppContext';
import { useTargetActions } from './useTargetActions';
import type { Commit } from '@gepard/common';

const messages = defineMessages({
  placeholder: {
    id: 'header.commitTarget.placeholder',
    defaultMessage: 'Commit…',
  },
  commitLabel: {
    id: 'header.commitTarget.commitLabel',
    defaultMessage: '{sha} {headline}',
  },
});

export function CommitTarget(): React.JSX.Element {
  const intl = useIntl();
  const state = useAppState();
  const { setCommit } = useTargetActions();
  const usingPr = state.targeting.pr !== null;

  const [queryText, setQueryText] = useState('');
  const debouncedQuery = useDebouncedValue(queryText);

  const prCommits = usePrCommits();
  const repoCommits = useCommits();
  // The fetched page only covers the repo's first commits; widen the
  // candidate set with a server search for the typed text (pr.commits has no
  // server search, so this only applies when browsing the full repo).
  const repoCommitsSearch = useCommits(debouncedQuery || undefined);

  const items = useMemo(
    () =>
      usingPr
        ? (prCommits.data ?? [])
        : unionByKey(repoCommits.data ?? [], repoCommitsSearch.data ?? [], (c) => c.oid),
    [usingPr, prCommits.data, repoCommits.data, repoCommitsSearch.data],
  );
  const isFetching = usingPr
    ? prCommits.isFetching
    : repoCommits.isFetching || repoCommitsSearch.isFetching;

  const getCommitLabel = useCallback(
    (commit: Commit) =>
      intl.formatMessage(messages.commitLabel, {
        sha: commit.oid.slice(0, 7),
        headline: commit.messageHeadline,
      }),
    [intl],
  );

  const value = useMemo(
    () =>
      state.targeting.commit === null
        ? null
        : (items.find((c) => c.oid === state.targeting.commit) ?? null),
    [state.targeting.commit, items],
  );

  const unresolvedLabel =
    value === null && state.targeting.commit !== null
      ? state.targeting.commit.slice(0, 7)
      : undefined;

  return (
    <IconField icon={GitCommit}>
      <Combobox<Commit>
        items={items}
        value={value}
        getKey={(c) => c.oid}
        getLabel={getCommitLabel}
        loading={isFetching}
        placeholder={intl.formatMessage(messages.placeholder)}
        unresolvedLabel={unresolvedLabel}
        onQueryChange={setQueryText}
        onSelect={(commit) => setCommit(commit?.oid ?? null)}
      />
    </IconField>
  );
}
