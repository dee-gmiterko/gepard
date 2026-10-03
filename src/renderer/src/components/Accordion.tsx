import type { ReactNode } from 'react';
import styled from 'styled-components';
import { ChevronDown, ChevronRight } from 'react-feather';
import { Surface } from './Surface';
import { disabledInteractive, focusVisible } from './controlStyles';

const Wrapper = styled(Surface).attrs({ $elevation: 'flat' as const })``;

const Header = styled.div<{ $disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.fg};
  ${disabledInteractive}

  &:hover {
    background: ${({ $disabled, theme }) => ($disabled ? 'transparent' : theme.colors.bgHover)};
  }
`;

const Leading = styled.span`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
`;

const Toggle = styled.button`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: inherit;

  ${focusVisible}
`;

const Title = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
`;

const Chevron = styled.span`
  display: inline-flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.fgMuted};
  flex-shrink: 0;
`;

const Body = styled.div`
  padding: ${({ theme }) => theme.space[2]};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

export interface AccordionProps {
  open: boolean;
  onToggle: () => void;
  leading?: ReactNode;
  title: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
  disabled?: boolean;
}

export function Accordion({
  open,
  onToggle,
  leading,
  title,
  trailing,
  children,
  disabled,
}: AccordionProps): React.JSX.Element {
  return (
    <Wrapper>
      <Header $disabled={disabled}>
        {leading && <Leading>{leading}</Leading>}
        <Toggle type="button" aria-expanded={open} disabled={disabled} onClick={onToggle}>
          <Title>{title}</Title>
          <Chevron>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</Chevron>
        </Toggle>
        {trailing}
      </Header>
      {open && children != null && <Body>{children}</Body>}
    </Wrapper>
  );
}
