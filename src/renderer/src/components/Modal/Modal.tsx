import { useEffect, useRef, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import styled from 'styled-components'
import { X } from 'react-feather'
import { IconButton } from '../IconButton'
import { SectionHeading } from '../SectionHeading'
import { Surface } from '../Surface'

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.colors.overlay};
  z-index: ${({ theme }) => theme.z.modal};
`

const Dialog = styled(Surface).attrs({ $elevation: 'floating' })`
  width: 420px;
  max-width: calc(100vw - ${({ theme }) => theme.space[6]});
  padding: ${({ theme }) => theme.space[4]};
`

const DialogHeader = styled.div`
  margin-bottom: ${({ theme }) => theme.space[3]};
`

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface ModalProps {
  title: ReactNode
  closeLabel: string
  onClose: () => void
  onSubmit?: (e: FormEvent) => void
  children: ReactNode
}

export function Modal({
  title,
  closeLabel,
  onClose,
  onSubmit,
  children
}: ModalProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    ;(first ?? dialog)?.focus()
    return () => previouslyFocused?.focus()
  }, [])

  function focusables(): HTMLElement[] {
    return Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    e.stopPropagation()
    if (e.key === 'Escape') {
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const items = focusables()
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <Backdrop
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={handleKeyDown}
    >
      <Dialog ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true">
        <DialogHeader>
          <SectionHeading
            title={title}
            actions={<IconButton icon={X} label={closeLabel} onClick={onClose} />}
          />
        </DialogHeader>
        {onSubmit ? <form onSubmit={onSubmit}>{children}</form> : children}
      </Dialog>
    </Backdrop>
  )
}
