import { memo } from 'react'
import type { PhotoWithLibraryTag, LibraryTagState } from '../stores/appStore'
import { TrashIcon, PencilIcon } from './icons'
import { StarRating } from './StarRating'

interface LibraryPhotoCardProps {
  photo: PhotoWithLibraryTag
  selected?: boolean
  onClick: (e: React.MouseEvent) => void
  onTagChange: (tag: LibraryTagState) => void
  onRatingChange: (rating: number) => void
}

export const LibraryPhotoCard = memo(function LibraryPhotoCard({
  photo,
  selected = false,
  onClick,
  onTagChange,
  onRatingChange
}: LibraryPhotoCardProps): JSX.Element {
  const tagRingClass = selected
    ? 'ring-2 ring-indigo-400'
    : photo.libraryTag === 'to-delete'
    ? 'ring-2 ring-rose-500'
    : photo.libraryTag === 'to-edit'
    ? 'ring-2 ring-sky-500'
    : 'ring-1 ring-zinc-800'

  function handleDelete(e: React.MouseEvent): void {
    e.stopPropagation()
    onTagChange(photo.libraryTag === 'to-delete' ? 'none' : 'to-delete')
  }

  function handleEdit(e: React.MouseEvent): void {
    e.stopPropagation()
    onTagChange(photo.libraryTag === 'to-edit' ? 'none' : 'to-edit')
  }

  const dateStr = photo.dateTaken
    ? new Date(photo.dateTaken).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'No date'

  return (
    <div
      data-photo-id={photo.id}
      onClick={onClick}
      className={`group relative rounded-xl overflow-hidden cursor-pointer bg-zinc-900 transition-all duration-150 hover:scale-[1.02] ${tagRingClass}`}
      style={{ aspectRatio: '1', contentVisibility: 'auto', containIntrinsicSize: '160px 160px' }}
    >
      {/* Thumbnail */}
      {photo.thumbnailData ? (
        <img
          src={photo.thumbnailData}
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

      {/* Selection overlay */}
      {selected && <div className="absolute inset-0 bg-indigo-500/10 pointer-events-none" />}

      {/* Selection circle */}
      <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all z-10 ${selected ? 'bg-indigo-500 border-indigo-400' : 'bg-black/40 border-white/30 opacity-0 group-hover:opacity-100'}`}>
        {selected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      {/* Tag badge */}
      {photo.libraryTag !== 'none' && (
        <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${photo.libraryTag === 'to-delete' ? 'bg-rose-500 text-white' : 'bg-sky-500 text-white'}`}>
          {photo.libraryTag === 'to-delete' ? 'Delete' : 'Edit'}
        </div>
      )}

      {/* Star rating — always visible at bottom */}
      <div className="absolute bottom-0 left-0 right-0 px-1.5 pb-1.5 flex items-center justify-between pointer-events-none">
        <StarRating
          rating={photo.rating}
          onChange={onRatingChange}
          size="sm"
          className="pointer-events-auto"
        />
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <div className="absolute bottom-0 left-0 right-0 p-2 pb-6">
          <p className="text-[10px] text-white/90 truncate">{photo.filename}</p>
          <p className="text-[10px] text-white/50">{dateStr}</p>
        </div>

        {/* Action buttons */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <button
            onClick={handleDelete}
            title="Tag for deletion"
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${photo.libraryTag === 'to-delete' ? 'bg-rose-500 text-white' : 'bg-black/50 text-white/80 hover:bg-rose-500 hover:text-white'}`}
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleEdit}
            title="Tag for editing"
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${photo.libraryTag === 'to-edit' ? 'bg-sky-500 text-white' : 'bg-black/50 text-white/80 hover:bg-sky-500 hover:text-white'}`}
          >
            <PencilIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
})
