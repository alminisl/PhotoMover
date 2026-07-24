import { contextBridge, ipcRenderer } from 'electron'
import type { DriveInfo } from '../main/services/drive-watcher'
import type { PhotoMeta } from '../main/ipc/photos.ipc'
import type { LibraryPhotoMeta } from '../main/ipc/library.ipc'
import type { LibraryTagState } from '../main/services/library-metadata'
import type { TransferProgress, TransferResult } from '../main/services/file-transfer'
import type { AppConfig } from '../main/services/config'

export type { DriveInfo, PhotoMeta, LibraryPhotoMeta, LibraryTagState, TransferProgress, TransferResult, AppConfig }

/** Subscribe to an IPC channel; returns an unsubscribe function safe to use as a React effect cleanup. */
function subscribe<T extends unknown[]>(channel: string, cb: (...args: T) => void): () => void {
  const handler = (_: unknown, ...args: T): void => cb(...args)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api = {
  // Drives
  listDrives: (): Promise<DriveInfo[]> => ipcRenderer.invoke('drives:list'),
  onDrivesChanged: (cb: (drives: DriveInfo[]) => void): (() => void) =>
    subscribe('drives:changed', cb),

  // Dialog
  openFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFolder'),

  // Photos (transfer mode)
  scanPhotos: (sourceDir: string): Promise<number> =>
    ipcRenderer.invoke('photos:scan', sourceDir),
  getFullPreview: (path: string): Promise<string | null> =>
    ipcRenderer.invoke('photos:fullPreview', path),
  onPhotosBatch: (cb: (photos: PhotoMeta[]) => void): (() => void) =>
    subscribe('photos:batch', cb),
  onScanProgress: (cb: (p: { done: number; total: number }) => void): (() => void) =>
    subscribe('photos:progress', cb),
  onPhotosThumbnails: (cb: (updates: Array<{ id: string; thumbnailData: string }>) => void): (() => void) =>
    subscribe('photos:thumbnails', cb),

  // Transfer
  startTransfer: (photos: PhotoMeta[], destination: string): Promise<TransferResult> =>
    ipcRenderer.invoke('transfer:start', photos, destination),
  onTransferProgress: (cb: (progress: TransferProgress) => void): (() => void) =>
    subscribe('transfer:progress', cb),
  deletePhotos: (paths: string[]): Promise<{ deleted: number; errors: string[] }> =>
    ipcRenderer.invoke('transfer:delete', paths),

  // Config
  loadConfig: (): Promise<AppConfig> => ipcRenderer.invoke('config:load'),
  saveConfig: (config: Partial<AppConfig>): Promise<void> => ipcRenderer.invoke('config:save', config),

  // Library
  scanLibrary: (): Promise<{ ok: boolean; error?: string; count?: number }> =>
    ipcRenderer.invoke('library:scan'),
  scanEditFolder: (): Promise<{ ok: boolean; error?: string; count?: number }> =>
    ipcRenderer.invoke('library:scanEdit'),
  saveLibraryMetadata: (
    updates: Array<{ absolutePath: string; rating?: number; libraryTag?: LibraryTagState }>
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('library:saveMetadata', updates),
  moveToEdit: (
    paths: string[]
  ): Promise<{ ok: boolean; moved: Array<{ oldPath: string; newPath: string }>; failed: Array<{ path: string; reason: string }> }> =>
    ipcRenderer.invoke('library:moveToEdit', paths),
  deleteLibraryPhotos: (
    paths: string[]
  ): Promise<{ ok: boolean; deleted: string[]; failed: Array<{ path: string; reason: string }> }> =>
    ipcRenderer.invoke('library:deleteTagged', paths),

  onLibraryBatch: (cb: (photos: LibraryPhotoMeta[]) => void): (() => void) =>
    subscribe('library:batch', cb),
  onLibraryScanProgress: (cb: (p: { done: number; total: number }) => void): (() => void) =>
    subscribe('library:progress', cb),
  onLibraryThumbnails: (cb: (updates: Array<{ id: string; thumbnailData: string }>) => void): (() => void) =>
    subscribe('library:thumbnails', cb),
  onLibraryEditBatch: (cb: (photos: LibraryPhotoMeta[]) => void): (() => void) =>
    subscribe('library-edit:batch', cb),
  onLibraryEditThumbnails: (cb: (updates: Array<{ id: string; thumbnailData: string }>) => void): (() => void) =>
    subscribe('library-edit:thumbnails', cb),
  onLibraryEditProgress: (cb: (p: { done: number; total: number }) => void): (() => void) =>
    subscribe('library-edit:progress', cb)
}

contextBridge.exposeInMainWorld('api', api)

declare global {
  interface Window {
    api: typeof api
  }
}
