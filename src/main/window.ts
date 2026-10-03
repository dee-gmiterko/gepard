import { BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { is } from '@electron-toolkit/utils';
import icon from './resources/icon.png?asset';
import { isAllowedExternalUrl } from './helpers/url';
import { notifyMainFailure } from './notify';
import { formatCaughtError } from './helpers/error';
import { installContextMenu } from './contextMenu';

function openExternal(url: string): void {
  shell
    .openExternal(url)
    .catch((err: unknown) =>
      notifyMainFailure('window', `openExternal failed: ${formatCaughtError(err)}`),
    );
}

function reportLoadFailure(err: unknown): void {
  notifyMainFailure('window', `load failed: ${formatCaughtError(err)}`);
}

export function createMainWindow(): BrowserWindow {
  const devServerUrl = is.dev ? process.env['ELECTRON_RENDERER_URL'] : undefined;
  const indexHtmlPath = join(__dirname, '../renderer/index.html');
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
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  installContextMenu(window.webContents);

  window.once('ready-to-show', () => {
    window.maximize();
    window.show();
  });

  window.webContents.setWindowOpenHandler((details) => {
    if (isAllowedExternalUrl(details.url)) openExternal(details.url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (isOwnAppUrl(url)) return;
    event.preventDefault();
    if (isAllowedExternalUrl(url)) openExternal(url);
  });

  if (devServerUrl) {
    window.loadURL(devServerUrl).catch(reportLoadFailure);
  } else {
    window.loadFile(indexHtmlPath).catch(reportLoadFailure);
  }

  return window;
}
