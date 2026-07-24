import { createReadStream, createWriteStream } from 'fs'
import { ensureDir, pathExists, remove } from 'fs-extra'
import { stat } from 'fs/promises'
import { createHash } from 'crypto'
import { pipeline } from 'stream/promises'
import { dirname } from 'path'
import { getTargetPath, resolveCollision } from './folder-organizer'
import type { OrganizerOptions } from './folder-organizer'
import type { PhotoMeta } from '../ipc/photos.ipc'

export interface TransferOptions {
  destination: string
  photos: PhotoMeta[]
  deleteOriginal?: boolean
  organizerOptions?: OrganizerOptions
  onProgress: (progress: TransferProgress) => void
}

export interface TransferProgress {
  current: number
  total: number
  currentFile: string
  bytesTransferred: number
  totalBytes: number
  skipped: number
  errors: string[]
}

export interface TransferResult {
  transferred: number
  skipped: number
  errors: string[]
}

export async function transferPhotos(options: TransferOptions): Promise<TransferResult> {
  const { destination, photos, onProgress, deleteOriginal = true, organizerOptions = {} } = options
  let transferred = 0
  let skipped = 0
  const errors: string[] = []
  let bytesTransferred = 0

  const totalBytes = photos.reduce((sum, p) => sum + (p.size ?? 0), 0)

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]

    onProgress({
      current: i + 1,
      total: photos.length,
      currentFile: photo.filename,
      bytesTransferred,
      totalBytes,
      skipped,
      errors
    })

    try {
      const targetPath = getTargetPath(destination, photo.path, photo.dateTaken, organizerOptions)
      const finalPath = await resolveCollision(targetPath)

      await ensureDir(dirname(finalPath))

      // A file with the same name already exists at the destination.
      // Only treat it as a duplicate if the contents actually match.
      if (await pathExists(targetPath)) {
        const srcStat = await stat(photo.path)
        const dstStat = await stat(targetPath)
        if (srcStat.size === dstStat.size && (await filesIdentical(photo.path, targetPath))) {
          if (deleteOriginal) await remove(photo.path)
          skipped++
          bytesTransferred += photo.size ?? 0
          continue
        }
      }

      await copyFileVerified(photo.path, finalPath, (bytes) => {
        bytesTransferred += bytes
      })

      // Only remove the source once the copy is verified on disk
      if (deleteOriginal) await remove(photo.path)
      transferred++
    } catch (err) {
      errors.push(`${photo.filename}: ${(err as Error).message}`)
    }
  }

  onProgress({
    current: photos.length,
    total: photos.length,
    currentFile: '',
    bytesTransferred,
    totalBytes,
    skipped,
    errors
  })

  return { transferred, skipped, errors }
}

/**
 * Copy src → dest, reporting progress, then verify the written size matches
 * the source. On any failure the partial destination file is removed so a
 * broken copy can never be mistaken for a completed one.
 */
async function copyFileVerified(
  src: string,
  dest: string,
  onBytes: (bytes: number) => void
): Promise<void> {
  try {
    const readStream = createReadStream(src)
    const writeStream = createWriteStream(dest)

    readStream.on('data', (chunk: string | Buffer) => {
      onBytes(typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length)
    })

    await pipeline(readStream, writeStream)

    const [srcStat, dstStat] = await Promise.all([stat(src), stat(dest)])
    if (srcStat.size !== dstStat.size) {
      throw new Error(
        `copy verification failed (${dstStat.size} of ${srcStat.size} bytes written)`
      )
    }
  } catch (err) {
    await remove(dest).catch(() => {})
    throw err
  }
}

/** Compare two files byte-for-byte via streaming SHA-1. */
export async function filesIdentical(a: string, b: string): Promise<boolean> {
  const [hashA, hashB] = await Promise.all([hashFile(a), hashFile(b)])
  return hashA === hashB
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha1')
  await pipeline(createReadStream(path), hash)
  return hash.digest('hex')
}

export async function deletePhotos(paths: string[]): Promise<{ deleted: number; errors: string[] }> {
  let deleted = 0
  const errors: string[] = []

  for (const p of paths) {
    try {
      if (await pathExists(p)) {
        await remove(p)
        deleted++
      }
    } catch (err) {
      errors.push(`${p}: ${(err as Error).message}`)
    }
  }

  return { deleted, errors }
}
