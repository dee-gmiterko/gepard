import { useCallback, useMemo, useState } from 'react';
import { GitCommit } from 'react-feather';
import { defineMessages, useIntl } from 'react-intl';
import { Combobox } from '../../components/Combobox';
import { IconField } from '../../components/IconField';
import { usePrCommits, useCommits } from '../../queries/prs';
import { unionByKey } from '../../helpers/array';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useTargeting } from '../../state/hooks';
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
  const targeting = useTargeting();
  const { setCommit } = useTargetActions();
  const usingPr = targeting.pr !== null;

  const [queryText, setQueryText] = useState('');
  const [picked, setPicked] = useState<Commit | null>(null);
  const debouncedQuery = useDebouncedValue(queryText);

  const prCommits = usePrCommits();
  const repoCommits = useCommits();
  // pr.commits has no server search, so this only applies when browsing the full repo.
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
      targeting.commit === null
        ? null
        : (items.find((c) => c.oid === targeting.commit) ??
          (picked?.oid === targeting.commit ? picked : null)),
    [targeting.commit, items, picked],
  );

  const unresolvedLabel =
    value === null && targeting.commit !== null ? targeting.commit.slice(0, 7) : undefined;

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
        onSelect={(commit) => {
          setPicked(commit);
          setCommit(commit?.oid ?? null);
        }}
      />
    </IconField>
  );
}
