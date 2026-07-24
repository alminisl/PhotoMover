import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { getTargetPath, resolveCollision } from '../src/main/services/folder-organizer'

describe('getTargetPath', () => {
  const dest = join('D:', 'Photos')

  it('organizes by year and month name', () => {
    const date = new Date(2024, 3, 15) // April 2024
    expect(getTargetPath(dest, join('E:', 'DCIM', 'IMG_0001.jpg'), date)).toBe(
      join(dest, '2024', 'April', 'IMG_0001.jpg')
    )
  })

  it('adds a day folder when organizeByDay is set', () => {
    const date = new Date(2023, 11, 7) // December 7, 2023
    expect(
      getTargetPath(dest, join('E:', 'IMG.jpg'), date, { organizeByDay: true })
    ).toBe(join(dest, '2023', 'December', '07', 'IMG.jpg'))
  })

  it('puts photos without a date into Unsorted', () => {
    expect(getTargetPath(dest, join('E:', 'IMG.jpg'), null)).toBe(
      join(dest, 'Unsorted', 'IMG.jpg')
    )
  })

  it('treats an invalid date like a missing one', () => {
    expect(getTargetPath(dest, join('E:', 'IMG.jpg'), new Date('nonsense'))).toBe(
      join(dest, 'Unsorted', 'IMG.jpg')
    )
  })

  it('separates RAW files into a RAW subfolder when enabled', () => {
    const date = new Date(2024, 0, 1)
    expect(
      getTargetPath(dest, join('E:', 'DSC_1.RAF'), date, { separateRaw: true })
    ).toBe(join(dest, '2024', 'January', 'RAW', 'DSC_1.RAF'))
  })

  it('separates undated RAW files into Unsorted/RAW', () => {
    expect(getTargetPath(dest, join('E:', 'DSC_1.nef'), null, { separateRaw: true })).toBe(
      join(dest, 'Unsorted', 'RAW', 'DSC_1.nef')
    )
  })

  it('leaves RAW files alongside other photos when separateRaw is off', () => {
    const date = new Date(2024, 0, 1)
    expect(getTargetPath(dest, join('E:', 'DSC_1.arw'), date)).toBe(
      join(dest, '2024', 'January', 'DSC_1.arw')
    )
  })
})

describe('resolveCollision', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'organizer-test-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('returns the path unchanged when nothing exists there', async () => {
    const target = join(dir, 'IMG_0001.jpg')
    expect(await resolveCollision(target)).toBe(target)
  })

  it('appends _1 when the file already exists', async () => {
    const target = join(dir, 'IMG_0001.jpg')
    await writeFile(target, 'x')
    expect(await resolveCollision(target)).toBe(join(dir, 'IMG_0001_1.jpg'))
  })

  it('keeps counting until it finds a free name', async () => {
    const target = join(dir, 'IMG_0001.jpg')
    await writeFile(target, 'x')
    await writeFile(join(dir, 'IMG_0001_1.jpg'), 'x')
    await writeFile(join(dir, 'IMG_0001_2.jpg'), 'x')
    expect(await resolveCollision(target)).toBe(join(dir, 'IMG_0001_3.jpg'))
  })
})
