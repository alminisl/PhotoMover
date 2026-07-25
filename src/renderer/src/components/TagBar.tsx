import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/appStore'
import { ArrowRightIcon, TrashIcon, XIcon } from './icons'

export function TagBar(): JSX.Element {
  const { photos, destinationPath, setTagAll, setTagBulk, setView, setTransferResult, selectedIds, clearSelection } = useAppStore()
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)
  const [safeDelete, setSafeDelete] = useState(true)

  useEffect(() => {
    window.api.loadConfig().then((c) => setSafeDelete(c.safeDelete && !!c.destinationPath))
  }, [])

  const toTransfer = photos.filter((p) => p.tag === 'transfer')
  const toDelete = photos.filter((p) => p.tag === 'delete')

  const transferBytes = toTransfer.reduce((s, p) => s + (p.size ?? 0), 0)
  const deleteBytes = toDelete.reduce((s, p) => s + (p.size ?? 0), 0)

  async function handleTransfer(): Promise<void> {
    if (!destinationPath || toTransfer.length === 0) return
    setView('transferring')

    const result = await window.api.startTransfer(
      toTransfer.map((p) => ({ ...p })),
      destinationPath
    )

    setTransferResult(result)
    setView('done')
  }

  async function handleDelete(): Promise<void> {
    if (toDelete.length === 0) return
    setShowConfirmDelete(false)

    const paths = toDelete.map((p) => p.path)
    await window.api.deletePhotos(paths)
    // Remove deleted photos from store
    useAppStore.getState().setTagBulk(toDelete.map((p) => p.id), 'none')
  }

  // Selection mode bar
  if (selectedIds.size > 0) {
    const selIds = [...selectedIds]
    return (
      <div className="border-t border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-xs text-indigo-400 font-medium">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <button
            onClick={() => { setTagBulk(selIds, 'none'); clearSelection() }}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-800"
          >
            Clear tag
          </button>
          <button
            onClick={() => { setTagBulk(selIds, 'delete'); clearSelection() }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-xs"
          >
            <TrashIcon className="w-3.5 h-3.5" />
            Tag delete
          </button>
          <button
            onClick={() => { setTagBulk(selIds, 'transfer'); clearSelection() }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-medium transition-colors"
          >
            <ArrowRightIcon className="w-3.5 h-3.5" />
            Tag transfer
          </button>
          <button
            onClick={clearSelection}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  if (toTransfer.length === 0 && toDelete.length === 0) {
    return (
      <div className="px-4 py-3 border-t border-zinc-800/60 flex-shrink-0">
        <p className="text-center text-xs text-zinc-600">
          Hover photos and use <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]">→</kbd> to transfer or{' '}
          <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]">🗑</kbd> to delete — shift-click or drag to multi-select
        </p>
      </div>
    )
  }

  return (
    <div className="border-t border-zinc-800/60 bg-zinc-900/80 backdrop-blur-sm flex-shrink-0">
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Quick actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setTagAll('transfer')}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-800"
          >
            Tag all
          </button>
          <button
            onClick={() => setTagAll('none')}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-800"
          >
            Clear tags
          </button>
        </div>

        <div className="flex-1" />

        {/* Delete button */}
        {toDelete.length > 0 && (
          <>
            {showConfirmDelete ? (
              <div className="flex items-center gap-2 animate-fade-in">
                <span className="text-xs text-red-400">
                  {safeDelete
                    ? `Move ${toDelete.length} photos to _Rejects?`
                    : `Permanently delete ${toDelete.length} photos?`}
                </span>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500 hover:bg-red-400 text-white transition-colors"
                >
                  Confirm
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
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors text-sm"
              >
                <TrashIcon className="w-4 h-4" />
                <span>Delete {toDelete.length}</span>
                <span className="text-red-500/60 text-xs">{formatBytes(deleteBytes)}</span>
              </button>
            )}
          </>
        )}

        {/* Transfer button */}
        {toTransfer.length > 0 && (
          <button
            onClick={handleTransfer}
            disabled={!destinationPath}
            className="
              flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm
              bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white
              shadow-lg shadow-indigo-500/20 transition-all
              disabled:opacity-40 disabled:cursor-not-allowed
            "
          >
            <ArrowRightIcon className="w-4 h-4" />
            Transfer {toTransfer.length} photos
            <span className="text-indigo-200/70 text-xs">{formatBytes(transferBytes)}</span>
          </button>
        )}
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
