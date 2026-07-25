import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'fs/promises'
import { pathExists } from 'fs-extra'
import { transferPhotos, discardPhotos, filesIdentical } from '../src/main/services/file-transfer'
import type { TransferProgress } from '../src/main/services/file-transfer'
import type { PhotoMeta } from '../src/main/ipc/photos.ipc'

let sdCard: string
let hdd: string

beforeEach(async () => {
  sdCard = await mkdtemp(join(tmpdir(), 'sdcard-'))
  hdd = await mkdtemp(join(tmpdir(), 'hdd-'))
})

afterEach(async () => {
  await rm(sdCard, { recursive: true, force: true })
  await rm(hdd, { recursive: true, force: true })
})

async function addPhoto(
  filename: string,
  content: string,
  dateTaken: Date | null
): Promise<PhotoMeta> {
  const path = join(sdCard, filename)
  await writeFile(path, content)
  return {
    id: Buffer.from(path).toString('base64'),
    path,
    filename,
    size: Buffer.byteLength(content),
    dateTaken,
    make: null,
    model: null,
    width: null,
    height: null,
    thumbnailData: null,
    iso: null,
    fNumber: null,
    exposureTime: null,
    focalLength: null
  }
}

const noProgress = (): void => {}

describe('transferPhotos', () => {
  it('moves photos into date-organized folders and removes the originals', async () => {
    const photos = [
      await addPhoto('IMG_0001.jpg', 'first photo bytes', new Date(2024, 3, 15)),
      await addPhoto('IMG_0002.jpg', 'second photo bytes', new Date(2023, 11, 24)),
      await addPhoto('IMG_0003.jpg', 'no exif date here', null)
    ]

    const result = await transferPhotos({ destination: hdd, photos, onProgress: noProgress })

    expect(result).toEqual({ transferred: 3, skipped: 0, errors: [] })
    expect(await readFile(join(hdd, '2024', 'April', 'IMG_0001.jpg'), 'utf8')).toBe('first photo bytes')
    expect(await readFile(join(hdd, '2023', 'December', 'IMG_0002.jpg'), 'utf8')).toBe('second photo bytes')
    expect(await readFile(join(hdd, 'Unsorted', 'IMG_0003.jpg'), 'utf8')).toBe('no exif date here')
    for (const p of photos) {
      expect(await pathExists(p.path)).toBe(false)
    }
  })

  it('reports byte-level progress adding up to the total', async () => {
    const photos = [
      await addPhoto('a.jpg', 'aaaaaaaaaa', new Date(2024, 0, 1)),
      await addPhoto('b.jpg', 'bbbbb', new Date(2024, 0, 1))
    ]
    const updates: TransferProgress[] = []

    await transferPhotos({ destination: hdd, photos, onProgress: (p) => updates.push({ ...p }) })

    const last = updates[updates.length - 1]
    expect(last.totalBytes).toBe(15)
    expect(last.bytesTransferred).toBe(15)
    expect(last.current).toBe(2)
  })

  it('skips true duplicates (same name, same content) and deletes the source', async () => {
    const photo = await addPhoto('IMG_0001.jpg', 'identical content', new Date(2024, 3, 15))
    const existing = join(hdd, '2024', 'April', 'IMG_0001.jpg')
    await mkdir(join(hdd, '2024', 'April'), { recursive: true })
    await writeFile(existing, 'identical content')

    const result = await transferPhotos({ destination: hdd, photos: [photo], onProgress: noProgress })

    expect(result).toEqual({ transferred: 0, skipped: 1, errors: [] })
    expect(await pathExists(photo.path)).toBe(false)
    expect(await pathExists(join(hdd, '2024', 'April', 'IMG_0001_1.jpg'))).toBe(false)
  })

  it('renames instead of skipping when same-size files differ in content', async () => {
    const photo = await addPhoto('IMG_0001.jpg', 'CONTENT-A', new Date(2024, 3, 15))
    await mkdir(join(hdd, '2024', 'April'), { recursive: true })
    await writeFile(join(hdd, '2024', 'April', 'IMG_0001.jpg'), 'CONTENT-B')

    const result = await transferPhotos({ destination: hdd, photos: [photo], onProgress: noProgress })

    expect(result.transferred).toBe(1)
    expect(result.skipped).toBe(0)
    expect(await readFile(join(hdd, '2024', 'April', 'IMG_0001.jpg'), 'utf8')).toBe('CONTENT-B')
    expect(await readFile(join(hdd, '2024', 'April', 'IMG_0001_1.jpg'), 'utf8')).toBe('CONTENT-A')
  })

  it('keeps the source files when deleteOriginal is false', async () => {
    const photo = await addPhoto('IMG_0001.jpg', 'copy me', new Date(2024, 3, 15))

    await transferPhotos({
      destination: hdd,
      photos: [photo],
      deleteOriginal: false,
      onProgress: noProgress
    })

    expect(await pathExists(photo.path)).toBe(true)
    expect(await pathExists(join(hdd, '2024', 'April', 'IMG_0001.jpg'))).toBe(true)
  })

  it('records an error for a missing source and continues with the rest', async () => {
    const missing = await addPhoto('gone.jpg', 'x', new Date(2024, 0, 1))
    await rm(missing.path)
    const good = await addPhoto('ok.jpg', 'still here', new Date(2024, 0, 1))

    const result = await transferPhotos({
      destination: hdd,
      photos: [missing, good],
      onProgress: noProgress
    })

    expect(result.transferred).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('gone.jpg')
    expect(await pathExists(join(hdd, '2024', 'January', 'ok.jpg'))).toBe(true)
  })

  it('respects organizer options end to end', async () => {
    const raw = await addPhoto('DSC_1.raf', 'raw bytes', new Date(2024, 5, 9))

    await transferPhotos({
      destination: hdd,
      photos: [raw],
      organizerOptions: { organizeByDay: true, separateRaw: true },
      onProgress: noProgress
    })

    expect(await pathExists(join(hdd, '2024', 'June', '09', 'RAW', 'DSC_1.raf'))).toBe(true)
  })
})

