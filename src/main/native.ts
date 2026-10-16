import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';

export interface PopupOptions {
  window: BrowserWindow;
  x: number;
  y: number;
  callback: () => void;
}

export interface FolderPicker {
  pickFolder(window: BrowserWindow | null, title: string): Promise<string | null>;
}

export interface NativeMenu {
  popupMenu(template: MenuItemConstructorOptions[], options?: PopupOptions): void;
  writeClipboard(text: string): Promise<void>;
}
