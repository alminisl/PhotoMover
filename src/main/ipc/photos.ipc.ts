import { ipcMain, BrowserWindow } from 'electron'
import { readdir, stat, readFile } from 'fs/promises'
import { join, extname, basename } from 'path'
import { readExif } from '../services/exif-reader'
import { generateThumbnail } from '../services/thumbnail'

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
  // base64 data URL: "data:image/jpeg;base64,..." — null if thumbnail generation failed
  thumbnailData: string | null
  iso: number | null
  fNumber: number | null
  exposureTime: number | null
  focalLength: number | null
}

// macOS resource-fork stub files — not real images
const SKIP_DIRS = new Set(['__MACOSX', '.Spotlight-V100', '.Trashes', '.fseventsd'])

async function scanDirectory(dir: string): Promise<string[]> {
  const results: string[] = []
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      // Skip hidden/system dirs and macOS metadata files (._filename)
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue

      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        const sub = await scanDirectory(fullPath)
        results.push(...sub)
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase()
        if (IMAGE_EXTENSIONS.has(ext)) {
          results.push(fullPath)
        }
      }
    }
  } catch {
    // skip unreadable directories
  }
  return results
}

async function toDataUrl(thumbPath: string | null): Promise<string | null> {
  if (!thumbPath) return null
  try {
    const buf = await readFile(thumbPath)
    return `data:image/jpeg;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

export function registerPhotoHandlers(): void {
  ipcMain.handle('photos:scan', async (event, sourceDir: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const files = await scanDirectory(sourceDir)

    console.log(`[photos:scan] found ${files.length} files in ${sourceDir}`)

    const photos: PhotoMeta[] = []
    const BATCH = 10

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i]
      try {
        const stats = await stat(filePath)
        const exif = await readExif(filePath)
        const thumbPath = await generateThumbnail(filePath, stats.mtimeMs)

        if (i === 0) {
          console.log(`[photos:scan] first thumb path: ${thumbPath}`)
        }

        const thumbnailData = await toDataUrl(thumbPath)

        const photo: PhotoMeta = {
          id: Buffer.from(filePath).toString('base64'),
          path: filePath,
          filename: basename(filePath),
          size: stats.size,
          dateTaken: exif.dateTaken,
          make: exif.make,
          model: exif.model,
          width: exif.width,
          height: exif.height,
          thumbnailData,
          iso: exif.iso,
          fNumber: exif.fNumber,
          exposureTime: exif.exposureTime,
          focalLength: exif.focalLength
        }

        photos.push(photo)

        if (photos.length % BATCH === 0) {
          win?.webContents.send('photos:batch', photos.slice(-BATCH))
        }

        win?.webContents.send('photos:progress', { done: i + 1, total: files.length })
      } catch (err) {
        console.error(`[photos:scan] error on ${filePath}:`, err)
      }
    }

    const remainder = photos.length % BATCH
    if (remainder > 0) {
      win?.webContents.send('photos:batch', photos.slice(-remainder))
    }

    return photos.length
  })
}
