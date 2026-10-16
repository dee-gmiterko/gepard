import { BrowserWindow, clipboard, dialog, Menu, type MenuItemConstructorOptions } from 'electron';
import type { FolderPicker, WindowHandle } from '@gepard/main/ports/native';

export interface PopupOptions {
  window: BrowserWindow;
  x: number;
  y: number;
  callback: () => void;
}

export interface NativeMenu {
  popupMenu(template: MenuItemConstructorOptions[], options?: PopupOptions): void;
  writeClipboard(text: string): Promise<void>;
}

export function windowOf(handle: WindowHandle | null): BrowserWindow | null {
  return handle === null ? null : BrowserWindow.fromId(handle.id);
}

export function handleOf(window: BrowserWindow | null): WindowHandle | null {
  return window === null ? null : { id: window.id };
}

export class ElectronNativeUi implements FolderPicker, NativeMenu {
  async pickFolder(handle: WindowHandle | null, title: string): Promise<string | null> {
    const window = windowOf(handle);
    const options = { title, properties: ['openDirectory' as const] };
    const { canceled, filePaths } = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);
    return canceled ? null : (filePaths[0] ?? null);
  }

  popupMenu(template: MenuItemConstructorOptions[], options?: PopupOptions): void {
    Menu.buildFromTemplate(template).popup(options);
  }

  writeClipboard(text: string): Promise<void> {
    return clipboard.writeText(text);
  }
}
