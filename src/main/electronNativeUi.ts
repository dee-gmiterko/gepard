import {
  clipboard,
  dialog,
  Menu,
  type BrowserWindow,
  type MenuItemConstructorOptions,
} from 'electron';
import type { FolderPicker, NativeMenu, PopupOptions } from './native';

export class ElectronNativeUi implements FolderPicker, NativeMenu {
  async pickFolder(window: BrowserWindow | null, title: string): Promise<string | null> {
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
