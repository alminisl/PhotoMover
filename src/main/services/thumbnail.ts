import { join, extname } from 'path'
import { app } from 'electron'
import { ensureDir, pathExists, writeFile } from 'fs-extra'
import { createHash } from 'crypto'
// exifr's node entry points ("main"/"module") are the full bundle, which
// includes RAF/RAW thumbnail extraction — the lite bundle is browser-only
import exifr from 'exifr'
import Jimp from 'jimp'

const THUMB_SIZE = 220
let cacheDir: string | null = null

const RAW_EXTENSIONS = new Set([
  '.cr2', '.cr3', '.nef', '.arw', '.raf', '.orf', '.rw2', '.dng', '.raw'
])

function getCacheDir(): string {
  if (!cacheDir) {
    cacheDir = join(app.getPath('temp'), 'photo-transfer-thumbs')
  }
  return cacheDir
}

function thumbKey(filePath: string, mtimeMs: number): string {
  const hash = createHash('sha1').update(`${filePath}:${mtimeMs}`).digest('hex').slice(0, 16)
  return `${hash}.jpg`
}

// Maps EXIF orientation → degrees to rotate (Jimp rotates counter-clockwise)
const ORIENTATION_ROTATION: Record<number, number> = { 3: 180, 6: 270, 8: 90 }

export async function generateThumbnail(
  filePath: string,
  mtimeMs: number,
  orientation = 1
): Promise<string | null> {
  try {
    const dir = getCacheDir()
    await ensureDir(dir)

    const key = thumbKey(filePath, mtimeMs)
    const thumbPath = join(dir, key)

    if (await pathExists(thumbPath)) {
      return thumbPath
    }

    // Fast path: extract the EXIF-embedded thumbnail — cameras always write one.
    // exifr reads only the file header (a few KB), not the full image.
    // Works for JPG, RAF, CR2, NEF, ARW, DNG, and most other formats.
    try {
      const preview = await exifr.thumbnail(filePath)
      if (preview) {
        const buf = Buffer.isBuffer(preview) ? preview : Buffer.from(preview)
        const rotation = ORIENTATION_ROTATION[orientation]
        if (rotation) {
          const rotated = await resizeJpegBuffer(buf, rotation)
          if (rotated) {
            await writeFile(thumbPath, rotated)
            return thumbPath
          }
        }
        await writeFile(thumbPath, buf)
        return thumbPath
      }
    } catch {
      // fall through
    }

    const ext = extname(filePath).toLowerCase()

    // RAF fallback: read the full-res embedded JPEG from the binary header
    if (ext === '.raf') {
      const preview = await extractRafJpeg(filePath)
      if (preview) {
        const resized = await resizeJpegBuffer(preview, ORIENTATION_ROTATION[orientation])
        if (resized) {
          await writeFile(thumbPath, resized)
          return thumbPath
        }
      }
      return null
    }

    // Other RAW formats with no embedded thumbnail — skip
    if (RAW_EXTENSIONS.has(ext)) {
      return null
    }

    const image = await Jimp.read(filePath)
    image.cover(THUMB_SIZE, THUMB_SIZE).quality(85)
    const jpegBuffer = await image.getBufferAsync(Jimp.MIME_JPEG)
    await writeFile(thumbPath, jpegBuffer)
    return thumbPath
  } catch (err) {
    console.error('[thumbnail] failed for', filePath, err)
    return null
  }
}

/**
 * Fujifilm RAF: embedded JPEG starts at the offset stored at byte 84 (big-endian uint32).
 * Magic "FUJIFILMCCD-RAW " confirms valid RAF.
 */
async function extractRafJpeg(filePath: string): Promise<Buffer | null> {
  try {
    const { open } = await import('fs/promises')
    const fh = await open(filePath, 'r')
    try {
      // Read just the header to get the JPEG offset + length
      const header = Buffer.alloc(92)
      await fh.read(header, 0, 92, 0)

      if (!header.slice(0, 12).toString('ascii').startsWith('FUJIFILMCCD-')) {
        return null
      }

      const jpegOffset = header.readUInt32BE(84)
      const jpegLength = header.readUInt32BE(88)

      if (jpegOffset === 0 || jpegLength === 0) return null

      // Read the embedded JPEG — cap at 10 MB (it's a full preview, we only need it for thumbnail)
      const readLen = Math.min(jpegLength, 10 * 1024 * 1024)
      const jpegBuf = Buffer.alloc(readLen)
      await fh.read(jpegBuf, 0, readLen, jpegOffset)
      return jpegBuf
    } finally {
      await fh.close()
    }
  } catch (err) {
    console.error('[thumbnail] RAF extract failed', err)
    return null
  }
}

/**
 * Full-size preview for formats the renderer can't display directly.
 * RAF files carry a full-resolution embedded JPEG — extract and cache it.
 * Other RAW formats fall back to the EXIF thumbnail (small, but better than nothing).
 * Returns a path to a cached JPEG, or null if no preview could be produced.
 */
export async function generateFullPreview(
  filePath: string,
  mtimeMs: number
): Promise<string | null> {
  try {
    const dir = getCacheDir()
    await ensureDir(dir)

    const key = thumbKey(filePath, mtimeMs).replace('.jpg', '_full.jpg')
    const previewPath = join(dir, key)
    if (await pathExists(previewPath)) return previewPath

    const ext = extname(filePath).toLowerCase()

    if (ext === '.raf') {
      const jpeg = await extractRafJpeg(filePath)
      if (jpeg) {
        await writeFile(previewPath, jpeg)
        return previewPath
      }
    }

    if (RAW_EXTENSIONS.has(ext)) {
      const preview = await exifr.thumbnail(filePath)
      if (preview) {
        const buf = Buffer.isBuffer(preview) ? preview : Buffer.from(preview)
        await writeFile(previewPath, buf)
        return previewPath
      }
    }

    return null
  } catch (err) {
    console.error('[thumbnail] full preview failed for', filePath, err)
    return null
  }
}

async function resizeJpegBuffer(buf: Buffer, rotation?: number): Promise<Buffer | null> {
  try {
    const image = await Jimp.read(buf)
    if (rotation) image.rotate(rotation)
    image.cover(THUMB_SIZE, THUMB_SIZE).quality(85)
    return await image.getBufferAsync(Jimp.MIME_JPEG)
  } catch (err) {
    console.error('[thumbnail] resize failed', err)
    return null
  }
}

export async function clearThumbnailCache(): Promise<void> {
  const { rm } = await import('fs/promises')
  try {
    await rm(getCacheDir(), { recursive: true, force: true })
  } catch {
    // ignore
  }
}
