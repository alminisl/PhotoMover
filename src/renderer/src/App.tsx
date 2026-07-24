import { useEffect } from 'react'
import { useAppStore } from './stores/appStore'
import { SetupView } from './components/SetupView'
import { GridView } from './components/GridView'
import { TransferView } from './components/TransferView'
import { DoneView } from './components/DoneView'
import { TitleBar } from './components/TitleBar'
import { ModeSelectView } from './components/ModeSelectView'
import { LibrarySetupView } from './components/LibrarySetupView'
import { LibraryGridView } from './components/LibraryGridView'

export default function App(): JSX.Element {
  const {
    view, mode, setView, setMode,
    setDrives, setSourcePath, setDestinationPath, setLibraryPath,
    librarySelectedIds, selectedIds,
    setLibraryTagBulk, setRatingBulk, clearLibrarySelection,
    setTagBulk, clearSelection,
    libraryPhotos
  } = useAppStore()

  // Boot: load config and determine starting view
  useEffect(() => {
    window.api.listDrives().then(setDrives)

    window.api.loadConfig().then((config) => {
      if (config.sourcePath) setSourcePath(config.sourcePath)
      if (config.destinationPath) setDestinationPath(config.destinationPath)
      if (config.libraryPath) setLibraryPath(config.libraryPath)

      const lastMode = config.lastMode ?? 'transfer'
      setMode(lastMode)

      if (lastMode === 'library') {
        setView(config.libraryPath ? 'library-grid' : 'library-setup')
      } else if (lastMode === 'transfer') {
        setView('setup')
      } else {
        setView('mode-select')
      }
    })

    const unsub = window.api.onDrivesChanged(setDrives)
    return unsub
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      // Library mode shortcuts
      if (mode === 'library' && (view === 'library-grid' || view === 'library-edit-folder')) {
        const selIds = [...librarySelectedIds]
        if (selIds.length === 0) return

        const activePhotos = view === 'library-edit-folder'
          ? useAppStore.getState().editFolderPhotos
          : useAppStore.getState().libraryPhotos

        if (e.key === 'd' || e.key === 'D') {
          setLibraryTagBulk(selIds, 'to-delete')
          window.api.saveLibraryMetadata(
            selIds.map((id) => {
              const p = activePhotos.find((ph) => ph.id === id)
              return p ? { absolutePath: p.path, libraryTag: 'to-delete' as const } : null
            }).filter(Boolean) as Array<{ absolutePath: string; libraryTag: 'to-delete' }>
          )
        } else if (e.key === 'e' || e.key === 'E') {
          setLibraryTagBulk(selIds, 'to-edit')
          window.api.saveLibraryMetadata(
            selIds.map((id) => {
              const p = activePhotos.find((ph) => ph.id === id)
              return p ? { absolutePath: p.path, libraryTag: 'to-edit' as const } : null
            }).filter(Boolean) as Array<{ absolutePath: string; libraryTag: 'to-edit' }>
          )
        } else if (e.key === 'r' || e.key === 'R') {
          setLibraryTagBulk(selIds, 'none')
          window.api.saveLibraryMetadata(
            selIds.map((id) => {
              const p = activePhotos.find((ph) => ph.id === id)
              return p ? { absolutePath: p.path, libraryTag: 'none' as const } : null
            }).filter(Boolean) as Array<{ absolutePath: string; libraryTag: 'none' }>
          )
        } else if (e.key === 'Escape') {
          clearLibrarySelection()
        } else {
          const digit = parseInt(e.key)
          if (digit >= 0 && digit <= 5) {
            setRatingBulk(selIds, digit)
            window.api.saveLibraryMetadata(
              selIds.map((id) => {
                const p = activePhotos.find((ph) => ph.id === id)
                return p ? { absolutePath: p.path, rating: digit } : null
              }).filter(Boolean) as Array<{ absolutePath: string; rating: number }>
            )
          }
        }
        return
      }

      // Transfer mode shortcuts
      if (mode === 'transfer' && view === 'grid') {
        const selIds = [...selectedIds]
        if (selIds.length === 0) return
        if (e.key === 't' || e.key === 'T') setTagBulk(selIds, 'transfer')
        else if (e.key === 'x' || e.key === 'X') setTagBulk(selIds, 'delete')
        else if (e.key === 'r' || e.key === 'R') setTagBulk(selIds, 'none')
        else if (e.key === 'Escape') clearSelection()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, view, librarySelectedIds, selectedIds])

  // When library grid view is opened with library photos already loaded, skip re-scan
  useEffect(() => {
    if (view !== 'library-grid') return
    if (libraryPhotos.length > 0) return
    const store = useAppStore.getState()
    if (!store.libraryPath) return

    store.clearLibraryPhotos()
    store.setLibraryScanProgress({ done: 0, total: 1 })
    const unsubBatch = window.api.onLibraryBatch((photos) => store.addLibraryPhotos(photos))
    const unsubProgress = window.api.onLibraryScanProgress((p) => store.setLibraryScanProgress(p))
    const unsubThumbs = window.api.onLibraryThumbnails((updates) => {
      updates.forEach((u) => store.setLibraryPhotoThumbnail(u.id, u.thumbnailData))
    })
    window.api.scanLibrary().then(() => {
      unsubBatch()
      unsubProgress()
      unsubThumbs()
      store.setLibraryScanProgress(null)
    })
  }, [view])

  return (
    <div className="flex flex-col h-screen bg-[#0f0f11] text-zinc-200">
      <TitleBar />
      <div className="flex-1 overflow-hidden">
        {view === 'mode-select' && <ModeSelectView />}
        {view === 'setup' && <SetupView />}
        {view === 'grid' && <GridView />}
        {view === 'transferring' && <TransferView />}
        {view === 'done' && <DoneView />}
        {view === 'library-setup' && <LibrarySetupView />}
        {(view === 'library-grid' || view === 'library-edit-folder') && <LibraryGridView />}
      </div>
    </div>
  )
}
