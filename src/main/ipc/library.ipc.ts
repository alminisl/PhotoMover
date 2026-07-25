import { ipcMain, BrowserWindow, shell } from 'electron'
import { readdir, stat, readFile } from 'fs/promises'
import { join, extname, basename } from 'path'
import { pathExists, ensureDir, move, remove } from 'fs-extra'
import { readExif } from '../services/exif-reader'
import { generateThumbnail } from '../services/thumbnail'
import { loadConfig } from '../services/config'
import { libraryMetadata, type LibraryTagState } from '../services/library-metadata'
import { resolveCollision } from '../services/folder-organizer'
import type { PhotoMeta } from './photos.ipc'

export interface LibraryPhotoMeta extends PhotoMeta {
  rating: number
  libraryTag: LibraryTagState
}

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.webp', '.heic', '.heif',
  '.cr2', '.cr3', '.nef', '.arw', '.raf', '.orf', '.rw2', '.dng', '.raw'
])
const SKIP_DIRS = new Set(['__MACOSX', '.Spotlight-V100', '.Trashes', '.fseventsd'])

const META_CONCURRENCY = 16
const META_BATCH = 40
const THUMB_CONCURRENCY = 6
const THUMB_BATCH = 8

async function scanDir(dir: string, excludeDirs?: Set<string>): Promise<string[]> {
  const results: string[] = []
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (excludeDirs?.has(fullPath.replace(/\\/g, '/'))) continue
        results.push(...(await scanDir(fullPath, excludeDirs)))
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase()
        if (IMAGE_EXTENSIONS.has(ext)) results.push(fullPath)
      }
    }
  } catch { /* skip unreadable */ }
  return results
}

async function toDataUrl(thumbPath: string | null): Promise<string | null> {
  if (!thumbPath) return null
  try {
    const buf = await readFile(thumbPath)
    return `data:image/jpeg;base64,${buf.toString('base64')}`
  } catch { return null }
}

interface LibraryPhotoWithMeta extends LibraryPhotoMeta {
  _mtime: number
  _orientation: number
}

async function scanAndStream(
  files: string[],
  win: BrowserWindow | null,
  batchEvent: string,
  progressEvent: string,
  thumbEvent: string
): Promise<void> {
  const photos: LibraryPhotoWithMeta[] = []
  const pending: LibraryPhotoMeta[] = []
  let metaDone = 0

  function flushMeta(force = false): void {
    if (pending.length >= META_BATCH || (force && pending.length > 0)) {
      win?.webContents.send(batchEvent, [...pending])
      pending.length = 0
    }
  }

  let fileIndex = 0
  async function metaWorker(): Promise<void> {
    while (fileIndex < files.length) {
      const filePath = files[fileIndex++]
      try {
        const [stats, exif] = await Promise.all([stat(filePath), readExif(filePath)])
        const meta = libraryMetadata.get(filePath)
        const photo: LibraryPhotoWithMeta = {
          id: Buffer.from(filePath).toString('base64'),
          path: filePath,
          filename: basename(filePath),
          size: stats.size,
          dateTaken: exif.dateTaken,
          make: exif.make,
          model: exif.model,
          width: exif.width,
          height: exif.height,
          thumbnailData: null,
          iso: exif.iso,
          fNumber: exif.fNumber,
          exposureTime: exif.exposureTime,
          focalLength: exif.focalLength,
          rating: meta?.rating ?? 0,
          libraryTag: meta?.libraryTag ?? 'none',
          _mtime: stats.mtimeMs,
          _orientation: exif.orientation ?? 1
        }
        photos.push(photo)
        pending.push(photo)
        metaDone++
        flushMeta()
        win?.webContents.send(progressEvent, { done: metaDone, total: files.length })
      } catch {
        metaDone++
        win?.webContents.send(progressEvent, { done: metaDone, total: files.length })
      }
    }
  }

  await Promise.all(Array.from({ length: META_CONCURRENCY }, metaWorker))
  flushMeta(true)

  // Phase 2: thumbnails streamed progressively
  const thumbUpdates: Array<{ id: string; thumbnailData: string }> = []
  let thumbIndex = 0

  function flushThumbs(force = false): void {
    if (thumbUpdates.length >= THUMB_BATCH || (force && thumbUpdates.length > 0)) {
      win?.webContents.send(thumbEvent, [...thumbUpdates])
      thumbUpdates.length = 0
    }
  }

  async function thumbWorker(): Promise<void> {
    while (thumbIndex < photos.length) {
      const photo = photos[thumbIndex++]
      try {
        const thumbPath = await generateThumbnail(photo.path, photo._mtime, photo._orientation)
        const thumbnailData = await toDataUrl(thumbPath)
        if (thumbnailData) {
          thumbUpdates.push({ id: photo.id, thumbnailData })
          flushThumbs()
        }
      } catch { /* skip */ }
    }
  }

  await Promise.all(Array.from({ length: THUMB_CONCURRENCY }, thumbWorker))
  flushThumbs(true)
}

