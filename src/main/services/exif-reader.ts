// eslint-disable-next-line @typescript-eslint/no-require-imports
const exifr = require('exifr/dist/full.umd.cjs')
import { stat, open } from 'fs/promises'
import { extname } from 'path'

export interface PhotoExif {
  dateTaken: Date | null
  make: string | null
  model: string | null
  width: number | null
  height: number | null
  orientation: number
  iso: number | null
  fNumber: number | null
  exposureTime: number | null
  focalLength: number | null
}

/** Read the embedded JPEG from a RAF file and parse its EXIF */
async function readRafExif(filePath: string): Promise<PhotoExif | null> {
  try {
    const fh = await open(filePath, 'r')
    try {
      const header = Buffer.alloc(92)
      await fh.read(header, 0, 92, 0)
      if (!header.slice(0, 12).toString('ascii').startsWith('FUJIFILMCCD-')) return null

      const jpegOffset = header.readUInt32BE(84)
      const jpegLength = Math.min(header.readUInt32BE(88), 2 * 1024 * 1024) // 2MB cap for EXIF read
      if (jpegOffset === 0 || jpegLength === 0) return null

      const jpegBuf = Buffer.alloc(jpegLength)
      await fh.read(jpegBuf, 0, jpegLength, jpegOffset)
      return await parseExifBuffer(jpegBuf)
    } finally {
      await fh.close()
    }
  } catch {
    return null
  }
}

async function parseExifBuffer(buf: Buffer): Promise<PhotoExif | null> {
  try {
    const data = await exifr.parse(buf, {
      tiff: true, exif: true, gps: false, icc: false, iptc: false, jfif: false,
      pick: ['DateTimeOriginal', 'CreateDate', 'Make', 'Model',
             'ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight',
             'Orientation', 'ISO', 'FNumber', 'ExposureTime', 'FocalLength']
    })
    if (!data) return null
    const dateTaken = data.DateTimeOriginal ?? data.CreateDate ?? null
    return {
      dateTaken: dateTaken instanceof Date ? dateTaken : dateTaken ? new Date(dateTaken) : null,
      make: data.Make ?? null, model: data.Model ?? null,
      width: data.ExifImageWidth ?? data.ImageWidth ?? null,
      height: data.ExifImageHeight ?? data.ImageHeight ?? null,
      orientation: data.Orientation ?? 1,
      iso: data.ISO ?? null, fNumber: data.FNumber ?? null,
      exposureTime: data.ExposureTime ?? null, focalLength: data.FocalLength ?? null
    }
  } catch {
    return null
  }
}

export async function readExif(filePath: string): Promise<PhotoExif> {
  // RAF: exifr can't parse the RAF wrapper — extract the embedded JPEG first
  if (extname(filePath).toLowerCase() === '.raf') {
    const result = await readRafExif(filePath)
    if (result) return result
  }

  try {
    const data = await exifr.parse(filePath, {
      tiff: true,
      exif: true,
      gps: false,
      icc: false,
      iptc: false,
      jfif: false,
      pick: [
        'DateTimeOriginal', 'CreateDate', 'Make', 'Model',
        'ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight',
        'Orientation', 'ISO', 'FNumber', 'ExposureTime', 'FocalLength'
      ]
    })

    if (!data) throw new Error('no exif')

    const dateTaken = data.DateTimeOriginal ?? data.CreateDate ?? null

    return {
      dateTaken: dateTaken instanceof Date ? dateTaken : dateTaken ? new Date(dateTaken) : null,
      make: data.Make ?? null,
      model: data.Model ?? null,
      width: data.ExifImageWidth ?? data.ImageWidth ?? null,
      height: data.ExifImageHeight ?? data.ImageHeight ?? null,
      orientation: data.Orientation ?? 1,
      iso: data.ISO ?? null,
      fNumber: data.FNumber ?? null,
      exposureTime: data.ExposureTime ?? null,
      focalLength: data.FocalLength ?? null
    }
  } catch {
    // Fall back to file modification date
    try {
      const stats = await stat(filePath)
      return {
        dateTaken: stats.mtime,
        make: null, model: null,
        width: null, height: null,
        orientation: 1,
        iso: null, fNumber: null,
        exposureTime: null, focalLength: null
      }
    } catch {
      return {
        dateTaken: null,
        make: null, model: null,
        width: null, height: null,
        orientation: 1,
        iso: null, fNumber: null,
        exposureTime: null, focalLength: null
      }
    }
  }
}
