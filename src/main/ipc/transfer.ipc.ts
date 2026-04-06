import { ipcMain, BrowserWindow } from 'electron'
import { transferPhotos, deletePhotos } from '../services/file-transfer'
import type { PhotoMeta } from './photos.ipc'

export function registerTransferHandlers(): void {
  ipcMain.handle(
    'transfer:start',
    async (event, photos: PhotoMeta[], destination: string) => {
      const win = BrowserWindow.fromWebContents(event.sender)

      const result = await transferPhotos({
        destination,
        photos,
        onProgress: (progress) => {
          win?.webContents.send('transfer:progress', progress)
        }
      })

      return result
    }
  )

  ipcMain.handle('transfer:delete', async (_event, paths: string[]) => {
    return await deletePhotos(paths)
  })
}
