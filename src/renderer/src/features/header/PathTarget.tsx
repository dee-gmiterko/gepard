import { useEffect, useMemo, useRef, useState } from 'react';
import { Folder, X } from 'react-feather';
import { defineMessages, useIntl } from 'react-intl';
import { Combobox } from '../../components/Combobox';
import { IconField } from '../../components/IconField';
import { IconButton } from '../../components/IconButton';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useTree } from '../../queries/files';
import { useTargeting } from '../../state/hooks';
import { useTargetActions } from './useTargetActions';
import { foldersOf, isValidRepoPath } from '../../helpers/paths';

const messages = defineMessages({
  placeholder: {
    id: 'header.pathTarget.placeholder',
    defaultMessage: 'Path…',
  },
  clear: {
    id: 'header.pathTarget.clear',
    defaultMessage: 'Clear',
  },
});

interface PathTargetInputProps {
  committed: string | null;
  folders: string[];
  isFetching: boolean;
  placeholder: string;
  onCommit: (raw: string) => void;
}

function PathTargetInput({
  committed,
  folders,
  isFetching,
  placeholder,
  onCommit,
}: PathTargetInputProps): React.JSX.Element {
  const [text, setText] = useState(committed ?? '');
  const lastOwnCommit = useRef(committed ?? '');

  useEffect(() => {
    const normalized = committed ?? '';
    if (normalized === lastOwnCommit.current) return;
    lastOwnCommit.current = normalized;
    setText(normalized);
  }, [committed]);

  const onCommitRef = useRef(onCommit);
  useEffect(() => {
    onCommitRef.current = onCommit;
  });

  const debouncedText = useDebouncedValue(text, 50);
  useEffect(() => {
    const trimmed = debouncedText.trim();
    if (trimmed === lastOwnCommit.current) return;
    lastOwnCommit.current = trimmed;
    onCommitRef.current(debouncedText);
  }, [debouncedText]);

  function handleSelect(folder: string | null): void {
    const next = folder ?? '';
    setText(next);
    lastOwnCommit.current = next.trim();
    onCommit(next);
  }

  return (
    <Combobox<string>
      items={folders}
      value={null}
      getKey={(f) => f}
      getLabel={(f) => f}
      loading={isFetching}
      placeholder={placeholder}
      onSelect={handleSelect}
      freeText={{ text, onTextChange: setText }}
    />
  );
}

export function PathTarget(): React.JSX.Element {
  const intl = useIntl();
  const targeting = useTargeting();
  const { setPath } = useTargetActions();
  const tree = useTree();

  const folders = useMemo(() => foldersOf(tree.data ?? []), [tree.data]);

  function commit(raw: string): void {
    const path = raw.trim() || null;
    if (path !== null && !isValidRepoPath(path)) return;
    setPath(path);
  }

  return (
    <IconField icon={Folder}>
      <PathTargetInput
        committed={targeting.path}
        folders={folders}
        isFetching={tree.isFetching}
        placeholder={intl.formatMessage(messages.placeholder)}
        onCommit={commit}
      />
      {targeting.path !== null && (
        <IconButton
          icon={X}
          label={intl.formatMessage(messages.clear)}
          size={12}
          onClick={() => commit('')}
        />
      )}
    </IconField>
  );
}
