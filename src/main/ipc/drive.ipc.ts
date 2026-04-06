import { ipcMain } from 'electron'
import { listRemovableDrives, startDriveWatcher } from '../services/drive-watcher'

export function registerDriveHandlers(): void {
  ipcMain.handle('drives:list', async () => {
    return await listRemovableDrives()
  })

  startDriveWatcher()
}
