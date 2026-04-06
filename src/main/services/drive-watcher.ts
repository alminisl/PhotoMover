import { BrowserWindow } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'

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

    return items
      .filter((d: { DeviceID?: string }) => d.DeviceID)
      .map((d: { DeviceID: string; VolumeName?: string; Size?: number | null }) => ({
        device: d.DeviceID,
        description: d.VolumeName || `Removable Drive (${d.DeviceID})`,
        mountpoints: [{ path: d.DeviceID + '\\' }],
        isRemovable: true,
        isCard: (d.VolumeName || '').toLowerCase().includes('card') ||
                (d.VolumeName || '').toLowerCase().includes('sd'),
        size: d.Size ?? null
      }))
  } catch {
    return []
  }
}

export async function listRemovableDrives(): Promise<DriveInfo[]> {
  return queryDrivesWindows()
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
