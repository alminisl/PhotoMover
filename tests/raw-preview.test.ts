import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdtemp, rm, writeFile, stat, readFile } from 'fs/promises'
import Jimp from 'jimp'

const CACHE_ROOT = join(tmpdir(), 'photomover-rawpreview-test-cache')

vi.mock('electron', () => ({
  app: { getPath: () => CACHE_ROOT }
}))

import { extractEmbeddedJpeg } from '../src/main/services/raw-preview'
import { generateFullPreview } from '../src/main/services/thumbnail'

let dir: string
let realJpeg: Buffer

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'rawpreview-'))
  realJpeg = await new Jimp(320, 240, 0x2266aaff).quality(85).getBufferAsync(Jimp.MIME_JPEG)
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
  await rm(CACHE_ROOT, { recursive: true, force: true })
})

function leEntry(tag: number, type: number, count: number, value: number): Buffer {
  const b = Buffer.alloc(12)
  b.writeUInt16LE(tag, 0)
  b.writeUInt16LE(type, 2)
  b.writeUInt32LE(count, 4)
  if (type === 3) b.writeUInt16LE(value, 8)
  else b.writeUInt32LE(value, 8)
  return b
}

function beEntry(tag: number, type: number, count: number, value: number): Buffer {
  const b = Buffer.alloc(12)
  b.writeUInt16BE(tag, 0)
  b.writeUInt16BE(type, 2)
  b.writeUInt32BE(count, 4)
  if (type === 3) b.writeUInt16BE(value, 8)
  else b.writeUInt32BE(value, 8)
  return b
}

/** Little-endian TIFF whose IFD0 points at `jpeg` via JPEGInterchangeFormat. */
function tiffWithPointerPreview(jpeg: Buffer): Buffer {
  const header = Buffer.alloc(8)
  header.write('II', 0, 'ascii')
  header.writeUInt16LE(42, 2)
  header.writeUInt32LE(8, 4)
  // IFD0 at 8: count(2) + 2 entries(24) + next(4) = 30 → jpeg at 38
  const jpegOffset = 38
  const ifd = Buffer.concat([
    Buffer.from([2, 0]),
    leEntry(0x0201, 4, 1, jpegOffset),
    leEntry(0x0202, 4, 1, jpeg.length),
    Buffer.alloc(4)
  ])
  return Buffer.concat([header, ifd, jpeg])
}

/** Big-endian variant of the same layout. */
function beTiffWithPointerPreview(jpeg: Buffer): Buffer {
  const header = Buffer.alloc(8)
  header.write('MM', 0, 'ascii')
  header.writeUInt16BE(42, 2)
  header.writeUInt32BE(8, 4)
  const jpegOffset = 38
  const count = Buffer.alloc(2)
  count.writeUInt16BE(2, 0)
  const ifd = Buffer.concat([
    count,
    beEntry(0x0201, 4, 1, jpegOffset),
    beEntry(0x0202, 4, 1, jpeg.length),
    Buffer.alloc(4)
  ])
  return Buffer.concat([header, ifd, jpeg])
}

/**
 * NEF/CR2-style layout: IFD0 holds a small thumbnail pointer plus a SubIFD
 * whose JPEG-compressed strip is the full-size preview. The extractor must
 * pick the bigger one.
 */
function tiffWithSubIfdPreview(smallJpeg: Buffer, bigJpeg: Buffer): Buffer {
  const header = Buffer.alloc(8)
  header.write('II', 0, 'ascii')
  header.writeUInt16LE(42, 2)
  header.writeUInt32LE(8, 4)
  // IFD0 at 8: count + 3 entries + next = 2 + 36 + 4 = 42 → subIFD at 50
  const subIfdOffset = 50
  // subIFD: 2 + 36 + 4 = 42 → small jpeg at 92, big jpeg after it
  const smallOffset = 92
  const bigOffset = smallOffset + smallJpeg.length
  const ifd0 = Buffer.concat([
    Buffer.from([3, 0]),
    leEntry(0x0201, 4, 1, smallOffset),
    leEntry(0x0202, 4, 1, smallJpeg.length),
    leEntry(0x014a, 4, 1, subIfdOffset),
    Buffer.alloc(4)
  ])
  const subIfd = Buffer.concat([
    Buffer.from([3, 0]),
    leEntry(0x0103, 3, 1, 7), // Compression = JPEG
    leEntry(0x0111, 4, 1, bigOffset),
    leEntry(0x0117, 4, 1, bigJpeg.length),
    Buffer.alloc(4)
  ])
  return Buffer.concat([header, ifd0, subIfd, smallJpeg, bigJpeg])
}

/** Minimal CR3-style ISO-BMFF file with a PRVW box holding the JPEG. */
function cr3WithPreview(jpeg: Buffer): Buffer {
  const ftyp = Buffer.alloc(16)
  ftyp.writeUInt32BE(16, 0)
  ftyp.write('ftypcrx ', 4, 'ascii')
  const junk = 6
  const boxSize = 8 + junk + jpeg.length
  const prvw = Buffer.alloc(8 + junk)
  prvw.writeUInt32BE(boxSize, 0)
  prvw.write('PRVW', 4, 'ascii')
  return Buffer.concat([ftyp, prvw, jpeg])
}

describe('extractEmbeddedJpeg', () => {
  it('extracts a pointer-style preview from a little-endian TIFF RAW', async () => {
    const path = join(dir, 'pointer.nef')
    await writeFile(path, tiffWithPointerPreview(realJpeg))
    const result = await extractEmbeddedJpeg(path)
    expect(result).not.toBeNull()
    expect(result!.equals(realJpeg)).toBe(true)
  })

  it('extracts from a big-endian TIFF RAW', async () => {
    const path = join(dir, 'bigendian.arw')
    await writeFile(path, beTiffWithPointerPreview(realJpeg))
    const result = await extractEmbeddedJpeg(path)
    expect(result).not.toBeNull()
    expect(result!.equals(realJpeg)).toBe(true)
  })

  it('prefers the largest preview across SubIFDs', async () => {
    const smallJpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(500, 7)])
    const path = join(dir, 'subifd.cr2')
    await writeFile(path, tiffWithSubIfdPreview(smallJpeg, realJpeg))
    const result = await extractEmbeddedJpeg(path)
    expect(result).not.toBeNull()
    expect(result!.equals(realJpeg)).toBe(true)
  })

  it('extracts the PRVW payload from a CR3-style container', async () => {
    const path = join(dir, 'canon.cr3')
    await writeFile(path, cr3WithPreview(realJpeg))
    const result = await extractEmbeddedJpeg(path)
    expect(result).not.toBeNull()
    expect(result!.equals(realJpeg)).toBe(true)
  })

  it('returns null for files that are not RAW at all', async () => {
    const path = join(dir, 'garbage.nef')
    await writeFile(path, 'this is just text pretending to be a nef')
    expect(await extractEmbeddedJpeg(path)).toBeNull()
  })
})

describe('generateFullPreview with embedded RAW previews', () => {
  it('serves the full embedded JPEG for a TIFF-based RAW', async () => {
    const path = join(dir, 'full.nef')
    await writeFile(path, tiffWithPointerPreview(realJpeg))
    const { mtimeMs } = await stat(path)

    const previewPath = await generateFullPreview(path, mtimeMs)

    expect(previewPath).not.toBeNull()
    expect((await readFile(previewPath!)).equals(realJpeg)).toBe(true)
  })
})
