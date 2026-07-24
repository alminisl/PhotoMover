import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useAppStore } from '../stores/appStore'
import type { PhotoWithLibraryTag, LibraryTagState, LibraryFilterTab } from '../stores/appStore'
import { LibraryTagBar } from './LibraryTagBar'
import { LibraryPhotoCard } from './LibraryPhotoCard'
import { LibraryPhotoPreview } from './LibraryPhotoPreview'
import { ChevronLeftIcon } from './icons'
import { groupPhotos } from '../utils/photoGrouping'

interface DragRect { left: number; top: number; width: number; height: number }

export function LibraryGridView(): JSX.Element {
  const {
    view,
    libraryPhotos,
    editFolderPhotos,
    libraryScanProgress,
    librarySelectedIds,
    libraryFilter,
    setView,
    setLibrarySelectedIds,
    clearLibrarySelection,
    setLibraryFilter,
    setLibraryTag,
    setRating,
    addEditFolderPhotos,
    clearEditFolderPhotos,
    setLibraryScanProgress,
    setLibraryPhotoThumbnail
  } = useAppStore()

  const isEditFolder = view === 'library-edit-folder'
  const activePhotos = isEditFolder ? editFolderPhotos : libraryPhotos

  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [dragRect, setDragRect] = useState<DragRect | null>(null)
  const lastClickedIndex = useRef<number | null>(null)
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Reset selection when filter changes
  useEffect(() => { clearLibrarySelection() }, [libraryFilter, clearLibrarySelection])

  // Load edit folder on entry
  useEffect(() => {
    if (!isEditFolder) return
    async function loadEdit(): Promise<void> {
      clearEditFolderPhotos()
      const unsubBatch = window.api.onLibraryEditBatch((photos) => addEditFolderPhotos(photos))
      const unsubProgress = window.api.onLibraryEditProgress((p) => setLibraryScanProgress(p))
      const unsubThumbs = window.api.onLibraryEditThumbnails((updates) => {
        updates.forEach((u) => setLibraryPhotoThumbnail(u.id, u.thumbnailData))
      })
      await window.api.scanEditFolder()
      unsubBatch()
      unsubProgress()
      unsubThumbs()
      setLibraryScanProgress(null)
    }
    loadEdit()
  }, [isEditFolder])

  const filtered = useMemo(() => {
    if (libraryFilter === 'all') return activePhotos
    if (libraryFilter === 'untagged') return activePhotos.filter((p) => p.libraryTag === 'none')
    if (libraryFilter === 'to-delete') return activePhotos.filter((p) => p.libraryTag === 'to-delete')
    if (libraryFilter === 'to-edit') return activePhotos.filter((p) => p.libraryTag === 'to-edit')
    if (libraryFilter === 'rated') return activePhotos.filter((p) => p.rating > 0)
    return activePhotos
  }, [activePhotos, libraryFilter])

  const groups = useMemo(() => groupPhotos(filtered), [filtered])

  const handleCardClick = useCallback(
    (photo: PhotoWithLibraryTag, index: number, e: React.MouseEvent) => {
      if (e.shiftKey && lastClickedIndex.current !== null) {
        const from = Math.min(lastClickedIndex.current, index)
        const to = Math.max(lastClickedIndex.current, index)
        const newSelected = new Set(librarySelectedIds)
        for (let i = from; i <= to; i++) newSelected.add(filtered[i].id)
        setLibrarySelectedIds(newSelected)
        return
      }

      if (librarySelectedIds.size > 0) {
        const newSelected = new Set(librarySelectedIds)
        if (newSelected.has(photo.id)) newSelected.delete(photo.id)
        else newSelected.add(photo.id)
        setLibrarySelectedIds(newSelected)
        lastClickedIndex.current = index
        return
      }

      setPreviewIndex(activePhotos.indexOf(photo))
      lastClickedIndex.current = index
    },
    [activePhotos, filtered, librarySelectedIds, setLibrarySelectedIds]
  )

  function handleGroupHeaderClick(group: ReturnType<typeof groupPhotos<PhotoWithLibraryTag>>[number]): void {
    const ids = group.photos.map((p) => p.id)
    const allSelected = ids.every((id) => librarySelectedIds.has(id))
    const newSelected = new Set(librarySelectedIds)
    if (allSelected) ids.forEach((id) => newSelected.delete(id))
    else ids.forEach((id) => newSelected.add(id))
    setLibrarySelectedIds(newSelected)
  }

  function handleGridMouseDown(e: React.MouseEvent<HTMLDivElement>): void {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('[data-photo-id]') || target.closest('button')) return
    dragStart.current = { x: e.clientX, y: e.clientY }

    function onMouseMove(ev: MouseEvent): void {
      if (!dragStart.current) return
      const dx = ev.clientX - dragStart.current.x
      const dy = ev.clientY - dragStart.current.y
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return
      setDragRect({
        left: Math.min(dragStart.current.x, ev.clientX),
        top: Math.min(dragStart.current.y, ev.clientY),
        width: Math.abs(dx),
        height: Math.abs(dy)
      })
    }

    function onMouseUp(ev: MouseEvent): void {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      if (!dragStart.current) return
      const dx = ev.clientX - dragStart.current.x
      const dy = ev.clientY - dragStart.current.y
      dragStart.current = null
      setDragRect(null)
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) { clearLibrarySelection(); return }

      const selLeft = Math.min(ev.clientX, ev.clientX - dx)
      const selTop = Math.min(ev.clientY, ev.clientY - dy)
      const selRight = Math.max(ev.clientX, ev.clientX - dx)
      const selBottom = Math.max(ev.clientY, ev.clientY - dy)
      if (!gridRef.current) return
      const newSelected = new Set<string>()
      gridRef.current.querySelectorAll('[data-photo-id]').forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.left < selRight && r.right > selLeft && r.top < selBottom && r.bottom > selTop) {
          newSelected.add(el.getAttribute('data-photo-id')!)
        }
      })
      if (newSelected.size > 0) setLibrarySelectedIds(newSelected)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const counts: Record<LibraryFilterTab, number> = {
    all: activePhotos.length,
    untagged: activePhotos.filter((p) => p.libraryTag === 'none').length,
    'to-delete': activePhotos.filter((p) => p.libraryTag === 'to-delete').length,
    'to-edit': activePhotos.filter((p) => p.libraryTag === 'to-edit').length,
    rated: activePhotos.filter((p) => p.rating > 0).length
  }

  function handleRatingChange(photo: PhotoWithLibraryTag, rating: number): void {
    setRating(photo.id, rating)
    window.api.saveLibraryMetadata([{ absolutePath: photo.path, rating }])
  }

  function handleTagChange(photo: PhotoWithLibraryTag, tag: LibraryTagState): void {
    setLibraryTag(photo.id, tag)
    window.api.saveLibraryMetadata([{ absolutePath: photo.path, libraryTag: tag }])
  }

  return (
    <div className="flex flex-col h-full" onMouseDown={handleGridMouseDown}>
      {/* Sky stripe for edit folder */}
      {isEditFolder && <div className="h-0.5 bg-sky-500/60 flex-shrink-0" />}

      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/60 flex-shrink-0">
        {isEditFolder ? (
          <div className="flex items-center gap-1.5 text-sm">
            <button
              onClick={() => setView('library-grid')}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Library
            </button>
            <span className="text-zinc-700">/</span>
            <span className="text-zinc-300 font-medium">Edit</span>
          </div>
        ) : (
          <button
            onClick={() => setView('library-setup')}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Library
          </button>
        )}

        <div className="w-px h-4 bg-zinc-800 mx-1" />

        <button
          onClick={() => setLibrarySelectedIds(new Set(filtered.map((p) => p.id)))}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1.5 rounded hover:bg-zinc-800"
        >
          Select All
        </button>

        {!isEditFolder && (
          <button
            onClick={() => setView('library-edit-folder')}
            className="ml-1 text-xs text-sky-500/70 hover:text-sky-400 transition-colors px-2 py-1.5 rounded hover:bg-zinc-800"
          >
            Edit folder
          </button>
        )}

        {/* Filter tabs */}
        <div className="flex items-center gap-1.5 ml-auto no-drag">
          {(['all', 'untagged', 'to-delete', 'to-edit', 'rated'] as LibraryFilterTab[]).map((f) => {
            const labels: Record<LibraryFilterTab, string> = {
              all: 'All',
              untagged: 'Untagged',
              'to-delete': 'Delete',
              'to-edit': 'Edit',
              rated: '★ Rated'
            }
            const activeClass =
              f === 'to-delete'
                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                : f === 'to-edit'
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                : 'bg-zinc-700 text-zinc-100 border border-zinc-600'
            return (
              <button
                key={f}
                onClick={() => setLibraryFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  libraryFilter === f
                    ? activeClass
                    : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-zinc-700'
                }`}
              >
                {labels[f]} <span className="opacity-60 ml-1">{counts[f]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Scan progress */}
      {libraryScanProgress && libraryScanProgress.done < libraryScanProgress.total && (
        <div className="px-4 py-2 bg-violet-500/5 border-b border-violet-500/10 flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-violet-400 mb-1">
            <span>Scanning library…</span>
            <span>{libraryScanProgress.done} / {libraryScanProgress.total}</span>
          </div>
          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-300"
              style={{ width: `${(libraryScanProgress.done / Math.max(libraryScanProgress.total, 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Photo grid */}
      <div className="flex-1 overflow-y-auto p-4" ref={gridRef}>
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
            {activePhotos.length === 0 ? 'No photos found' : `No ${libraryFilter} photos`}
          </div>
        ) : (
          groups.map((group) => {
            const allSelected = group.photos.every((p) => librarySelectedIds.has(p.id))
            return (
              <div key={group.dateKey} className="mb-6">
                <div className="flex items-center gap-2 mb-2 sticky top-0 bg-[#0f0f11]/95 backdrop-blur-sm py-1.5 z-10">
                  <button
                    onClick={() => handleGroupHeaderClick(group)}
                    className={`flex items-center gap-2 text-sm font-semibold transition-colors ${allSelected ? 'text-indigo-400' : 'text-zinc-300 hover:text-zinc-100'}`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${allSelected ? 'bg-indigo-500 border-indigo-400' : 'border-zinc-600'}`}>
                      {allSelected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    {group.label}
                  </button>
                  <span className="text-xs text-zinc-600">{group.photos.length} photos</span>
                  {group.dateKey !== 'no-date' && group.label !== group.dateKey && (
                    <span className="text-xs text-zinc-700">{group.dateKey}</span>
                  )}
                </div>

                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
                  {group.photos.map((photo, localIndex) => (
                    <LibraryPhotoCard
                      key={photo.id}
                      photo={photo}
                      selected={librarySelectedIds.has(photo.id)}
                      onClick={(e) => handleCardClick(photo, group.startIndex + localIndex, e)}
                      onTagChange={(tag) => handleTagChange(photo, tag)}
                      onRatingChange={(r) => handleRatingChange(photo, r)}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      {dragRect && (
        <div
          className="fixed pointer-events-none border border-indigo-400 bg-indigo-500/10 z-50"
          style={{ left: dragRect.left, top: dragRect.top, width: dragRect.width, height: dragRect.height }}
        />
      )}

      <LibraryTagBar />

      {previewIndex !== null && (
        <LibraryPhotoPreview
          photos={activePhotos}
          initialIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
          onRatingChange={handleRatingChange}
          onTagChange={handleTagChange}
        />
      )}
    </div>
  )
}
