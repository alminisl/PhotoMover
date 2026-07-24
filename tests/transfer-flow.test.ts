// End-to-end simulation of the core workflow: photos land on an "SD card",
// thumbnails are generated for the review grid, then the tagged photos are
// moved to the "HDD" organized by date — exactly what the app does.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdtemp, rm, stat, readFile, readdir } from 'fs/promises'
import { pathExists } from 'fs-extra'
import Jimp from 'jimp'

const CACHE_ROOT = join(tmpdir(), 'photomover-flow-test-cache')

vi.mock('electron', () => ({
  app: { getPath: () => CACHE_ROOT }
}))

import { generateThumbnail, clearThumbnailCache } from '../src/main/services/thumbnail'
import { transferPhotos } from '../src/main/services/file-transfer'
import type { PhotoMeta } from '../src/main/ipc/photos.ipc'

let sdCard: string
let hdd: string

beforeAll(async () => {
  sdCard = await mkdtemp(join(tmpdir(), 'flow-sdcard-'))
  hdd = await mkdtemp(join(tmpdir(), 'flow-hdd-'))
})

afterAll(async () => {
  await clearThumbnailCache()
  await rm(sdCard, { recursive: true, force: true })
  await rm(hdd, { recursive: true, force: true })
  await rm(CACHE_ROOT, { recursive: true, force: true })
})

async function shoot(name: string, color: number, dateTaken: Date | null): Promise<PhotoMeta> {
  const path = join(sdCard, name)
  await new Jimp(640, 480, color).quality(90).writeAsync(path)
  const stats = await stat(path)
  return {
    id: Buffer.from(path).toString('base64'),
    path,
    filename: name,
    size: stats.size,
    dateTaken,
    make: null,
    model: null,
    width: 640,
    height: 480,
    thumbnailData: null,
    iso: null,
    fNumber: null,
    exposureTime: null,
    focalLength: null
  }
}

describe('SD card → HDD workflow', () => {
  it('generates preview thumbnails, then moves the photos organized by date', async () => {
    const photos = [
      await shoot('IMG_0001.jpg', 0xcc3333ff, new Date(2024, 3, 15)),
      await shoot('IMG_0002.jpg', 0x33cc33ff, new Date(2024, 3, 16)),
      await shoot('IMG_0003.jpg', 0x3333ccff, null)
    ]
    const originals = new Map<string, Buffer>()
    for (const p of photos) {
      originals.set(p.filename, await readFile(p.path))
    }

    // Step 1: review grid — thumbnails must show up for every photo
    for (const p of photos) {
      const stats = await stat(p.path)
      const thumbPath = await generateThumbnail(p.path, stats.mtimeMs)
      expect(thumbPath, `thumbnail for ${p.filename}`).not.toBeNull()
      const thumb = await readFile(thumbPath!)
      expect(thumb[0]).toBe(0xff) // valid JPEG
      expect(thumb[1]).toBe(0xd8)
    }

    // Step 2: transfer — move everything to the HDD
    const result = await transferPhotos({
      destination: hdd,
      photos,
      onProgress: () => {}
    })

    expect(result.transferred).toBe(3)
    expect(result.errors).toHaveLength(0)

    // Photos landed date-organized, byte-identical to the originals
    const moved = [
      { file: 'IMG_0001.jpg', at: join(hdd, '2024', 'April', 'IMG_0001.jpg') },
      { file: 'IMG_0002.jpg', at: join(hdd, '2024', 'April', 'IMG_0002.jpg') },
      { file: 'IMG_0003.jpg', at: join(hdd, 'Unsorted', 'IMG_0003.jpg') }
    ]
    for (const { file, at } of moved) {
      expect(await pathExists(at), `${file} at ${at}`).toBe(true)
      expect((await readFile(at)).equals(originals.get(file)!), `${file} intact`).toBe(true)
    }

    // The "SD card" is empty — this is a move, not a copy
    expect(await readdir(sdCard)).toHaveLength(0)
  })
})
