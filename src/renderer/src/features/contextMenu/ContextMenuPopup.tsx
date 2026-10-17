import { Fragment, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { Check } from 'react-feather';
import type { ContextMenuRequest } from '@gepard/common';
import { useUiDispatch } from '../../state/UiContext';
import { useContextMenuLabel } from '../../hooks/useContextMenuLabels';
import { useOutsideClick } from '../../hooks/useOutsideClick';
import { contextMenuEntries } from '../../helpers/contextMenu';
import { Menu, MenuItem, MenuSeparator } from '../../components/Menu';
import { useRunContextMenuEntry } from './useRunContextMenuEntry';

const Panel = styled(Menu)`
  position: fixed;
  right: auto;
  min-width: 160px;
`;

const Entry = styled(MenuItem)<{ $disabled?: boolean }>`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
  color: ${({ $disabled, theme }) => ($disabled ? theme.colors.fgMuted : theme.colors.fg)};
  cursor: ${({ $disabled }) => ($disabled ? 'default' : 'pointer')};

  &:hover {
    background: ${({ $disabled, theme }) => ($disabled ? 'transparent' : theme.colors.bgHover)};
  }
`;

const CheckSlot = styled.span`
  display: inline-flex;
  width: 14px;
`;

export function ContextMenuPopup({ menu }: { menu: ContextMenuRequest }): React.JSX.Element {
  const dispatch = useUiDispatch();
  const label = useContextMenuLabel();
  const run = useRunContextMenuEntry(menu);
  const panelRef = useRef<HTMLUListElement>(null);
  const close = (): void => dispatch({ type: 'contextMenu/close' });
  useOutsideClick(panelRef, close);

  // The menu never takes focus, so Escape is only seen on the window.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') dispatch({ type: 'contextMenu/close' });
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch]);

  return (
    <Panel
      ref={panelRef}
      role="menu"
      style={{ left: menu.x, top: menu.y }}
      onMouseDown={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {contextMenuEntries(menu).map(({ key, checked, disabled, separatorBefore }) => (
        <Fragment key={key}>
          {separatorBefore && <MenuSeparator />}
          <Entry
            role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={checked}
            aria-disabled={disabled}
            $disabled={disabled}
            onClick={() => {
              if (disabled) return;
              close();
              run(key);
            }}
          >
            {checked !== undefined && <CheckSlot>{checked && <Check size={14} />}</CheckSlot>}
            {label(key)}
          </Entry>
        </Fragment>
      ))}
    </Panel>
  );
}
