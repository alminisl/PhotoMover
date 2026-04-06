import { useState, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import type { TagState, PhotoWithTag } from '../stores/appStore'
import { TagBar } from './TagBar'
import { PhotoCard } from './PhotoCard'
import { PhotoPreview } from './PhotoPreview'
import { ChevronLeftIcon } from './icons'

export function GridView(): JSX.Element {
  const { photos, scanProgress, setView } = useAppStore()
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [filter, setFilter] = useState<'all' | TagState>('all')

  const filtered = filter === 'all' ? photos : photos.filter((p) => p.tag === filter)

  const handleCardClick = useCallback(
    (photo: PhotoWithTag) => {
      const idx = photos.indexOf(photo)
      setPreviewIndex(idx)
    },
    [photos]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60 flex-shrink-0">
        <button
          onClick={() => setView('setup')}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-1.5 ml-auto no-drag">
          {(['all', 'none', 'transfer', 'delete'] as const).map((f) => {
            const labels = { all: 'All', none: 'Untagged', transfer: 'Transfer', delete: 'Delete' }
            const counts = {
              all: photos.length,
              none: photos.filter((p) => p.tag === 'none').length,
              transfer: photos.filter((p) => p.tag === 'transfer').length,
              delete: photos.filter((p) => p.tag === 'delete').length
            }
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

      {/* Photo grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
            {photos.length === 0 ? 'No photos found' : `No ${filter} photos`}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
            {filtered.map((photo) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                onClick={() => handleCardClick(photo)}
              />
            ))}
          </div>
        )}
      </div>

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
