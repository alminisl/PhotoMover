import { createReadStream, createWriteStream } from 'fs'
import { ensureDir, pathExists, remove } from 'fs-extra'
import { stat } from 'fs/promises'
import { pipeline } from 'stream/promises'
import { getTargetPath, resolveCollision } from './folder-organizer'
import type { PhotoMeta } from '../ipc/photos.ipc'

export interface TransferOptions {
  destination: string
  photos: PhotoMeta[]
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
  const { destination, photos, onProgress } = options
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
      const targetPath = getTargetPath(destination, photo.path, photo.dateTaken)
      const finalPath = await resolveCollision(targetPath)

      await ensureDir(finalPath.replace(/[^/\\]*$/, ''))

      // Check if identical file already exists at target
      if (await pathExists(targetPath)) {
        const srcStat = await stat(photo.path)
        const dstStat = await stat(targetPath)
        if (srcStat.size === dstStat.size) {
          await remove(photo.path)
          skipped++
          bytesTransferred += photo.size ?? 0
          continue
        }
      }

      await copyFileWithProgress(photo.path, finalPath, (bytes) => {
        bytesTransferred += bytes
      })

      await remove(photo.path)
      transferred++
    } catch (err) {
      errors.push(`${photo.filename}: ${(err as Error).message}`)
    }
  }

  return { transferred, skipped, errors }
}

async function copyFileWithProgress(
  src: string,
  dest: string,
  onBytes: (bytes: number) => void
): Promise<void> {
  const readStream = createReadStream(src)
  const writeStream = createWriteStream(dest)

  readStream.on('data', (chunk: Buffer) => {
    onBytes(chunk.length)
  })

  await pipeline(readStream, writeStream)
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
