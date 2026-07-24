import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { FolderIcon, GridIcon, ChevronRightIcon, ChevronLeftIcon } from './icons'

export function LibrarySetupView(): JSX.Element {
  const { libraryPath, setLibraryPath, setView, clearLibraryPhotos, addLibraryPhotos, setLibraryScanProgress, setLibraryPhotoThumbnail } = useAppStore()
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null)
  const [editFolderExists, setEditFolderExists] = useState(false)

  useEffect(() => {
    // if library path is already set, check for Edit folder existence
    if (libraryPath) setEditFolderExists(true)
  }, [libraryPath])

  async function handlePickLibrary(): Promise<void> {
    const folder = await window.api.openFolder()
    if (!folder) return
    setLibraryPath(folder)
    setEditFolderExists(false)
    window.api.saveConfig({ libraryPath: folder })
  }

  async function handleOpen(): Promise<void> {
    if (!libraryPath) return
    setScanning(true)
    clearLibraryPhotos()
    setScanProgress({ done: 0, total: 1 })
    setLibraryScanProgress({ done: 0, total: 1 })

    const unsubBatch = window.api.onLibraryBatch((photos) => addLibraryPhotos(photos))
    const unsubProgress = window.api.onLibraryScanProgress((p) => {
      setScanProgress(p)
      setLibraryScanProgress(p)
    })
    const unsubThumbs = window.api.onLibraryThumbnails((updates) => {
      updates.forEach((u) => setLibraryPhotoThumbnail(u.id, u.thumbnailData))
    })

    await window.api.scanLibrary()

    unsubBatch()
    unsubProgress()
    unsubThumbs()
    setScanProgress(null)
    setLibraryScanProgress(null)
    setScanning(false)
    setView('library-grid')
  }

  return (
    <div className="flex items-center justify-center h-full bg-[#0f0f11] overflow-y-auto py-8">
      <div className="w-full max-w-lg px-6 animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-4">
            <GridIcon className="w-8 h-8 text-violet-400" />
          </div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">Library</h1>
          <p className="text-zinc-500 text-sm mt-1.5">Select your photo library folder</p>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Library Folder</label>
          <button
            onClick={handlePickLibrary}
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all duration-150 group bg-zinc-900/60 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50"
          >
            <FolderIcon className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 flex-shrink-0" />
            <span className={`text-sm flex-1 truncate ${libraryPath ? 'text-zinc-200' : 'text-zinc-600'}`}>
              {libraryPath ?? 'Select your photos folder...'}
            </span>
            <span className="text-xs text-zinc-600 group-hover:text-zinc-400 flex-shrink-0">Browse</span>
          </button>
        </div>

        {editFolderExists && (
          <div className="mb-4">
            <button
              onClick={() => setView('library-edit-folder')}
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border border-sky-500/20 bg-sky-500/5 text-left hover:bg-sky-500/10 transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0" />
              <span className="text-sm text-sky-400 flex-1">View Edit folder</span>
              <ChevronRightIcon className="w-3.5 h-3.5 text-sky-500/60" />
            </button>
          </div>
        )}

        {scanning && scanProgress ? (
          <div className="w-full rounded-xl bg-zinc-900/60 border border-zinc-800 px-4 py-3">
            <div className="flex justify-between text-xs text-zinc-400 mb-2">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-violet-500/40 border-t-violet-500 rounded-full animate-spin inline-block" />
                Scanning library…
              </span>
              <span className="tabular-nums">{scanProgress.done} / {scanProgress.total}</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-150"
                style={{ width: `${Math.round((scanProgress.done / Math.max(scanProgress.total, 1)) * 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <button
            onClick={handleOpen}
            disabled={!libraryPath || scanning}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-sm transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed bg-violet-500 hover:bg-violet-400 active:bg-violet-600 text-white shadow-lg shadow-violet-500/20"
          >
            <ChevronRightIcon className="w-4 h-4" />
            Open Library
          </button>
        )}

        <button
          onClick={() => setView('mode-select')}
          className="mt-4 w-full flex items-center justify-center gap-1.5 text-zinc-600 hover:text-zinc-400 transition-colors text-sm"
        >
          <ChevronLeftIcon className="w-3.5 h-3.5" />
          Back
        </button>
      </div>
    </div>
  )
}
