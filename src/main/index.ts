import { app, BrowserWindow, shell, ipcMain, dialog, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerDriveHandlers } from './ipc/drive.ipc'
import { registerPhotoHandlers } from './ipc/photos.ipc'
import { registerTransferHandlers } from './ipc/transfer.ipc'
import { registerLibraryHandlers } from './ipc/library.ipc'
import { loadConfig, saveConfig } from './services/config'
import { libraryMetadata } from './services/library-metadata'
import { fromLocalFileUrl } from './utils/localfile'

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

app.whenReady().then(async () => {
  await libraryMetadata.load()
  electronApp.setAppUserModelId('com.photransfer.app')

  // Serve local files via localfile://local/<encoded path>
  protocol.handle('localfile', (request) => {
    const filePath = fromLocalFileUrl(request.url)
    return net.fetch(pathToFileURL(filePath).toString())
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register IPC handlers
  registerDriveHandlers()
  registerPhotoHandlers()
  registerTransferHandlers()
  registerLibraryHandlers()

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

app.on('before-quit', async () => {
  await libraryMetadata.flush()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
