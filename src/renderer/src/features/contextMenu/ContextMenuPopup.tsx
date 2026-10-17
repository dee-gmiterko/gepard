import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Check } from 'react-feather';
import type { ContextMenuRequest } from '@gepard/common';
import { useUiDispatch } from '../../state/UiContext';
import { useContextMenuLabel } from '../../hooks/useContextMenuLabels';
import { useOutsideClick } from '../../hooks/useOutsideClick';
import { contextMenuEntries } from '../../helpers/contextMenu';
import { clampToViewport } from '../../helpers/viewport';
import { Menu, MenuItem, MenuSeparator } from '../../components/Menu';
import { useRunContextMenuEntry } from './useRunContextMenuEntry';

const EDGE_PADDING = 4;

const Panel = styled(Menu)`
  position: fixed;
  right: auto;
  width: max-content;
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
  const [position, setPosition] = useState({ x: menu.x, y: menu.y });
  const close = (): void => dispatch({ type: 'contextMenu/close' });
  useOutsideClick(panelRef, close);

  useLayoutEffect(() => {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition(
      clampToViewport(
        { x: menu.x, y: menu.y },
        rect,
        { width: window.innerWidth, height: window.innerHeight },
        EDGE_PADDING,
      ),
    );
  }, [menu.x, menu.y]);

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
      style={{ left: position.x, top: position.y }}
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
