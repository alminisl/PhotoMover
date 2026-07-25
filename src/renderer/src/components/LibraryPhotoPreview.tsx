import { useState, useEffect, useCallback } from 'react'
import type { PhotoWithLibraryTag, LibraryTagState } from '../stores/appStore'
import { XIcon, ChevronLeftIcon, ChevronRightIcon, TrashIcon, PencilIcon } from './icons'
import { StarRating } from './StarRating'
import { ZoomableImage } from './ZoomableImage'

interface LibraryPhotoPreviewProps {
  photos: PhotoWithLibraryTag[]
  initialIndex: number
  onClose: () => void
  onRatingChange: (photo: PhotoWithLibraryTag, rating: number) => void
  onTagChange: (photo: PhotoWithLibraryTag, tag: LibraryTagState) => void
}

export function LibraryPhotoPreview({
  photos,
  initialIndex,
  onClose,
  onRatingChange,
  onTagChange
}: LibraryPhotoPreviewProps): JSX.Element {
  const [index, setIndex] = useState(initialIndex)
  const [fullSrc, setFullSrc] = useState<string | null>(null)

  const photo = photos[index]

  // Load the full-resolution image; until it arrives the thumbnail is shown
  useEffect(() => {
    let alive = true
    setFullSrc(null)
    if (!photo) return undefined
    window.api.getFullPreview(photo.path).then((url) => {
      if (alive) setFullSrc(url)
    })
    return () => {
      alive = false
    }
  }, [photo?.path])

  // Prefetch neighbors so arrow-key navigation doesn't wait on disk
  useEffect(() => {
    let alive = true
    for (const neighbor of [photos[index + 1], photos[index - 1]]) {
      if (!neighbor) continue
      window.api.getFullPreview(neighbor.path).then((url) => {
        if (alive && url) {
          const img = new Image()
          img.src = url
        }
      })
    }
    return () => {
      alive = false
    }
  }, [index, photos])

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])
  const next = useCallback(() => setIndex((i) => Math.min(photos.length - 1, i + 1)), [photos.length])

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowLeft') { prev(); return }
      if (e.key === 'ArrowRight') { next(); return }
      if (!photo) return
      if (e.key === 'd' || e.key === 'D') onTagChange(photo, photo.libraryTag === 'to-delete' ? 'none' : 'to-delete')
      if (e.key === 'e' || e.key === 'E') onTagChange(photo, photo.libraryTag === 'to-edit' ? 'none' : 'to-edit')
      if (e.key === 'r' || e.key === 'R') onTagChange(photo, 'none')
      const digit = parseInt(e.key)
      if (digit >= 0 && digit <= 5) onRatingChange(photo, digit)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next, photo, onTagChange, onRatingChange])

  if (!photo) return <></>

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
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex animate-fade-in" onClick={onClose}>
      <button
        onClick={(e) => { e.stopPropagation(); prev() }}
        disabled={index === 0}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-20 transition-all"
      >
        <ChevronLeftIcon className="w-5 h-5" />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); next() }}
        disabled={index === photos.length - 1}
        className="absolute right-72 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white disabled:opacity-20 transition-all"
      >
        <ChevronRightIcon className="w-5 h-5" />
      </button>

      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
      >
        <XIcon className="w-4 h-4" />
      </button>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center p-16" onClick={(e) => e.stopPropagation()}>
        {(fullSrc ?? photo.thumbnailData) ? (
          <ZoomableImage
            src={(fullSrc ?? photo.thumbnailData)!}
            alt={photo.filename}
            onError={() => setFullSrc(null)}
          />
        ) : (
          <div className="text-zinc-600 text-sm">No preview available</div>
        )}
      </div>

      {/* Side panel */}
      <div className="w-64 bg-zinc-900 border-l border-zinc-800 flex flex-col flex-shrink-0 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="pt-10 pb-4 px-4 border-b border-zinc-800">
          <p className="text-xs text-zinc-500 mb-1">{index + 1} of {photos.length}</p>
          <p className="text-sm font-medium text-zinc-100 break-all leading-snug">{photo.filename}</p>
        </div>

        {/* Rating */}
        <div className="px-4 pt-4 pb-3 border-b border-zinc-800">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Rating</p>
          <StarRating
            rating={photo.rating}
            onChange={(r) => onRatingChange(photo, r)}
            size="md"
          />
        </div>

        {/* Tag buttons */}
        <div className="p-4 border-b border-zinc-800 space-y-2">
          <button
            onClick={() => onTagChange(photo, photo.libraryTag === 'to-delete' ? 'none' : 'to-delete')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              photo.libraryTag === 'to-delete'
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-rose-500/40 hover:text-rose-400'
            }`}
          >
            <TrashIcon className="w-4 h-4" />
            {photo.libraryTag === 'to-delete' ? 'Tagged for deletion' : 'Tag for deletion'}
            <kbd className="ml-auto text-[10px] opacity-40">D</kbd>
          </button>

          <button
            onClick={() => onTagChange(photo, photo.libraryTag === 'to-edit' ? 'none' : 'to-edit')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              photo.libraryTag === 'to-edit'
                ? 'bg-sky-500/10 border-sky-500/40 text-sky-400'
                : 'bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:border-sky-500/40 hover:text-sky-400'
            }`}
          >
            <PencilIcon className="w-4 h-4" />
            {photo.libraryTag === 'to-edit' ? 'Tagged for editing' : 'Tag for editing'}
            <kbd className="ml-auto text-[10px] opacity-40">E</kbd>
          </button>
        </div>

        {/* EXIF */}
        <div className="p-4 space-y-3">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Details</p>
          {exifRows.map((row) => (
            <div key={row.label}>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider">{row.label}</p>
              <p className="text-xs text-zinc-300 mt-0.5">{row.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-auto p-4 border-t border-zinc-800">
          <p className="text-[10px] text-zinc-700">← → navigate · scroll zoom · 2×click 100% · D delete · E edit · 1–5 rate · 0 clear · Esc close</p>
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
