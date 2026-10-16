import { BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { is } from '@electron-toolkit/utils';
import icon from './resources/icon.png?asset';
import { isAllowedExternalUrl } from './helpers/url';
import type { NotifyService } from '@gepard/main/notify';
import { formatCaughtError } from '@gepard/main/helpers/error';
import { WINDOW_SHOWN_MARKER } from './instance';

export function focusMainWindow(): void {
  const window = BrowserWindow.getAllWindows()[0];
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

export class MainWindowService {
  constructor(
    private readonly notify: NotifyService,
    private readonly reportShown: boolean,
  ) {}

  private openExternal(url: string): void {
    shell
      .openExternal(url)
      .catch((err: unknown) =>
        this.notify.mainFailure('window', `openExternal failed: ${formatCaughtError(err)}`),
      );
  }

  private reportLoadFailure(err: unknown): void {
    this.notify.mainFailure('window', `load failed: ${formatCaughtError(err)}`);
  }

  create(): BrowserWindow {
    const devServerUrl = is.dev ? process.env['ELECTRON_RENDERER_URL'] : undefined;
    const indexHtmlPath = join(import.meta.dirname, '../renderer/index.html');
    const indexHtmlUrl = pathToFileURL(indexHtmlPath).href;

    function isOwnAppUrl(url: string): boolean {
      if (devServerUrl) {
        try {
          return new URL(url).origin === new URL(devServerUrl).origin;
        } catch {
          return false;
        }
      }
      return url === indexHtmlUrl;
    }

    const window = new BrowserWindow({
      title: 'Gepard',
      width: 1280,
      height: 800,
      show: false,
      autoHideMenuBar: true,
      ...(process.platform === 'linux' ? { icon } : {}),
      webPreferences: {
        preload: join(import.meta.dirname, '../preload/index.cjs'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    if (this.reportShown) {
      process.stdout.on('error', () => undefined);
      window.once('show', () => process.stdout.write(`${WINDOW_SHOWN_MARKER}\n`));
    }

    window.once('ready-to-show', () => {
      window.maximize();
      window.show();
    });

    window.webContents.setWindowOpenHandler((details) => {
      if (isAllowedExternalUrl(details.url)) this.openExternal(details.url);
      return { action: 'deny' };
    });

    window.webContents.on('will-navigate', (event, url) => {
      if (isOwnAppUrl(url)) return;
      event.preventDefault();
      if (isAllowedExternalUrl(url)) this.openExternal(url);
    });

    if (devServerUrl) {
      window.loadURL(devServerUrl).catch((err: unknown) => this.reportLoadFailure(err));
    } else {
      window.loadFile(indexHtmlPath).catch((err: unknown) => this.reportLoadFailure(err));
    }

    return window;
  }
}
