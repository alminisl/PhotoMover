import { app, BrowserWindow, shell, ipcMain, dialog, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerDriveHandlers } from './ipc/drive.ipc'
import { registerPhotoHandlers } from './ipc/photos.ipc'
import { registerTransferHandlers } from './ipc/transfer.ipc'
import { loadConfig, saveConfig } from './services/config'

// Register custom protocol for serving local thumbnail/source files safely
protocol.registerSchemesAsPrivileged([
  { scheme: 'localfile', privileges: { secure: true, standard: true, supportFetchAPI: true } }
])

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f0f11',
      symbolColor: '#a1a1aa',
      height: 36
    },
    backgroundColor: '#0f0f11',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.photransfer.app')

  // Serve local files via localfile:/// protocol
  // Must use 3 slashes so Windows drive letters aren't parsed as the hostname
  protocol.handle('localfile', (request) => {
    // URL: localfile:///C:/path/to/file.jpg  → pathname: /C:/path/to/file.jpg
    const pathname = new URL(request.url).pathname
    // On Windows: strip leading slash before drive letter → C:/path/to/file.jpg
    const filePath = decodeURIComponent(
      pathname.startsWith('/') && pathname[2] === ':' ? pathname.slice(1) : pathname
    )
    return net.fetch(pathToFileURL(filePath).toString())
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register IPC handlers
  registerDriveHandlers()
  registerPhotoHandlers()
  registerTransferHandlers()

  // Config handlers
  ipcMain.handle('config:load', () => loadConfig())
  ipcMain.handle('config:save', (_e, config) => saveConfig(config))

  // Dialog handler
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Folder'
    })
    if (result.canceled) return null
    return result.filePaths[0] ?? null
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
