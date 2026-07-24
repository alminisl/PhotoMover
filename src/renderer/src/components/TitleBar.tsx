import { useAppStore } from '../stores/appStore'
import type { AppMode } from '../stores/appStore'
import { CameraIcon, GridIcon } from './icons'

export function TitleBar(): JSX.Element {
  const { view, mode, setMode, setView, libraryPath } = useAppStore()

  function switchMode(m: AppMode): void {
    if (m === mode) return
    setMode(m)
    window.api.saveConfig({ lastMode: m })
    if (m === 'library') {
      setView(libraryPath ? 'library-grid' : 'library-setup')
    } else {
      setView('setup')
    }
  }

  const showToolbar = view !== 'mode-select' && view !== 'transferring'

  return (
    <>
      {/* Native drag region — just the thin top strip */}
      <div className="drag-region h-9 flex items-center px-4 bg-[#0f0f11] flex-shrink-0">
        <span className="text-[13px] font-semibold text-zinc-100 tracking-tight">Photo Manager</span>
      </div>

      {/* Mode toolbar — full-width, clearly visible */}
      {showToolbar && (
        <div className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900/80 border-b border-zinc-800/60 flex-shrink-0 no-drag">
          <button
            onClick={() => switchMode('transfer')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === 'transfer'
                ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:bg-zinc-800'
            }`}
          >
            <CameraIcon className="w-3.5 h-3.5" />
            Transfer
          </button>
          <button
            onClick={() => switchMode('library')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === 'library'
                ? 'bg-violet-500/15 text-violet-400 border border-violet-500/30'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:bg-zinc-800'
            }`}
          >
            <GridIcon className="w-3.5 h-3.5" />
            Library
          </button>
        </div>
      )}
    </>
  )
}