describe('filesIdentical', () => {
  it('detects identical and differing files', async () => {
    const a = join(sdCard, 'a.bin')
    const b = join(sdCard, 'b.bin')
    const c = join(sdCard, 'c.bin')
    await writeFile(a, 'same bytes')
    await writeFile(b, 'same bytes')
    await writeFile(c, 'diff bytes')

    expect(await filesIdentical(a, b)).toBe(true)
    expect(await filesIdentical(a, c)).toBe(false)
  })
})

describe('discardPhotos', () => {
  it('permanently deletes when no rejects folder is given', async () => {
    const photo = await addPhoto('trash.jpg', 'delete me', null)

    const result = await discardPhotos([photo.path, join(sdCard, 'never-existed.jpg')])

    expect(result.deleted).toBe(1)
    expect(result.errors).toHaveLength(0)
    expect(result.movedTo).toBeNull()
    expect(await pathExists(photo.path)).toBe(false)
  })

  it('moves rejects into the rejects folder instead of erasing them', async () => {
    const rejects = join(hdd, '_Rejects')
    const photo = await addPhoto('reject.jpg', 'blurry shot', null)

    const result = await discardPhotos([photo.path], rejects)

    expect(result.deleted).toBe(1)
    expect(result.movedTo).toBe(rejects)
    expect(await pathExists(photo.path)).toBe(false)
    expect(await readFile(join(rejects, 'reject.jpg'), 'utf8')).toBe('blurry shot')
  })

  it('renames on name collision so no reject overwrites another', async () => {
    const rejects = join(hdd, '_Rejects')
    await mkdir(rejects, { recursive: true })
    await writeFile(join(rejects, 'IMG_1.jpg'), 'earlier reject')
    const photo = await addPhoto('IMG_1.jpg', 'newer reject!!', null)

    await discardPhotos([photo.path], rejects)

    expect(await readFile(join(rejects, 'IMG_1.jpg'), 'utf8')).toBe('earlier reject')
    expect(await readFile(join(rejects, 'IMG_1_1.jpg'), 'utf8')).toBe('newer reject!!')
  })

  it('skips the copy when an identical reject already exists', async () => {
    const rejects = join(hdd, '_Rejects')
    await mkdir(rejects, { recursive: true })
    await writeFile(join(rejects, 'dup.jpg'), 'same bytes here')
    const photo = await addPhoto('dup.jpg', 'same bytes here', null)

    const result = await discardPhotos([photo.path], rejects)

    expect(result.deleted).toBe(1)
    expect(await pathExists(photo.path)).toBe(false)
    expect(await pathExists(join(rejects, 'dup_1.jpg'))).toBe(false)
  })

  it('keeps the source if the move to rejects fails', async () => {
    const photo = await addPhoto('precious.jpg', 'do not lose me', null)
    // a file where the rejects *directory* should be makes ensureDir fail
    const blocked = join(hdd, 'blocked')
    await writeFile(blocked, 'in the way')

    const result = await discardPhotos([photo.path], blocked)

    expect(result.deleted).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(await pathExists(photo.path)).toBe(true)
  })
})
