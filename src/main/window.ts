import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:'])

function isAllowedExternalUrl(url: string): boolean {
  try {
    return ALLOWED_EXTERNAL_PROTOCOLS.has(new URL(url).protocol)
  } catch {
    return false
  }
}

export function createMainWindow(): BrowserWindow {
  const devServerUrl = is.dev ? process.env['ELECTRON_RENDERER_URL'] : undefined
  const indexHtmlPath = join(__dirname, '../renderer/index.html')
  const indexHtmlUrl = pathToFileURL(indexHtmlPath).href

  function isOwnAppUrl(url: string): boolean {
    if (devServerUrl) {
      try {
        return new URL(url).origin === new URL(devServerUrl).origin
      } catch {
        return false
      }
    }
    return url === indexHtmlUrl
  }

  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  window.on('ready-to-show', () => window.show())

  window.webContents.setWindowOpenHandler((details) => {
    if (isAllowedExternalUrl(details.url)) shell.openExternal(details.url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (isOwnAppUrl(url)) return
    event.preventDefault()
    if (isAllowedExternalUrl(url)) shell.openExternal(url)
  })

  if (devServerUrl) {
    window.loadURL(devServerUrl)
  } else {
    window.loadFile(indexHtmlPath)
  }

  return window
}
