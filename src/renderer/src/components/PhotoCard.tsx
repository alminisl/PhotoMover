import { useAppStore } from '../stores/appStore'
import type { PhotoWithTag } from '../stores/appStore'
import { TrashIcon, ArrowRightIcon } from './icons'

interface PhotoCardProps {
  photo: PhotoWithTag
  onClick: () => void
}

export function PhotoCard({ photo, onClick }: PhotoCardProps): JSX.Element {
  const setTag = useAppStore((s) => s.setTag)

  const thumbSrc = photo.thumbnailData ?? null

  const tagRingClass =
    photo.tag === 'transfer'
      ? 'ring-2 ring-emerald-500'
      : photo.tag === 'delete'
      ? 'ring-2 ring-red-500'
      : 'ring-1 ring-zinc-800'

  function handleTransfer(e: React.MouseEvent): void {
    e.stopPropagation()
    setTag(photo.id, photo.tag === 'transfer' ? 'none' : 'transfer')
  }

  function handleDelete(e: React.MouseEvent): void {
    e.stopPropagation()
    setTag(photo.id, photo.tag === 'delete' ? 'none' : 'delete')
  }

  const dateStr = photo.dateTaken
    ? new Date(photo.dateTaken).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'No date'

  return (
    <div
      onClick={onClick}
      className={`
        group relative rounded-xl overflow-hidden cursor-pointer
        bg-zinc-900 transition-all duration-150 hover:scale-[1.02]
        ${tagRingClass}
      `}
      style={{ aspectRatio: '1' }}
    >
      {/* Thumbnail */}
      {thumbSrc ? (
        <img
          src={thumbSrc}
          alt={photo.filename}
          className="w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-zinc-700">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        </div>
      )}

      {/* Tag badge */}
      {photo.tag !== 'none' && (
        <div className={`
          absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider
          ${photo.tag === 'transfer' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}
        `}>
          {photo.tag === 'transfer' ? 'Transfer' : 'Delete'}
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-[10px] text-white/90 truncate">{photo.filename}</p>
          <p className="text-[10px] text-white/50">{dateStr}</p>
        </div>

        {/* Action buttons */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <button
            onClick={handleTransfer}
            title="Tag for transfer"
            className={`
              w-7 h-7 rounded-lg flex items-center justify-center transition-all
              ${photo.tag === 'transfer'
                ? 'bg-emerald-500 text-white'
                : 'bg-black/50 text-white/80 hover:bg-emerald-500 hover:text-white'
              }
            `}
          >
            <ArrowRightIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDelete}
            title="Tag for deletion"
            className={`
              w-7 h-7 rounded-lg flex items-center justify-center transition-all
              ${photo.tag === 'delete'
                ? 'bg-red-500 text-white'
                : 'bg-black/50 text-white/80 hover:bg-red-500 hover:text-white'
              }
            `}
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
