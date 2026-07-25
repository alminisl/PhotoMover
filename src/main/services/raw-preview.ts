import { open } from 'fs/promises'
import type { FileHandle } from 'fs/promises'

// Largest embedded preview we'll accept — full-res previews are typically 1-15 MB
const MAX_PREVIEW_BYTES = 40 * 1024 * 1024
const CR3_SCAN_BYTES = 10 * 1024 * 1024

interface JpegRef {
  offset: number
  length: number
}

/**
 * Extract the largest embedded JPEG preview from a RAW file.
 *
 * TIFF-based formats (CR2, NEF, ARW, DNG and friends) store previews either as
 * JPEGInterchangeFormat pointers (tags 0x0201/0x0202) or as JPEG-compressed
 * strips (0x0111/0x0117 with compression 6 or 7), spread across IFD0, chained
 * IFDs, and SubIFDs. We walk them all and take the biggest JPEG that validates.
 *
 * CR3 is ISO-BMFF (MP4-style boxes); Canon stores a preview JPEG in a PRVW box
 * near the start of the file.
 *
 * Returns null whenever anything looks off — callers fall back to the small
 * EXIF thumbnail.
 */
export async function extractEmbeddedJpeg(filePath: string): Promise<Buffer | null> {
  let fh: FileHandle | null = null
  try {
    fh = await open(filePath, 'r')
    const header = Buffer.alloc(16)
    const { bytesRead } = await fh.read(header, 0, 16, 0)
    if (bytesRead < 16) return null

    if (header.slice(4, 8).toString('ascii') === 'ftyp') {
      return await extractIsoBmffPreview(fh)
    }
    return await extractTiffPreview(fh, header)
  } catch {
    return null
  } finally {
    await fh?.close().catch(() => {})
  }
}

async function extractTiffPreview(fh: FileHandle, header: Buffer): Promise<Buffer | null> {
  const le = header[0] === 0x49 && header[1] === 0x49
  const be = header[0] === 0x4d && header[1] === 0x4d
  if (!le && !be) return null

  const read16 = (buf: Buffer, off: number): number =>
    le ? buf.readUInt16LE(off) : buf.readUInt16BE(off)
  const read32 = (buf: Buffer, off: number): number =>
    le ? buf.readUInt32LE(off) : buf.readUInt32BE(off)

  const candidates: JpegRef[] = []
  const visited = new Set<number>()

  async function walkIfd(offset: number, depth: number): Promise<void> {
    if (depth > 6 || offset <= 0 || visited.has(offset)) return
    visited.add(offset)

    const countBuf = Buffer.alloc(2)
    const r = await fh.read(countBuf, 0, 2, offset)
    if (r.bytesRead < 2) return
    const count = read16(countBuf, 0)
    if (count === 0 || count > 512) return

    const entries = Buffer.alloc(count * 12 + 4)
    const er = await fh.read(entries, 0, entries.length, offset + 2)
    if (er.bytesRead < count * 12) return

    let jpegOffset = -1
    let jpegLength = -1
    let stripOffset = -1
    let stripCount = -1
    let compression = -1

    for (let i = 0; i < count; i++) {
      const e = i * 12
      const tag = read16(entries, e)
      const type = read16(entries, e + 2)
      const num = read32(entries, e + 4)
      const long = read32(entries, e + 8)
      const short = read16(entries, e + 8)
      const scalar = type === 3 ? short : long

      switch (tag) {
        case 0x0103: // Compression
          compression = scalar
          break
        case 0x0111: // StripOffsets
          if (num === 1) stripOffset = scalar
          break
        case 0x0117: // StripByteCounts
          if (num === 1) stripCount = scalar
          break
        case 0x0201: // JPEGInterchangeFormat
          jpegOffset = long
          break
        case 0x0202: // JPEGInterchangeFormatLength
          jpegLength = long
          break
        case 0x014a: {
          // SubIFDs: count 1 stores the offset inline; more are pointed to
          if (num === 1) {
            await walkIfd(long, depth + 1)
          } else if (num <= 8) {
            const sub = Buffer.alloc(num * 4)
            const sr = await fh.read(sub, 0, sub.length, long)
            if (sr.bytesRead === sub.length) {
              for (let k = 0; k < num; k++) await walkIfd(read32(sub, k * 4), depth + 1)
            }
          }
          break
        }
      }
    }

    if (jpegOffset > 0 && jpegLength > 0) candidates.push({ offset: jpegOffset, length: jpegLength })
    // Old-JPEG (6) and JPEG (7) compressed strips are whole JPEG streams (CR2 full preview)
    if (stripOffset > 0 && stripCount > 0 && (compression === 6 || compression === 7)) {
      candidates.push({ offset: stripOffset, length: stripCount })
    }

    const next = read32(entries, count * 12)
    await walkIfd(next, depth + 1)
  }

  await walkIfd(read32(header, 4), 0)

  candidates.sort((a, b) => b.length - a.length)
  for (const c of candidates) {
    if (c.length < 4 || c.length > MAX_PREVIEW_BYTES) continue
    const buf = Buffer.alloc(c.length)
    const { bytesRead } = await fh.read(buf, 0, c.length, c.offset)
    if (bytesRead === c.length && buf[0] === 0xff && buf[1] === 0xd8) return buf
  }
  return null
}

/** CR3: scan the leading boxes for Canon's PRVW box and pull its JPEG payload. */
async function extractIsoBmffPreview(fh: FileHandle): Promise<Buffer | null> {
  const stats = await fh.stat()
  const scanLen = Math.min(stats.size, CR3_SCAN_BYTES)
  const buf = Buffer.alloc(scanLen)
  const { bytesRead } = await fh.read(buf, 0, scanLen, 0)
  const data = buf.slice(0, bytesRead)

  const marker = data.indexOf('PRVW', 0, 'ascii')
  if (marker < 4) return null

  const boxStart = marker - 4
  const boxSize = data.readUInt32BE(boxStart)
  if (boxSize <= 8 || boxSize > MAX_PREVIEW_BYTES) return null
  const boxEnd = Math.min(boxStart + boxSize, data.length)

  // JPEG starts a fixed few bytes into the box; scan a small window to be safe
  for (let p = marker + 4; p < Math.min(marker + 64, boxEnd - 1); p++) {
    if (data[p] === 0xff && data[p + 1] === 0xd8) {
      return Buffer.from(data.slice(p, boxEnd))
    }
  }
  return null
}
