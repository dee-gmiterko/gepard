import { Fragment, useEffect, useRef, useSyncExternalStore } from 'react';
import styled from 'styled-components';
import { useContextMenuLabel } from '../hooks/useContextMenuLabels';
import { useOutsideClick } from '../hooks/useOutsideClick';
import { Surface } from '../components/Surface';
import { buildTextEntries, hasMenuContent, type TextMenuActions } from './entries';
import {
  closeMenu,
  getOpenMenu,
  openMenu,
  subscribeMenu,
  takeBrowserLineTarget,
} from './menuStore';

const CHECK_MARK = '\u2713';

const Panel = styled(Surface).attrs({ as: 'ul' as const, role: 'menu' })`
  position: fixed;
  z-index: ${({ theme }) => theme.z.popover};
  min-width: 160px;
  margin: 0;
  padding: ${({ theme }) => theme.space[1]} 0;
  list-style: none;
`;

const Separator = styled.li`
  height: 1px;
  margin: ${({ theme }) => theme.space[1]} 0;
  background: ${({ theme }) => theme.colors.border};
`;

const Item = styled.li<{ $disabled?: boolean }>`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
  padding: 6px ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ $disabled, theme }) => ($disabled ? theme.colors.fgMuted : theme.colors.fg)};
  cursor: ${({ $disabled }) => ($disabled ? 'default' : 'pointer')};

  &:hover {
    background: ${({ $disabled, theme }) => ($disabled ? 'transparent' : theme.colors.bgHover)};
  }
`;

const Check = styled.span`
  width: 1em;
`;

const textActions: TextMenuActions = {
  edit: (command) => {
    if (command === 'paste') {
      navigator.clipboard
        .readText()
        .then((text) => document.execCommand('insertText', false, text))
        .catch(() => undefined);
      return;
    }
    document.execCommand(command);
  },
  copyText: (text) => {
    navigator.clipboard.writeText(text).catch(() => undefined);
  },
};

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement)
  );
}

function ContextMenuLayer(): React.JSX.Element | null {
  const label = useContextMenuLabel();
  const labelRef = useRef(label);
  useEffect(() => {
    labelRef.current = label;
  });

  useEffect(() => {
    function onContextMenu(e: MouseEvent): void {
      const target = takeBrowserLineTarget();
      const context = {
        editable: isEditable(e.target),
        hasSelection: (window.getSelection()?.toString() ?? '').length > 0,
        target,
      };
      if (!hasMenuContent(context)) return;
      e.preventDefault();
      openMenu({
        x: e.clientX,
        y: e.clientY,
        entries: buildTextEntries(context, labelRef.current, textActions),
        onClose: () => undefined,
      });
    }
    document.addEventListener('contextmenu', onContextMenu);
    return () => document.removeEventListener('contextmenu', onContextMenu);
  }, []);

  const menu = useSyncExternalStore(subscribeMenu, getOpenMenu);
  const ref = useRef<HTMLUListElement>(null);
  useOutsideClick(ref, closeMenu);
  useEffect(() => {
    if (menu === null) return;
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') closeMenu();
    }
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', closeMenu);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', closeMenu);
    };
  }, [menu]);

  if (menu === null) return null;
  return (
    <Panel ref={ref} style={{ left: menu.x, top: menu.y }}>
      {menu.entries.map((entry) => (
        <Fragment key={entry.label}>
          {entry.separatorBefore && <Separator role="separator" />}
          <Item
            role={entry.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={entry.checked}
            aria-disabled={entry.disabled}
            $disabled={entry.disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (entry.disabled) return;
              entry.onSelect();
              closeMenu();
            }}
          >
            {entry.checked !== undefined && <Check>{entry.checked ? CHECK_MARK : ''}</Check>}
            {entry.label}
          </Item>
        </Fragment>
      ))}
    </Panel>
  );
}

export function BrowserContextMenu(): React.JSX.Element | null {
  return window.gepard.host === 'browser' ? <ContextMenuLayer /> : null;
}
