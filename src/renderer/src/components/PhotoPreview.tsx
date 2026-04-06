import { useState, useEffect, useCallback } from 'react'
import type { PhotoWithTag } from '../stores/appStore'
import { useAppStore } from '../stores/appStore'
import { XIcon, ChevronLeftIcon, ChevronRightIcon, ArrowRightIcon, TrashIcon } from './icons'

interface PhotoPreviewProps {
  photos: PhotoWithTag[]
  initialIndex: number
  onClose: () => void
}

export function PhotoPreview({ photos, initialIndex, onClose }: PhotoPreviewProps): JSX.Element {
  const [index, setIndex] = useState(initialIndex)
  const setTag = useAppStore((s) => s.setTag)

  const photo = photos[index]

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])
  const next = useCallback(() => setIndex((i) => Math.min(photos.length - 1, i + 1)), [photos.length])

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
      if (e.key === 't' || e.key === 'T') setTag(photo.id, photo.tag === 'transfer' ? 'none' : 'transfer')
      if (e.key === 'd' || e.key === 'D') setTag(photo.id, photo.tag === 'delete' ? 'none' : 'delete')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next, photo, setTag])

  if (!photo) return <></>

  const thumbSrc = photo.thumbnailData ?? null

  const exifRows: { label: string; value: string | null }[] = [
    { label: 'Camera', value: [photo.make, photo.model].filter(Boolean).join(' ') || null },
    { label: 'Date', value: photo.dateTaken ? new Date(photo.dateTaken).toLocaleString() : null },
    { label: 'ISO', value: photo.iso ? `ISO ${photo.iso}` : null },
    { label: 'Aperture', value: photo.fNumber ? `f/${photo.fNumber}` : null },
    { label: 'Shutter', value: photo.exposureTime ? formatShutter(photo.exposureTime) : null },
    { label: 'Focal length', value: photo.focalLength ? `${photo.focalLength}mm` : null },
    { label: 'Dimensions', value: photo.width && photo.height ? `${photo.width} × ${photo.height}` : null },
    { label: 'File size', value: photo.size ? formatBytes(photo.size) : null }
  ].filter((r) => r.value)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex animate-fade-in"
      onClick={onClose}
    >
      {/* Left arrow */}
      <button
        onClick={(e) => { e.stopPropagation(); prev() }}
        disabled={index === 0}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-20 transition-all"
      >
        <ChevronLeftIcon className="w-5 h-5" />
      </button>

      {/* Right arrow */}
      <button
        onClick={(e) => { e.stopPropagation(); next() }}
        disabled={index === photos.length - 1}
        className="absolute right-72 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-20 transition-all"
      >
        <ChevronRightIcon className="w-5 h-5" />
      </button>

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
      >
        <XIcon className="w-4 h-4" />
      </button>

      {/* Image area */}
      <div
        className="flex-1 flex items-center justify-center p-16"
        onClick={(e) => e.stopPropagation()}
      >
        {thumbSrc ? (
          <img
            src={thumbSrc}
            alt={photo.filename}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            draggable={false}
          />
        ) : (
          <div className="text-zinc-600 text-sm">No preview available</div>
        )}
      </div>

      {/* Side panel */}
      <div
        className="w-64 bg-zinc-900 border-l border-zinc-800 flex flex-col flex-shrink-0 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pt-10 pb-4 px-4 border-b border-zinc-800">
          <p className="text-xs text-zinc-500 mb-1">{index + 1} of {photos.length}</p>
          <p className="text-sm font-medium text-zinc-100 break-all leading-snug">{photo.filename}</p>
        </div>

        {/* Tag buttons */}
        <div className="p-4 border-b border-zinc-800 space-y-2">
          <button
            onClick={() => setTag(photo.id, photo.tag === 'transfer' ? 'none' : 'transfer')}
            className={`
              w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all
              ${photo.tag === 'transfer'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-emerald-500/40 hover:text-emerald-400'
              }
            `}
          >
            <ArrowRightIcon className="w-4 h-4" />
            {photo.tag === 'transfer' ? 'Tagged for transfer' : 'Tag for transfer'}
            <kbd className="ml-auto text-[10px] opacity-40">T</kbd>
          </button>

          <button
            onClick={() => setTag(photo.id, photo.tag === 'delete' ? 'none' : 'delete')}
            className={`
              w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all
              ${photo.tag === 'delete'
                ? 'bg-red-500/10 border-red-500/40 text-red-400'
                : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-red-500/40 hover:text-red-400'
              }
            `}
          >
            <TrashIcon className="w-4 h-4" />
            {photo.tag === 'delete' ? 'Tagged for deletion' : 'Tag for deletion'}
            <kbd className="ml-auto text-[10px] opacity-40">D</kbd>
          </button>
        </div>

        {/* EXIF data */}
        <div className="p-4 space-y-3">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Details</p>
          {exifRows.map((row) => (
            <div key={row.label}>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{row.label}</p>
              <p className="text-xs text-zinc-300 mt-0.5">{row.value}</p>
            </div>
          ))}
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="mt-auto p-4 border-t border-zinc-800">
          <p className="text-[10px] text-zinc-700">
            ← → navigate &nbsp;·&nbsp; T transfer &nbsp;·&nbsp; D delete &nbsp;·&nbsp; Esc close
          </p>
        </div>
      </div>
    </div>
  )
}

function formatShutter(s: number): string {
  if (s >= 1) return `${s}s`
  return `1/${Math.round(1 / s)}s`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
