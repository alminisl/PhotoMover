import { StarIcon } from './icons'

interface StarRatingProps {
  rating: number
  onChange?: (rating: number) => void
  size?: 'sm' | 'md'
  className?: string
}

export function StarRating({ rating, onChange, size = 'sm', className = '' }: StarRatingProps): JSX.Element {
  const dim = size === 'sm' ? 'w-2.5 h-2.5' : 'w-5 h-5'

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={(e) => {
            e.stopPropagation()
            onChange?.(rating === star ? 0 : star)
          }}
          className={`transition-colors duration-100 ${onChange ? 'cursor-pointer' : 'cursor-default'}`}
          tabIndex={-1}
        >
          <StarIcon
            filled={star <= rating}
            className={`${dim} ${star <= rating ? 'text-amber-400' : 'text-zinc-700 group-hover:text-zinc-500'} transition-colors`}
          />
        </button>
      ))}
    </div>
  )
}
