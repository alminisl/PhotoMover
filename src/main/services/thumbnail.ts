import { join, extname } from 'path'
import { app } from 'electron'
import { ensureDir, pathExists, writeFile } from 'fs-extra'
import { createHash } from 'crypto'
// Use the full exifr bundle — the default lite bundle doesn't support RAF/RAW thumbnail extraction
// eslint-disable-next-line @typescript-eslint/no-require-imports
const exifr = require('exifr/dist/full.umd.cjs')
import Jimp from 'jimp'

// Raise jimp's bitmap memory cap so large/high-res images don't get rejected
Jimp.MAX_BITMAP_SIZE = 600 * 1024 * 1024  // 600 MB

const THUMB_SIZE = 320
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

export async function generateThumbnail(
  filePath: string,
  mtimeMs: number
): Promise<string | null> {
  try {
    const dir = getCacheDir()
    await ensureDir(dir)

    const key = thumbKey(filePath, mtimeMs)
    const thumbPath = join(dir, key)

    if (await pathExists(thumbPath)) {
      return thumbPath
    }

    const ext = extname(filePath).toLowerCase()
    const isRaw = RAW_EXTENSIONS.has(ext)

    if (isRaw) {
      const preview = ext === '.raf'
        ? await extractRafJpeg(filePath)
        : await extractExifrJpeg(filePath)

      if (preview) {
        const resized = await resizeJpegBuffer(preview)
        if (resized) {
          await writeFile(thumbPath, resized)
          return thumbPath
        }
      }
      return null
    }

    // For regular images, use jimp
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

/** For other RAW formats (CR2, NEF, ARW, etc.) — use exifr full bundle */
async function extractExifrJpeg(filePath: string): Promise<Buffer | null> {
  try {
    const preview = await exifr.thumbnail(filePath)
    if (!preview) return null
    return Buffer.isBuffer(preview) ? preview : Buffer.from(preview)
  } catch {
    return null
  }
}

async function resizeJpegBuffer(buf: Buffer): Promise<Buffer | null> {
  try {
    const image = await Jimp.read(buf)
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
