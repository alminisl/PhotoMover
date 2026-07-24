import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { FolderIcon, CameraIcon, ChevronRightIcon, HardDriveIcon } from './icons'
import type { AppConfig } from '../../../preload/index'

export function SetupView(): JSX.Element {
  const {
    drives, sourcePath, destinationPath,
    setSourcePath, setDestinationPath,
    setView, addPhotos, setScanProgress, clearPhotos, scanProgress, setPhotoThumbnail
  } = useAppStore()

  const [scanning, setScanning] = useState(false)
  const [settings, setSettings] = useState<Pick<AppConfig, 'deleteOriginal' | 'organizeByDay' | 'separateRaw'>>({
    deleteOriginal: true,
    organizeByDay: false,
    separateRaw: false,
  })

  // Load persisted settings on mount
  useEffect(() => {
    window.api.loadConfig().then((c) => {
      setSettings({
        deleteOriginal: c.deleteOriginal,
        organizeByDay: c.organizeByDay,
        separateRaw: c.separateRaw,
      })
    })
  }, [])

  function updateSetting<K extends keyof typeof settings>(key: K, value: boolean): void {
    const next = { ...settings, [key]: value }
    setSettings(next)
    window.api.saveConfig(next)
  }

  async function handlePickSource(): Promise<void> {
    const folder = await window.api.openFolder()
    if (folder) {
      setSourcePath(folder)
      window.api.saveConfig({ sourcePath: folder })
    }
  }

  async function handlePickDestination(): Promise<void> {
    const folder = await window.api.openFolder()
    if (folder) {
      setDestinationPath(folder)
      window.api.saveConfig({ destinationPath: folder })
    }
  }

  async function handleStart(): Promise<void> {
    if (!sourcePath) return
    setScanning(true)
    clearPhotos()
    setScanProgress({ done: 0, total: 1 })

    const unsub = window.api.onPhotosBatch((photos) => addPhotos(photos))
    const progressUnsub = window.api.onScanProgress((p) => setScanProgress(p))
    const thumbUnsub = window.api.onPhotosThumbnails((updates) => {
      updates.forEach((u) => setPhotoThumbnail(u.id, u.thumbnailData))
    })

    await window.api.scanPhotos(sourcePath)

    unsub()
    progressUnsub()
    thumbUnsub()
    setScanProgress(null)
    setScanning(false)
    setView('grid')
  }

  const canStart = !!sourcePath && !!destinationPath && !scanning

  // Build a live folder structure preview
  const previewLines = buildPreview(destinationPath, settings)

  return (
    <div className="flex items-center justify-center h-full bg-[#0f0f11] overflow-y-auto py-8">
      <div className="w-full max-w-lg px-6 animate-slide-up">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-4">
            <CameraIcon className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">Photo Transfer</h1>
          <p className="text-zinc-500 text-sm mt-1.5">Import, review, and organize your photos</p>
        </div>

        {/* SD Cards detected */}
        {drives.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Detected SD Cards</p>
            <div className="space-y-1.5">
              {drives.map((drive) => (
                <button
                  key={drive.device}
                  onClick={() => {
                    const path = drive.mountpoints[0]?.path
                    if (path) {
                      setSourcePath(path)
                      window.api.saveConfig({ sourcePath: path })
                    }
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all duration-150
                    ${sourcePath === drive.mountpoints[0]?.path
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-zinc-100'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800/50'
                    }
                  `}
                >
                  <HardDriveIcon className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{drive.description}</p>
                    <p className="text-xs text-zinc-500 truncate">{drive.mountpoints[0]?.path}</p>
                  </div>
                  {sourcePath === drive.mountpoints[0]?.path && (
                    <span className="text-xs text-indigo-400 font-medium">Selected</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Folders */}
        <div className="space-y-3 mb-5">
          <PathSelector
            label="Source Folder"
            value={sourcePath}
            placeholder="Select SD card or browse folder..."
            onPick={handlePickSource}
          />
          <PathSelector
            label="Destination Folder"
            value={destinationPath}
            placeholder="Where to save organized photos..."
            onPick={handlePickDestination}
          />
        </div>

        {/* Settings */}
        <div className="mb-5 rounded-xl bg-zinc-900/40 border border-zinc-800/60 divide-y divide-zinc-800/60">
          <ToggleRow
            label="Delete original after transfer"
            description="Move files instead of copying"
            checked={settings.deleteOriginal}
            onChange={(v) => updateSetting('deleteOriginal', v)}
          />
          <ToggleRow
            label="Organize by day"
            description="Year / Month / Day subfolders"
            checked={settings.organizeByDay}
            onChange={(v) => updateSetting('organizeByDay', v)}
          />
          <ToggleRow
            label="Separate RAW files"
            description="Put RAW files in a RAW/ subfolder"
            checked={settings.separateRaw}
            onChange={(v) => updateSetting('separateRaw', v)}
          />
        </div>

        {/* Folder structure preview */}
        {destinationPath && (
          <div className="mb-5 px-3.5 py-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
            <p className="text-xs text-zinc-500 mb-2">Photos will be organized as:</p>
            <div className="font-mono text-xs text-zinc-400 space-y-0.5">
              {previewLines.map((line, i) => (
                <p key={i} style={{ paddingLeft: `${line.indent * 16}px` }}>
                  <span className="text-zinc-600">{line.icon} </span>
                  <span className={line.dim ? 'text-zinc-600' : ''}>{line.text}</span>
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Start button / progress */}
        {scanning && scanProgress ? (
          <div className="w-full rounded-xl bg-zinc-900/60 border border-zinc-800 px-4 py-3">
            <div className="flex justify-between text-xs text-zinc-400 mb-2">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-indigo-500/40 border-t-indigo-500 rounded-full animate-spin inline-block" />
                Processing photos…
              </span>
              <span className="tabular-nums">
                {scanProgress.done} <span className="text-zinc-600">/</span> {scanProgress.total}
              </span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-150"
                style={{ width: `${Math.round((scanProgress.done / scanProgress.total) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-600 mt-1.5 text-right">
              {Math.round((scanProgress.done / scanProgress.total) * 100)}%
            </p>
          </div>
        ) : (
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="
              w-full flex items-center justify-center gap-2 py-3 px-4
              rounded-xl font-medium text-sm transition-all duration-150
              disabled:opacity-30 disabled:cursor-not-allowed
              bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600
              text-white shadow-lg shadow-indigo-500/20
            "
          >
            <ChevronRightIcon className="w-4 h-4" />
            Load Photos
          </button>
        )}

        {!sourcePath && (
          <p className="text-center text-xs text-zinc-600 mt-3">
            Insert an SD card or select a source folder to begin
          </p>
        )}
      </div>
    </div>
  )
}

function ToggleRow({
  label, description, checked, onChange
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}): JSX.Element {
  return (
    <div className="flex items-center justify-between px-3.5 py-3">
      <div>
        <p className="text-sm text-zinc-300">{label}</p>
        <p className="text-xs text-zinc-600">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`
          relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0
          ${checked ? 'bg-indigo-500' : 'bg-zinc-700'}
        `}
      >
        <span className={`
          absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
          ${checked ? 'translate-x-4' : 'translate-x-0.5'}
        `} />
      </button>
    </div>
  )
}

function PathSelector({
  label, value, placeholder, onPick
}: {
  label: string
  value: string | null
  placeholder: string
  onPick: () => void
}): JSX.Element {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-500 mb-1.5">{label}</label>
      <button
        onClick={onPick}
        className="
          w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left
          transition-all duration-150 group
          bg-zinc-900/60 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50
        "
      >
        <FolderIcon className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 flex-shrink-0" />
        <span className={`text-sm flex-1 truncate ${value ? 'text-zinc-200' : 'text-zinc-600'}`}>
          {value ?? placeholder}
        </span>
        <span className="text-xs text-zinc-600 group-hover:text-zinc-400 flex-shrink-0">Browse</span>
      </button>
    </div>
  )
}

interface PreviewLine { indent: number; icon: string; text: string; dim?: boolean }

function buildPreview(
  dest: string | null,
  settings: { organizeByDay: boolean; separateRaw: boolean }
): PreviewLine[] {
  if (!dest) return []
  const root = shortPath(dest)
  const lines: PreviewLine[] = [{ indent: 0, icon: '📁', text: `${root}/` }]
  lines.push({ indent: 1, icon: '📁', text: '2024/' })
  lines.push({ indent: 2, icon: '📁', text: 'April/' })
  if (settings.organizeByDay) {
    lines.push({ indent: 3, icon: '📁', text: '15/' })
    if (settings.separateRaw) {
      lines.push({ indent: 4, icon: '📁', text: 'RAW/' })
      lines.push({ indent: 5, icon: '', text: 'DSCF0001.RAF ...', dim: true })
      lines.push({ indent: 4, icon: '', text: 'DSCF0001.JPG ...', dim: true })
    } else {
      lines.push({ indent: 4, icon: '', text: 'DSCF0001.JPG  DSCF0001.RAF ...', dim: true })
    }
  } else {
    if (settings.separateRaw) {
      lines.push({ indent: 3, icon: '📁', text: 'RAW/' })
      lines.push({ indent: 4, icon: '', text: 'DSCF0001.RAF ...', dim: true })
      lines.push({ indent: 3, icon: '', text: 'DSCF0001.JPG ...', dim: true })
    } else {
      lines.push({ indent: 3, icon: '', text: 'DSCF0001.JPG  DSCF0001.RAF ...', dim: true })
    }
  }
  return lines
}

function shortPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/')
  return parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : p
}
