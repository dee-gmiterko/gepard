import type { ReactNode } from 'react'
import styled from 'styled-components'
import { ChevronDown, ChevronRight } from 'react-feather'

const Wrapper = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colors.bgElevated};
`

const Header = styled.div<{ $disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => theme.space[2]};
  cursor: ${({ $disabled }) => ($disabled ? 'default' : 'pointer')};
  opacity: ${({ $disabled }) => ($disabled ? 0.55 : 1)};
  user-select: none;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.fg};

  &:hover {
    background: ${({ $disabled, theme }) => ($disabled ? 'transparent' : theme.colors.bgHover)};
  }
`

const Leading = styled.span`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
`

const Title = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
`

const Chevron = styled.span`
  display: inline-flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.fgMuted};
  flex-shrink: 0;
`

const Body = styled.div`
  padding: ${({ theme }) => theme.space[2]};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`

export interface AccordionProps {
  open: boolean
  onToggle: () => void
  leading?: ReactNode
  title: ReactNode
  trailing?: ReactNode
  children?: ReactNode
  disabled?: boolean
}

export function Accordion({
  open,
  onToggle,
  leading,
  title,
  trailing,
  children,
  disabled
}: AccordionProps): React.JSX.Element {
  return (
    <Wrapper>
      <Header
        role="button"
        aria-expanded={open}
        aria-disabled={disabled}
        $disabled={disabled}
        onClick={() => {
          if (!disabled) onToggle()
        }}
      >
        {leading && <Leading onClick={(e) => e.stopPropagation()}>{leading}</Leading>}
        <Title>{title}</Title>
        {trailing}
        <Chevron>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</Chevron>
      </Header>
      {open && children != null && <Body>{children}</Body>}
    </Wrapper>
  )
}
