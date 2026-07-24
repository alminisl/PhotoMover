export interface DateGroup<T> {
  label: string
  dateKey: string
  photos: T[]
  startIndex: number
}

export function toDateKey(date: Date | null): string {
  if (!date || isNaN(new Date(date).getTime())) return 'no-date'
  return new Date(date).toISOString().slice(0, 10)
}

export function getDateLabel(key: string): string {
  if (key === 'no-date') return 'No Date'
  const date = new Date(key + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.getTime() === today.getTime()) return 'Today'
  if (date.getTime() === yesterday.getTime()) return 'Yesterday'
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000)
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' })
  return key
}

export function groupPhotos<T extends { dateTaken: Date | null }>(photos: T[]): DateGroup<T>[] {
  const map = new Map<string, T[]>()
  for (const p of photos) {
    const key = toDateKey(p.dateTaken ? new Date(p.dateTaken) : null)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(p)
  }

  const sorted = [...map.entries()].sort((a, b) => {
    if (a[0] === 'no-date') return 1
    if (b[0] === 'no-date') return -1
    return b[0].localeCompare(a[0])
  })

  let startIndex = 0
  return sorted.map(([key, photos]) => {
    const group: DateGroup<T> = { label: getDateLabel(key), dateKey: key, photos, startIndex }
    startIndex += photos.length
    return group
  })
}
