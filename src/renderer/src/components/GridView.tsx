import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useAppStore } from '../stores/appStore'
import type { TagState, PhotoWithTag } from '../stores/appStore'
import { TagBar } from './TagBar'
import { PhotoCard } from './PhotoCard'
import { PhotoPreview } from './PhotoPreview'
import { ChevronLeftIcon } from './icons'
import { groupPhotos } from '../utils/photoGrouping'
import type { DateGroup } from '../utils/photoGrouping'

interface DragRect { left: number; top: number; width: number; height: number }

export function GridView(): JSX.Element {
  const { photos, scanProgress, setView, selectedIds, setSelectedIds, clearSelection } = useAppStore()
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | TagState>('all')
  const [dragRect, setDragRect] = useState<DragRect | null>(null)
  const lastClickedIndex = useRef<number | null>(null)
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const filtered = filter === 'all' ? photos : photos.filter((p) => p.tag === filter)
  const groups = useMemo(() => groupPhotos(filtered), [filtered])

  useEffect(() => { clearSelection() }, [filter, clearSelection])

  const handleCardClick = useCallback(
    (photo: PhotoWithTag, index: number, e: React.MouseEvent) => {
      if (e.shiftKey && lastClickedIndex.current !== null) {
        const from = Math.min(lastClickedIndex.current, index)
        const to = Math.max(lastClickedIndex.current, index)
        const newSelected = new Set(selectedIds)
        for (let i = from; i <= to; i++) newSelected.add(filtered[i].id)
        setSelectedIds(newSelected)
        return
      }

      if (selectedIds.size > 0) {
        const newSelected = new Set(selectedIds)
        if (newSelected.has(photo.id)) newSelected.delete(photo.id)
        else newSelected.add(photo.id)
        setSelectedIds(newSelected)
        lastClickedIndex.current = index
        return
      }

      setPreviewIndex(photos.indexOf(photo))
      lastClickedIndex.current = index
    },
    [photos, filtered, selectedIds, setSelectedIds]
  )

  function handleGroupHeaderClick(group: DateGroup<PhotoWithTag>): void {
    const ids = group.photos.map(p => p.id)
    const allSelected = ids.every(id => selectedIds.has(id))
    const newSelected = new Set(selectedIds)
    if (allSelected) {
      ids.forEach(id => newSelected.delete(id))
    } else {
      ids.forEach(id => newSelected.add(id))
    }
    setSelectedIds(newSelected)
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
        height: Math.abs(dy),
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

      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) {
        clearSelection()
        return
      }

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
      if (newSelected.size > 0) setSelectedIds(newSelected)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const counts = {
    all: photos.length,
    none: photos.filter((p) => p.tag === 'none').length,
    transfer: photos.filter((p) => p.tag === 'transfer').length,
    delete: photos.filter((p) => p.tag === 'delete').length
  }

  return (
    <div className="flex flex-col h-full" onMouseDown={handleGridMouseDown}>
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/60 flex-shrink-0">
        <button
          onClick={() => setView('setup')}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Back
        </button>

        <div className="w-px h-4 bg-zinc-800 mx-1" />

        {/* Select All */}
        <button
          onClick={() => setSelectedIds(new Set(filtered.map(p => p.id)))}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1.5 rounded hover:bg-zinc-800"
        >
          Select All
        </button>

        {/* Filter tabs */}
        <div className="flex items-center gap-1.5 ml-auto no-drag">
          {(['all', 'none', 'transfer', 'delete'] as const).map((f) => {
            const labels = { all: 'All', none: 'Untagged', transfer: 'Transfer', delete: 'Delete' }
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${filter === f
                    ? f === 'delete'
                      ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                      : f === 'transfer'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-zinc-700 text-zinc-100 border border-zinc-600'
                    : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-zinc-700'
                  }
                `}
              >
                {labels[f]} <span className="opacity-60 ml-1">{counts[f]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Scan progress */}
      {scanProgress && scanProgress.done < scanProgress.total && (
        <div className="px-4 py-2 bg-indigo-500/5 border-b border-indigo-500/10 flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-indigo-400 mb-1">
            <span>Scanning photos...</span>
            <span>{scanProgress.done} / {scanProgress.total}</span>
          </div>
          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${(scanProgress.done / scanProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Date-grouped photo grid */}
      <div className="flex-1 overflow-y-auto p-4" ref={gridRef}>
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
            {photos.length === 0 ? 'No photos found' : `No ${filter} photos`}
          </div>
        ) : (
          groups.map((group) => {
            const allSelected = group.photos.every(p => selectedIds.has(p.id))
            return (
              <div key={group.dateKey} className="mb-6">
                {/* Date header */}
                <div className="flex items-center gap-2 mb-2 sticky top-0 bg-[#0f0f11]/95 backdrop-blur-sm py-1.5 z-10">
                  <button
                    onClick={() => handleGroupHeaderClick(group)}
                    className={`
                      flex items-center gap-2 text-sm font-semibold transition-colors
                      ${allSelected ? 'text-indigo-400' : 'text-zinc-300 hover:text-zinc-100'}
                    `}
                  >
                    <span className={`
                      w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors
                      ${allSelected ? 'bg-indigo-500 border-indigo-400' : 'border-zinc-600'}
                    `}>
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

                {/* Cards */}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
                  {group.photos.map((photo, localIndex) => (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      selected={selectedIds.has(photo.id)}
                      onClick={(e) => handleCardClick(photo, group.startIndex + localIndex, e)}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Drag selection rectangle */}
      {dragRect && (
        <div
          className="fixed pointer-events-none border border-indigo-400 bg-indigo-500/10 z-50"
          style={{ left: dragRect.left, top: dragRect.top, width: dragRect.width, height: dragRect.height }}
        />
      )}

      {/* Tag action bar */}
      <TagBar />

      {/* Preview modal */}
      {previewIndex !== null && (
        <PhotoPreview
          photos={photos}
          initialIndex={previewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </div>
  )
}
