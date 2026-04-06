import { useAppStore } from '../stores/appStore'
import { CheckIcon } from './icons'

export function DoneView(): JSX.Element {
  const { transferResult, destinationPath, setView, clearPhotos } = useAppStore()

  function handleTransferMore(): void {
    clearPhotos()
    setView('grid')
  }

  function handleStartOver(): void {
    clearPhotos()
    setView('setup')
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-full max-w-sm px-6 text-center animate-slide-up">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-6">
          <CheckIcon className="w-8 h-8 text-emerald-400" />
        </div>

        <h2 className="text-xl font-semibold text-zinc-100 mb-1">Transfer Complete</h2>

        {transferResult && (
          <div className="mt-6 mb-8 grid grid-cols-3 gap-3">
            <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
              <p className="text-2xl font-semibold text-zinc-100">{transferResult.transferred}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Transferred</p>
            </div>
            <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
              <p className="text-2xl font-semibold text-zinc-400">{transferResult.skipped}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Skipped</p>
            </div>
            <div className={`bg-zinc-900 rounded-xl p-3 border ${transferResult.errors.length > 0 ? 'border-red-500/30' : 'border-zinc-800'}`}>
              <p className={`text-2xl font-semibold ${transferResult.errors.length > 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                {transferResult.errors.length}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">Errors</p>
            </div>
          </div>
        )}

        {destinationPath && (
          <p className="text-xs text-zinc-600 mb-6 truncate">
            Saved to: <span className="text-zinc-400">{destinationPath}</span>
          </p>
        )}

        {transferResult?.errors.length ? (
          <div className="mb-6 text-left bg-red-500/5 border border-red-500/20 rounded-xl p-3">
            <p className="text-xs font-medium text-red-400 mb-2">Errors:</p>
            <ul className="space-y-1">
              {transferResult.errors.slice(0, 5).map((e, i) => (
                <li key={i} className="text-[10px] text-red-400/70 truncate">{e}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex gap-3">
          <button
            onClick={handleStartOver}
            className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 text-sm transition-all"
          >
            New Import
          </button>
          <button
            onClick={handleTransferMore}
            className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
          >
            Review More
          </button>
        </div>
      </div>
    </div>
  )
}
