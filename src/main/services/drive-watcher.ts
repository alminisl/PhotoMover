import { BrowserWindow } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { readdir, lstat, access } from 'fs/promises'
import { join } from 'path'
import { userInfo } from 'os'

const execFileAsync = promisify(execFile)

export interface DriveInfo {
  device: string
  description: string
  mountpoints: { path: string }[]
  isRemovable: boolean
  isCard: boolean
  size: number | null
}

let pollInterval: NodeJS.Timeout | null = null
let lastDriveSnapshot: string = ''

async function hasDcim(mountPath: string): Promise<boolean> {
  try {
    await access(join(mountPath, 'DCIM'))
    return true
  } catch {
    return false
  }
}

function looksLikeCard(name: string): boolean {
  const n = name.toLowerCase()
  return n.includes('card') || n.includes('sd') || n.includes('eos') || n.includes('nikon')
}

async function queryDrivesWindows(): Promise<DriveInfo[]> {
  // Use PowerShell to query removable drives
  const script = `
    Get-WmiObject Win32_LogicalDisk |
    Where-Object { $_.DriveType -eq 2 } |
    Select-Object DeviceID, VolumeName, Size |
    ConvertTo-Json -Compress
  `
  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command', script
    ], { timeout: 5000 })

    const raw = stdout.trim()
    if (!raw) return []

    const parsed = JSON.parse(raw)
    const items = Array.isArray(parsed) ? parsed : [parsed]

    return await Promise.all(
      items
        .filter((d: { DeviceID?: string }) => d.DeviceID)
        .map(async (d: { DeviceID: string; VolumeName?: string; Size?: number | null }) => {
          const mountPath = d.DeviceID + '\\'
          return {
            device: d.DeviceID,
            description: d.VolumeName || `Removable Drive (${d.DeviceID})`,
            mountpoints: [{ path: mountPath }],
            isRemovable: true,
            isCard: looksLikeCard(d.VolumeName || '') || (await hasDcim(mountPath)),
            size: d.Size ?? null
          }
        })
    )
  } catch {
    return []
  }
}

/** macOS: every mounted volume appears under /Volumes; the boot volume is a symlink, skip it. */
async function queryDrivesMac(): Promise<DriveInfo[]> {
  return listMountedDirs(['/Volumes'])
}

/** Linux: removable media are mounted under /media/<user>, /run/media/<user>, or /media. */
async function queryDrivesLinux(): Promise<DriveInfo[]> {
  const user = userInfo().username
  return listMountedDirs([`/media/${user}`, `/run/media/${user}`, '/media'])
}

async function listMountedDirs(bases: string[]): Promise<DriveInfo[]> {
  const drives: DriveInfo[] = []
  const seen = new Set<string>()

  for (const base of bases) {
    let entries
    try {
      entries = await readdir(base, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const mountPath = join(base, entry.name)
      if (seen.has(mountPath)) continue
      try {
        const info = await lstat(mountPath)
        // Symlinks (e.g. the macOS boot volume) and plain files are not mounts
        if (!info.isDirectory() || info.isSymbolicLink()) continue
      } catch {
        continue
      }
      seen.add(mountPath)
      drives.push({
        device: mountPath,
        description: entry.name,
        mountpoints: [{ path: mountPath }],
        isRemovable: true,
        isCard: looksLikeCard(entry.name) || (await hasDcim(mountPath)),
        size: null
      })
    }
  }

  return drives
}

export async function listRemovableDrives(): Promise<DriveInfo[]> {
  switch (process.platform) {
    case 'win32':
      return queryDrivesWindows()
    case 'darwin':
      return queryDrivesMac()
    case 'linux':
      return queryDrivesLinux()
    default:
      return []
  }
}

export function startDriveWatcher(): void {
  if (pollInterval) return

  pollInterval = setInterval(async () => {
    try {
      const drives = await listRemovableDrives()
      const snapshot = JSON.stringify(drives.map((d) => d.device))

      if (snapshot !== lastDriveSnapshot) {
        lastDriveSnapshot = snapshot
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send('drives:changed', drives)
        })
      }
    } catch {
      // silently ignore polling errors
    }
  }, 3000)
}

export function stopDriveWatcher(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}
