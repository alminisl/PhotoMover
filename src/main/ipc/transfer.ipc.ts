import { ipcMain, BrowserWindow } from 'electron'
import { join } from 'path'
import { transferPhotos, discardPhotos } from '../services/file-transfer'
import { loadConfig } from '../services/config'
import type { PhotoMeta } from './photos.ipc'

export function registerTransferHandlers(): void {
  ipcMain.handle(
    'transfer:start',
    async (event, photos: PhotoMeta[], destination: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const config = await loadConfig()

      const result = await transferPhotos({
        destination,
        photos,
        deleteOriginal: config.deleteOriginal,
        organizerOptions: {
          organizeByDay: config.organizeByDay,
          separateRaw: config.separateRaw
        },
        onProgress: (progress) => {
          win?.webContents.send('transfer:progress', progress)
        }
      })

      return result
    }
  )

  ipcMain.handle('transfer:delete', async (_event, paths: string[]) => {
    const config = await loadConfig()
    const rejectsDir =
      config.safeDelete && config.destinationPath
        ? join(config.destinationPath, '_Rejects')
        : null
    return await discardPhotos(paths, rejectsDir)
  })
}
