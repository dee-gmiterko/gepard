import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import styled from 'styled-components';
import { X } from 'react-feather';
import { IconButton } from './IconButton';
import { SectionHeading } from './SectionHeading';
import { Surface } from './Surface';

const Dialog = styled(Surface).attrs({ $elevation: 'floating' as const })<{
  $width: string;
}>`
  width: ${({ $width }) => $width};
  max-width: calc(100vw - ${({ theme }) => theme.space[6]});
  padding: 0;
  color: ${({ theme }) => theme.colors.fg};

  &::backdrop {
    background: ${({ theme }) => theme.colors.overlay};
  }
`;

const Body = styled.div`
  padding: ${({ theme }) => theme.space[4]};
`;

const DialogHeader = styled.div`
  margin-bottom: ${({ theme }) => theme.space[3]};
`;

export interface ModalProps {
  title: ReactNode;
  closeLabel: string;
  onClose: () => void;
  onSubmit?: (e: FormEvent) => void;
  width?: string;
  children: ReactNode;
}

export function Modal({
  title,
  closeLabel,
  onClose,
  onSubmit,
  width = '420px',
  children,
}: ModalProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <Dialog
      as="dialog"
      ref={dialogRef}
      $width={width}
      onClose={onClose}
      // Clicks on ::backdrop are dispatched to the dialog element itself.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Body>
        <DialogHeader>
          <SectionHeading
            title={title}
            actions={<IconButton icon={X} label={closeLabel} onClick={onClose} />}
          />
        </DialogHeader>
        {onSubmit ? <form onSubmit={onSubmit}>{children}</form> : children}
      </Body>
    </Dialog>
  );
}
