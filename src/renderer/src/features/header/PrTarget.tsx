import { useCallback, useMemo, useState } from 'react';
import { GitPullRequest, Plus } from 'react-feather';
import { defineMessages, useIntl } from 'react-intl';
import { Combobox } from '../../components/Combobox';
import { IconButton } from '../../components/IconButton';
import { IconField } from '../../components/IconField';
import { Inline } from '../../components/Layout';
import { usePrList, unionByKey } from '../../queries/prs';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useAppState } from '../../state/AppContext';
import { useTargetActions } from './useTargetActions';
import { NewPrModal } from './NewPrModal';
import type { PrListItem } from '@gepard/common/ipc/schemas/pr';

const messages = defineMessages({
  placeholder: {
    id: 'header.prTarget.placeholder',
    defaultMessage: 'PR…',
  },
  newPullRequest: {
    id: 'header.prTarget.newPullRequest',
    defaultMessage: 'New pull request',
  },
  prLabel: {
    id: 'header.prTarget.prLabel',
    defaultMessage: '#{number} {title}',
  },
  unresolvedPrLabel: {
    id: 'header.prTarget.unresolvedLabel',
    defaultMessage: '#{number}',
  },
});

function prFilterText(pr: PrListItem): string {
  return [
    `#${pr.number}`,
    pr.title,
    pr.author.login,
    pr.headRefName,
    ...pr.labels.map((l) => l.name),
  ].join(' ');
}

export function PrTarget(): React.JSX.Element {
  const intl = useIntl();
  const state = useAppState();
  const { setPr } = useTargetActions();

  const { data: basePrs, isFetching: baseFetching } = usePrList();

  const [queryText, setQueryText] = useState('');
  const debouncedQuery = useDebouncedValue(queryText);
  const { data: searchPrs, isFetching: searchFetching } = usePrList(debouncedQuery || undefined);
  const prs = useMemo(
    () => unionByKey(basePrs ?? [], searchPrs ?? [], (pr) => String(pr.number)),
    [basePrs, searchPrs],
  );
  const isFetching = baseFetching || searchFetching;

  const [newPrOpen, setNewPrOpen] = useState(false);

  const getPrLabel = useCallback(
    (pr: PrListItem) =>
      intl.formatMessage(messages.prLabel, { number: pr.number, title: pr.title }),
    [intl],
  );

  const value = useMemo(
    () =>
      state.targeting.pr === null
        ? null
        : (prs.find((pr) => pr.number === state.targeting.pr) ?? null),
    [state.targeting.pr, prs],
  );

  const unresolvedLabel =
    value === null && state.targeting.pr !== null
      ? intl.formatMessage(messages.unresolvedPrLabel, { number: state.targeting.pr })
      : undefined;

  return (
    <Inline $gap={1}>
      <IconField icon={GitPullRequest} width={280}>
        <Combobox<PrListItem>
          items={prs}
          value={value}
          getKey={(pr) => String(pr.number)}
          getLabel={getPrLabel}
          getFilterText={prFilterText}
          loading={isFetching}
          placeholder={intl.formatMessage(messages.placeholder)}
          unresolvedLabel={unresolvedLabel}
          onQueryChange={setQueryText}
          onSelect={(pr) => setPr(pr?.number ?? null)}
        />
      </IconField>
      <IconButton
        icon={Plus}
        label={intl.formatMessage(messages.newPullRequest)}
        onClick={() => setNewPrOpen(true)}
      />
      {newPrOpen && (
        <NewPrModal
          onClose={() => setNewPrOpen(false)}
          onCreated={(pr) => {
            setPr(pr.number);
            setNewPrOpen(false);
          }}
        />
      )}
    </Inline>
  );
}
