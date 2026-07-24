import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdtemp, rm, stat, readFile } from 'fs/promises'
import Jimp from 'jimp'

const CACHE_ROOT = join(tmpdir(), 'photomover-thumb-test-cache')

vi.mock('electron', () => ({
  app: { getPath: () => CACHE_ROOT }
}))

// Import after the electron mock so app.getPath resolves to the test cache
import { generateThumbnail, generateFullPreview, clearThumbnailCache } from '../src/main/services/thumbnail'

let photoDir: string

beforeAll(async () => {
  photoDir = await mkdtemp(join(tmpdir(), 'photos-'))
})

afterAll(async () => {
  await clearThumbnailCache()
  await rm(photoDir, { recursive: true, force: true })
  await rm(CACHE_ROOT, { recursive: true, force: true })
})

async function createJpeg(name: string, width = 320, height = 240, color = 0x3366ffff): Promise<string> {
  const path = join(photoDir, name)
  const image = new Jimp(width, height, color)
  await image.quality(90).writeAsync(path)
  return path
}

describe('generateThumbnail', () => {
  it('produces a JPEG thumbnail for a plain image', async () => {
    const src = await createJpeg('landscape.jpg')
    const { mtimeMs } = await stat(src)

    const thumbPath = await generateThumbnail(src, mtimeMs)

    expect(thumbPath).not.toBeNull()
    const buf = await readFile(thumbPath!)
    // JPEG magic bytes
    expect(buf[0]).toBe(0xff)
    expect(buf[1]).toBe(0xd8)

    const thumb = await Jimp.read(thumbPath!)
    expect(thumb.getWidth()).toBe(220)
    expect(thumb.getHeight()).toBe(220)
  })

  it('returns the cached file on a second call', async () => {
    const src = await createJpeg('cached.jpg')
    const { mtimeMs } = await stat(src)

    const first = await generateThumbnail(src, mtimeMs)
    const firstStat = await stat(first!)
    const second = await generateThumbnail(src, mtimeMs)

    expect(second).toBe(first)
    expect((await stat(second!)).mtimeMs).toBe(firstStat.mtimeMs)
  })

  it('returns null for a file that is not an image', async () => {
    const bogus = join(photoDir, 'not-a-photo.jpg')
    await (await import('fs/promises')).writeFile(bogus, 'plain text, not an image')
    const { mtimeMs } = await stat(bogus)

    expect(await generateThumbnail(bogus, mtimeMs)).toBeNull()
  })
})

describe('generateFullPreview', () => {
  it('returns null for formats the renderer already displays natively', async () => {
    const src = await createJpeg('native.jpg')
    const { mtimeMs } = await stat(src)

    expect(await generateFullPreview(src, mtimeMs)).toBeNull()
  })

  it('returns null for a RAW file without an embedded preview', async () => {
    const bogusRaw = join(photoDir, 'empty.nef')
    await (await import('fs/promises')).writeFile(bogusRaw, 'not really a nef')
    const { mtimeMs } = await stat(bogusRaw)

    expect(await generateFullPreview(bogusRaw, mtimeMs)).toBeNull()
  })
})
