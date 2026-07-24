import { useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { TrashIcon, PencilIcon, XIcon, ArrowRightIcon } from './icons'
import { StarRating } from './StarRating'

export function LibraryTagBar(): JSX.Element {
  const {
    view,
    libraryPhotos,
    editFolderPhotos,
    librarySelectedIds,
    setLibraryTagBulk,
    setLibraryTagAll,
    setRatingBulk,
    clearLibrarySelection,
    removeLibraryPhotos
  } = useAppStore()

  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [flashMsg, setFlashMsg] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const activePhotos = view === 'library-edit-folder' ? editFolderPhotos : libraryPhotos
  const toDelete = activePhotos.filter((p) => p.libraryTag === 'to-delete')
  const toEdit = activePhotos.filter((p) => p.libraryTag === 'to-edit')

  const deleteBytes = toDelete.reduce((s, p) => s + (p.size ?? 0), 0)
  const editBytes = toEdit.reduce((s, p) => s + (p.size ?? 0), 0)

  function flash(msg: string): void {
    setFlashMsg(msg)
    setTimeout(() => setFlashMsg(null), 1200)
  }

  async function handleMoveToEdit(): Promise<void> {
    const paths = toEdit.map((p) => p.path)
    if (paths.length === 0) return
    setMoving(true)
    const result = await window.api.moveToEdit(paths)
    if (result.ok || result.moved.length > 0) {
      removeLibraryPhotos(paths)
    }
    setMoving(false)
  }

  async function handleDelete(): Promise<void> {
    const paths = toDelete.map((p) => p.path)
    if (paths.length === 0) return
    setShowConfirmDelete(false)
    setDeleting(true)
    const result = await window.api.deleteLibraryPhotos(paths)
    if (result.deleted.length > 0) {
      removeLibraryPhotos(result.deleted)
    }
    setDeleting(false)
  }

  // Selection mode bar
  if (librarySelectedIds.size > 0) {
    const selIds = [...librarySelectedIds]
    return (
      <div className="border-t border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
          <span className={`text-xs font-medium transition-colors duration-150 ${flashMsg ? 'text-violet-400' : 'text-indigo-400'}`}>
            {flashMsg ?? `${librarySelectedIds.size} selected`}
          </span>
          <div className="flex-1" />
          <button
            onClick={() => { setLibraryTagBulk(selIds, 'none'); flash('Cleared') }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-800"
          >
            Clear tag <kbd className="ml-1 px-1 py-0.5 rounded bg-zinc-800 text-zinc-500 text-[10px]">R</kbd>
          </button>
          <button
            onClick={() => { setLibraryTagBulk(selIds, 'to-delete'); flash(`${selIds.length} tagged for deletion`) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors text-xs"
          >
            <TrashIcon className="w-3.5 h-3.5" />
            Delete <kbd className="ml-1 px-1 py-0.5 rounded bg-zinc-900 text-rose-500/60 text-[10px]">D</kbd>
          </button>
          <button
            onClick={() => { setLibraryTagBulk(selIds, 'to-edit'); flash(`${selIds.length} tagged for edit`) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 transition-colors text-xs"
          >
            <PencilIcon className="w-3.5 h-3.5" />
            Edit <kbd className="ml-1 px-1 py-0.5 rounded bg-zinc-900 text-sky-500/60 text-[10px]">E</kbd>
          </button>
          <StarRating
            rating={0}
            onChange={(r) => {
              setRatingBulk(selIds, r)
              window.api.saveLibraryMetadata(
                selIds.map((id) => {
                  const photo = activePhotos.find((p) => p.id === id)
                  return photo ? { absolutePath: photo.path, rating: r } : null
                }).filter(Boolean) as Array<{ absolutePath: string; rating: number }>
              )
              flash(`${selIds.length} rated ${r}★`)
            }}
            size="md"
          />
          <button
            onClick={clearLibrarySelection}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  if (toDelete.length === 0 && toEdit.length === 0) {
    return (
      <div className="px-4 py-3 border-t border-zinc-800/60 flex-shrink-0">
        <p className="text-center text-xs text-zinc-600">
          Select photos — then{' '}
          <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]">D</kbd> delete ·{' '}
          <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]">E</kbd> edit ·{' '}
          <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]">1–5</kbd> rate ·{' '}
          <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]">0</kbd> clear rating
        </p>
      </div>
    )
  }

  return (
    <div className="border-t border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm flex-shrink-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setLibraryTagAll('none')}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-800"
          >
            Clear tags
          </button>
        </div>

        <div className="flex-1" />

        {toEdit.length > 0 && (
          <button
            onClick={handleMoveToEdit}
            disabled={moving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white shadow-lg shadow-sky-500/20 transition-all disabled:opacity-50 disabled:cursor-wait"
          >
            <ArrowRightIcon className="w-4 h-4" />
            {moving ? 'Moving…' : `Move ${toEdit.length} to Edit`}
            <span className="text-sky-200/70 text-xs">{formatBytes(editBytes)}</span>
          </button>
        )}

        {toDelete.length > 0 && (
          <>
            {showConfirmDelete ? (
              <div className="flex items-center gap-2 animate-fade-in">
                <span className="text-xs text-rose-400">Delete {toDelete.length} photos permanently?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500 hover:bg-rose-400 text-white transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Confirm'}
                </button>
                <button
                  onClick={() => setShowConfirmDelete(false)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirmDelete(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors text-sm"
              >
                <TrashIcon className="w-4 h-4" />
                <span>Delete {toDelete.length}</span>
                <span className="text-rose-500/60 text-xs">{formatBytes(deleteBytes)}</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
