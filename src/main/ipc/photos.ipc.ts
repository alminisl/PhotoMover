import { ipcMain, BrowserWindow } from 'electron'
import { readdir, stat, readFile } from 'fs/promises'
import { join, extname, basename } from 'path'
import { readExif } from '../services/exif-reader'
import { generateThumbnail, generateFullPreview } from '../services/thumbnail'
import { toLocalFileUrl } from '../utils/localfile'

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.webp', '.heic', '.heif',
  '.cr2', '.cr3', '.nef', '.arw', '.raf', '.orf', '.rw2', '.dng', '.raw'
])

export interface PhotoMeta {
  id: string
  path: string
  filename: string
  size: number
  dateTaken: Date | null
  make: string | null
  model: string | null
  width: number | null
  height: number | null
  thumbnailData: string | null
  iso: number | null
  fNumber: number | null
  exposureTime: number | null
  focalLength: number | null
}

const SKIP_DIRS = new Set(['__MACOSX', '.Spotlight-V100', '.Trashes', '.fseventsd'])

async function scanDirectory(dir: string): Promise<string[]> {
  const results: string[] = []
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...(await scanDirectory(fullPath)))
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

// Phase 1: metadata (no thumbnail) — fast, shows photos immediately
const META_CONCURRENCY = 16
const META_BATCH = 40

// Phase 2: thumbnails streamed separately — slower but non-blocking
const THUMB_CONCURRENCY = 6
const THUMB_BATCH = 8

// Formats Chromium can render directly in an <img> tag — served straight from disk
const DISPLAYABLE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif'])

export function registerPhotoHandlers(): void {
  // Full-resolution preview for the lightbox. Displayable formats are served
  // from the original file; RAW formats get their embedded JPEG extracted.
  ipcMain.handle('photos:fullPreview', async (_event, filePath: string) => {
    try {
      const ext = extname(filePath).toLowerCase()
      if (DISPLAYABLE_EXTENSIONS.has(ext)) {
        return toLocalFileUrl(filePath)
      }
      const stats = await stat(filePath)
      const previewPath = await generateFullPreview(filePath, stats.mtimeMs)
      return previewPath ? toLocalFileUrl(previewPath) : null
    } catch {
      return null
    }
  })

  ipcMain.handle('photos:scan', async (event, sourceDir: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const files = await scanDirectory(sourceDir)
    console.log(`[photos:scan] found ${files.length} files in ${sourceDir}`)

    // ── Phase 1: metadata (fast) ──────────────────────────────
    interface PhotoWithMeta extends PhotoMeta { _mtime: number; _orientation: number }
    const photos: PhotoWithMeta[] = []
    const pending: PhotoMeta[] = []
    let metaDone = 0

    function flushMeta(force = false): void {
      if (pending.length >= META_BATCH || (force && pending.length > 0)) {
        win?.webContents.send('photos:batch', [...pending])
        pending.length = 0
      }
    }

    let fileIndex = 0
    async function metaWorker(): Promise<void> {
      while (fileIndex < files.length) {
        const filePath = files[fileIndex++]
        try {
          const [stats, exif] = await Promise.all([stat(filePath), readExif(filePath)])
          const photo: PhotoWithMeta = {
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
            _mtime: stats.mtimeMs,
            _orientation: exif.orientation ?? 1
          }
          photos.push(photo)
          pending.push(photo)
          metaDone++
          flushMeta()
          win?.webContents.send('photos:progress', { done: metaDone, total: files.length })
        } catch {
          metaDone++
          win?.webContents.send('photos:progress', { done: metaDone, total: files.length })
        }
      }
    }

    await Promise.all(Array.from({ length: META_CONCURRENCY }, metaWorker))
    flushMeta(true)

    // ── Phase 2: thumbnails (streamed) ────────────────────────
    const thumbUpdates: Array<{ id: string; thumbnailData: string }> = []
    let thumbIndex = 0

    function flushThumbs(force = false): void {
      if (thumbUpdates.length >= THUMB_BATCH || (force && thumbUpdates.length > 0)) {
        win?.webContents.send('photos:thumbnails', [...thumbUpdates])
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

    return photos.length
  })
}
