import { useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { FolderIcon, CameraIcon, ChevronRightIcon, HardDriveIcon } from './icons'

export function SetupView(): JSX.Element {
  const {
    drives, sourcePath, destinationPath,
    setSourcePath, setDestinationPath,
    setView, addPhotos, setScanProgress, clearPhotos
  } = useAppStore()

  const [scanning, setScanning] = useState(false)

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

    const unsub = window.api.onPhotosBatch((photos) => {
      addPhotos(photos)
    })

    const progressUnsub = window.api.onScanProgress((p) => {
      setScanProgress(p)
    })

    await window.api.scanPhotos(sourcePath)

    unsub()
    progressUnsub()
    setScanning(false)
    setView('grid')
  }

  const canStart = !!sourcePath && !!destinationPath && !scanning

  return (
    <div className="flex items-center justify-center h-full bg-[#0f0f11]">
      <div className="w-full max-w-lg px-6 animate-slide-up">
        {/* Hero */}
        <div className="text-center mb-10">
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

        {/* Source folder */}
        <div className="space-y-3 mb-6">
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

        {/* Folder structure preview */}
        {destinationPath && (
          <div className="mb-6 px-3.5 py-3 rounded-xl bg-zinc-900/40 border border-zinc-800/60">
            <p className="text-xs text-zinc-500 mb-2">Photos will be organized as:</p>
            <div className="font-mono text-xs text-zinc-400 space-y-0.5">
              <p><span className="text-zinc-600">📁</span> {shortPath(destinationPath)}/</p>
              <p className="pl-4"><span className="text-zinc-600">📁</span> 2024/</p>
              <p className="pl-8"><span className="text-zinc-600">📁</span> April/</p>
              <p className="pl-12 text-zinc-600">IMG_0001.jpg ...</p>
              <p className="pl-8"><span className="text-zinc-600">📁</span> March/</p>
              <p className="pl-4"><span className="text-zinc-600">📁</span> 2023/</p>
            </div>
          </div>
        )}

        {/* Start button */}
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
          {scanning ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Scanning photos...
            </>
          ) : (
            <>
              <ChevronRightIcon className="w-4 h-4" />
              Load Photos
            </>
          )}
        </button>

        {!sourcePath && (
          <p className="text-center text-xs text-zinc-600 mt-3">
            Insert an SD card or select a source folder to begin
          </p>
        )}
      </div>
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

function shortPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/')
  return parts.length > 2 ? `.../${parts.slice(-2).join('/')}` : p
}
