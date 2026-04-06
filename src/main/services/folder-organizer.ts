import { join, extname, basename } from 'path'
import { pathExists } from 'fs-extra'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export function getTargetPath(
  destinationRoot: string,
  sourceFilePath: string,
  dateTaken: Date | null
): string {
  const filename = basename(sourceFilePath)

  if (!dateTaken || isNaN(dateTaken.getTime())) {
    return join(destinationRoot, 'Unsorted', filename)
  }

  const year = dateTaken.getFullYear().toString()
  const month = MONTH_NAMES[dateTaken.getMonth()]
  return join(destinationRoot, year, month, filename)
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
