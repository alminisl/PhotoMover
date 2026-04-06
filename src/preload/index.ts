import { contextBridge, ipcRenderer } from 'electron'
import type { DriveInfo } from '../main/services/drive-watcher'
import type { PhotoMeta } from '../main/ipc/photos.ipc'
import type { TransferProgress, TransferResult } from '../main/services/file-transfer'
import type { AppConfig } from '../main/services/config'

export type { DriveInfo, PhotoMeta, TransferProgress, TransferResult, AppConfig }

const api = {
  // Drives
  listDrives: (): Promise<DriveInfo[]> => ipcRenderer.invoke('drives:list'),
  onDrivesChanged: (cb: (drives: DriveInfo[]) => void) => {
    const handler = (_: unknown, drives: DriveInfo[]) => cb(drives)
    ipcRenderer.on('drives:changed', handler)
    return () => ipcRenderer.removeListener('drives:changed', handler)
  },

  // Dialog
  openFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFolder'),

  // Photos
  scanPhotos: (sourceDir: string): Promise<number> =>
    ipcRenderer.invoke('photos:scan', sourceDir),
  onPhotosBatch: (cb: (photos: PhotoMeta[]) => void) => {
    const handler = (_: unknown, photos: PhotoMeta[]) => cb(photos)
    ipcRenderer.on('photos:batch', handler)
    return () => ipcRenderer.removeListener('photos:batch', handler)
  },
  onScanProgress: (cb: (p: { done: number; total: number }) => void) => {
    const handler = (_: unknown, p: { done: number; total: number }) => cb(p)
    ipcRenderer.on('photos:progress', handler)
    return () => ipcRenderer.removeListener('photos:progress', handler)
  },

  // Transfer
  startTransfer: (photos: PhotoMeta[], destination: string): Promise<TransferResult> =>
    ipcRenderer.invoke('transfer:start', photos, destination),
  onTransferProgress: (cb: (progress: TransferProgress) => void) => {
    const handler = (_: unknown, progress: TransferProgress) => cb(progress)
    ipcRenderer.on('transfer:progress', handler)
    return () => ipcRenderer.removeListener('transfer:progress', handler)
  },
  deletePhotos: (paths: string[]): Promise<{ deleted: number; errors: string[] }> =>
    ipcRenderer.invoke('transfer:delete', paths),

  // Config
  loadConfig: (): Promise<AppConfig> => ipcRenderer.invoke('config:load'),
  saveConfig: (config: Partial<AppConfig>): Promise<void> => ipcRenderer.invoke('config:save', config)
}

contextBridge.exposeInMainWorld('api', api)

declare global {
  interface Window {
    api: typeof api
  }
}
