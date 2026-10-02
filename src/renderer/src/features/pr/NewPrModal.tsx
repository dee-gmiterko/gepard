import { useState, type FormEvent, type ReactNode } from 'react';
import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { Button } from '../../components/Button';
import { Message } from '../../components/Message';
import { Modal } from '../../components/Modal';
import { Select } from '../../components/Select';
import { TextArea, TextInput } from '../../components/TextInput';
import { ActionRow, Stack } from '../../components/Layout';
import { useBranches, useCreatePr } from '../../queries/prs';
import { localizedErrorMessage } from '../../errors/errorMessage';
import type { PrSummary } from '@gepard/common';

const messages = defineMessages({
  title: {
    id: 'pr.newPrModal.title',
    defaultMessage: 'New pull request',
  },
  close: {
    id: 'pr.newPrModal.close',
    defaultMessage: 'Close',
  },
  base: {
    id: 'pr.newPrModal.base',
    defaultMessage: 'Base',
  },
  head: {
    id: 'pr.newPrModal.head',
    defaultMessage: 'Head',
  },
  selectBranch: {
    id: 'pr.newPrModal.selectBranch',
    defaultMessage: 'Select branch…',
  },
  titleField: {
    id: 'pr.newPrModal.titleField',
    defaultMessage: 'Title',
  },
  descriptionField: {
    id: 'pr.newPrModal.descriptionField',
    defaultMessage: 'Description',
  },
  cancel: {
    id: 'pr.newPrModal.cancel',
    defaultMessage: 'Cancel',
  },
  creating: {
    id: 'pr.newPrModal.creating',
    defaultMessage: 'Creating…',
  },
  create: {
    id: 'pr.newPrModal.create',
    defaultMessage: 'Create',
  },
});

const BranchRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
`;

const Field = styled.label`
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[1]};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.fgMuted};
`;

const Actions = styled(ActionRow)`
  margin-top: ${({ theme }) => theme.space[4]};
`;

function BranchSelect({
  label,
  value,
  branches,
  loading,
  placeholder,
  onChange,
}: {
  label: ReactNode;
  value: string;
  branches: string[] | undefined;
  loading: boolean;
  placeholder: string;
  onChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <Field>
      {label}
      <Select value={value} disabled={loading} onChange={(e) => onChange(e.target.value)} required>
        <option value="" disabled>
          {placeholder}
        </option>
        {branches?.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </Select>
    </Field>
  );
}

interface NewPrModalProps {
  onClose: () => void;
  onCreated: (pr: PrSummary) => void;
}

export function NewPrModal({ onClose, onCreated }: NewPrModalProps): React.JSX.Element {
  const intl = useIntl();
  const { data, isLoading: branchesLoading } = useBranches();
  const branches = data?.branches;
  const createPr = useCreatePr();

  const [base, setBase] = useState('');
  const [head, setHead] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  if (data && !defaultsApplied) {
    setBase(data.defaultBranch ?? '');
    setHead(data.defaultBranch ?? '');
    setDefaultsApplied(true);
  }

  const canSubmit =
    base.length > 0 &&
    head.length > 0 &&
    base !== head &&
    title.trim().length > 0 &&
    !createPr.isPending;

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    if (!canSubmit) return;
    createPr.mutate({ base, head, title: title.trim(), body }, { onSuccess: onCreated });
  }

  return (
    <Modal
      title={<FormattedMessage {...messages.title} />}
      closeLabel={intl.formatMessage(messages.close)}
      onClose={onClose}
      onSubmit={handleSubmit}
      width="640px"
    >
      <Stack>
        <BranchRow>
          <BranchSelect
            label={<FormattedMessage {...messages.base} />}
            value={base}
            branches={branches}
            loading={branchesLoading}
            placeholder={intl.formatMessage(messages.selectBranch)}
            onChange={setBase}
          />
          <BranchSelect
            label={<FormattedMessage {...messages.head} />}
            value={head}
            branches={branches}
            loading={branchesLoading}
            placeholder={intl.formatMessage(messages.selectBranch)}
            onChange={setHead}
          />
        </BranchRow>
        <Field>
          <FormattedMessage {...messages.titleField} />
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field>
          <FormattedMessage {...messages.descriptionField} />
          <TextArea value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {createPr.isError && (
          <Message tone="danger" layout="inline">
            {localizedErrorMessage(createPr.error).message}
          </Message>
        )}
      </Stack>
      <Actions>
        <Button type="button" onClick={onClose}>
          <FormattedMessage {...messages.cancel} />
        </Button>
        <Button type="submit" variant="primary" disabled={!canSubmit}>
          <FormattedMessage {...(createPr.isPending ? messages.creating : messages.create)} />
        </Button>
      </Actions>
    </Modal>
  );
}