export function registerLibraryHandlers(): void {
  ipcMain.handle('library:scan', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const config = await loadConfig()
    if (!config.libraryPath) return { ok: false, error: 'NO_LIBRARY_PATH' }
    if (!(await pathExists(config.libraryPath))) return { ok: false, error: 'PATH_NOT_FOUND' }

    const editFolder = join(config.libraryPath, 'Edit').replace(/\\/g, '/')
    const files = await scanDir(config.libraryPath, new Set([editFolder]))
    await scanAndStream(files, win, 'library:batch', 'library:progress', 'library:thumbnails')
    return { ok: true, count: files.length }
  })

  ipcMain.handle('library:scanEdit', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const config = await loadConfig()
    if (!config.libraryPath) return { ok: false, error: 'NO_LIBRARY_PATH' }
    const editFolder = join(config.libraryPath, 'Edit')
    if (!(await pathExists(editFolder))) return { ok: true, count: 0 }
    const files = await scanDir(editFolder)
    await scanAndStream(files, win, 'library-edit:batch', 'library-edit:progress', 'library-edit:thumbnails')
    return { ok: true, count: files.length }
  })

  ipcMain.handle(
    'library:saveMetadata',
    async (_event, updates: Array<{ absolutePath: string; rating?: number; libraryTag?: LibraryTagState }>) => {
      try {
        libraryMetadata.upsertMany(updates)
        return { ok: true }
      } catch {
        return { ok: false, error: 'WRITE_FAILED' }
      }
    }
  )

  ipcMain.handle('library:moveToEdit', async (_event, absolutePaths: string[]) => {
    const config = await loadConfig()
    if (!config.libraryPath) return { ok: false, moved: [], failed: [{ path: '', reason: 'NO_LIBRARY_PATH' }] }

    const editFolder = join(config.libraryPath, 'Edit')
    await ensureDir(editFolder)
    const editFolderNorm = editFolder.replace(/\\/g, '/')

    const moved: Array<{ oldPath: string; newPath: string }> = []
    const failed: Array<{ path: string; reason: string }> = []

    for (const oldPath of absolutePaths) {
      try {
        const oldNorm = oldPath.replace(/\\/g, '/')
        if (oldNorm.startsWith(editFolderNorm + '/') || oldNorm === editFolderNorm) {
          moved.push({ oldPath, newPath: oldPath })
          continue
        }
        const rawNewPath = join(editFolder, basename(oldPath))
        const newPath = await resolveCollision(rawNewPath)
        await move(oldPath, newPath)
        libraryMetadata.rekey(oldPath, newPath)
        libraryMetadata.upsert(newPath, { libraryTag: 'to-edit' })
        moved.push({ oldPath, newPath })
      } catch (err) {
        failed.push({ path: oldPath, reason: (err as Error).message })
      }
    }

    await libraryMetadata.flush()
    return { ok: failed.length === 0, moved, failed }
  })

  ipcMain.handle('library:deleteTagged', async (_event, absolutePaths: string[]) => {
    const deleted: string[] = []
    const failed: Array<{ path: string; reason: string }> = []

    for (const p of absolutePaths) {
      try {
        // Prefer the OS trash so library deletes are recoverable; fall back to
        // a hard delete only where no trash exists (e.g. some network mounts)
        try {
          await shell.trashItem(p)
        } catch {
          await remove(p)
        }
        libraryMetadata.delete(p)
        deleted.push(p)
      } catch (err) {
        failed.push({ path: p, reason: (err as Error).message })
      }
    }

    await libraryMetadata.flush()
    return { ok: failed.length === 0, deleted, failed }
  })
}
