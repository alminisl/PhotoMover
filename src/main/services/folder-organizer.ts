import { join, extname, basename } from 'path'
import { pathExists } from 'fs-extra'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const RAW_EXTENSIONS = new Set([
  '.cr2', '.cr3', '.nef', '.arw', '.raf', '.orf', '.rw2', '.dng', '.raw'
])

export interface OrganizerOptions {
  organizeByDay?: boolean
  separateRaw?: boolean
}

export function getTargetPath(
  destinationRoot: string,
  sourceFilePath: string,
  dateTaken: Date | null,
  options: OrganizerOptions = {}
): string {
  const filename = basename(sourceFilePath)
  const ext = extname(sourceFilePath).toLowerCase()
  const isRaw = RAW_EXTENSIONS.has(ext)

  if (!dateTaken || isNaN(dateTaken.getTime())) {
    const base = options.separateRaw && isRaw
      ? join(destinationRoot, 'Unsorted', 'RAW')
      : join(destinationRoot, 'Unsorted')
    return join(base, filename)
  }

  const year = dateTaken.getFullYear().toString()
  const month = MONTH_NAMES[dateTaken.getMonth()]
  const day = String(dateTaken.getDate()).padStart(2, '0')

  const dateParts = options.organizeByDay
    ? [year, month, day]
    : [year, month]

  const rawPart = options.separateRaw && isRaw ? ['RAW'] : []

  return join(destinationRoot, ...dateParts, ...rawPart, filename)
}

export async function resolveCollision(targetPath: string): Promise<string> {
  if (!(await pathExists(targetPath))) return targetPath

  const dir = targetPath.replace(/[^/\\]*$/, '')
  const ext = extname(targetPath)
  const nameWithoutExt = basename(targetPath, ext)

  let counter = 1
  let candidate: string

  do {
    candidate = join(dir, `${nameWithoutExt}_${counter}${ext}`)
    counter++
  } while (await pathExists(candidate))

  return candidate
}
