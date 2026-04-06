import { useEffect, useState } from 'react'

interface Progress {
  current: number
  total: number
  currentFile: string
  bytesTransferred: number
  totalBytes: number
}

export function TransferView(): JSX.Element {
  const [progress, setProgress] = useState<Progress | null>(null)

  useEffect(() => {
    const unsub = window.api.onTransferProgress((p) => {
      setProgress(p)
    })
    return unsub
  }, [])

  const pct = progress
    ? progress.totalBytes > 0
      ? Math.round((progress.bytesTransferred / progress.totalBytes) * 100)
      : Math.round((progress.current / progress.total) * 100)
    : 0

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-full max-w-md px-6 animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-4">
            <span className="text-2xl">📷</span>
          </div>
          <h2 className="text-xl font-semibold text-zinc-100">Transferring Photos</h2>
          <p className="text-zinc-500 text-sm mt-1">Please don't remove your SD card</p>
        </div>

        {progress && (
          <>
            <div className="mb-2 flex justify-between text-xs text-zinc-500">
              <span>Photo {progress.current} of {progress.total}</span>
              <span>{pct}%</span>
            </div>

            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>

            <p className="text-xs text-zinc-600 truncate text-center">{progress.currentFile}</p>
          </>
        )}

        {!progress && (
          <div className="flex justify-center">
            <span className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}
