import type { ContextMenuLineTarget } from '@gepard/common';

export interface MenuEntry {
  label: string;
  checked?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

export interface OpenMenu {
  x: number;
  y: number;
  entries: MenuEntry[];
  onClose: () => void;
}

let current: OpenMenu | null = null;
let lineTarget: ContextMenuLineTarget | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeMenu(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOpenMenu(): OpenMenu | null {
  return current;
}

export function openMenu(menu: OpenMenu): void {
  current?.onClose();
  current = menu;
  emit();
}

export function closeMenu(): void {
  const menu = current;
  if (menu === null) return;
  current = null;
  emit();
  menu.onClose();
}

export function setBrowserLineTarget(target: ContextMenuLineTarget | null): void {
  lineTarget = target;
}

export function takeBrowserLineTarget(): ContextMenuLineTarget | null {
  const target = lineTarget;
  lineTarget = null;
  return target;
}
