import { useAppStore } from '../stores/appStore'
import { CameraIcon, GridIcon } from './icons'

export function ModeSelectView(): JSX.Element {
  const { setMode, setView, libraryPath } = useAppStore()

  function pickTransfer(): void {
    setMode('transfer')
    setView('setup')
    window.api.saveConfig({ lastMode: 'transfer' })
  }

  function pickLibrary(): void {
    setMode('library')
    window.api.saveConfig({ lastMode: 'library' })
    if (libraryPath) {
      setView('library-grid')
    } else {
      setView('library-setup')
    }
  }

  return (
    <div className="flex items-center justify-center h-full bg-[#0f0f11]">
      <div className="w-full max-w-lg px-6 animate-slide-up">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">Photo Manager</h1>
          <p className="text-zinc-500 text-sm mt-1.5">What would you like to do?</p>
        </div>

        <div className="flex gap-4">
          <ModeCard
            icon={<CameraIcon className="w-8 h-8 text-indigo-400" />}
            iconBg="bg-indigo-500/10 border-indigo-500/20"
            title="Transfer"
            subtitle="Import from SD card"
            hoverBorder="hover:border-indigo-500/40 hover:bg-indigo-500/5"
            onClick={pickTransfer}
          />
          <ModeCard
            icon={<GridIcon className="w-8 h-8 text-violet-400" />}
            iconBg="bg-violet-500/10 border-violet-500/20"
            title="Library"
            subtitle="Browse & manage photos"
            hoverBorder="hover:border-violet-500/40 hover:bg-violet-500/5"
            onClick={pickLibrary}
          />
        </div>
      </div>
    </div>
  )
}

interface ModeCardProps {
  icon: React.ReactNode
  iconBg: string
  title: string
  subtitle: string
  hoverBorder: string
  onClick: () => void
}

function ModeCard({ icon, iconBg, title, subtitle, hoverBorder, onClick }: ModeCardProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 flex flex-col items-center gap-4 p-6 rounded-2xl border cursor-pointer
        bg-zinc-900/60 border-zinc-800 transition-all duration-150 hover:scale-[1.02]
        ${hoverBorder}
      `}
    >
      <div className={`w-14 h-14 rounded-xl border flex items-center justify-center ${iconBg}`}>
        {icon}
      </div>
      <div className="text-center">
        <p className="text-zinc-100 text-lg font-semibold">{title}</p>
        <p className="text-zinc-500 text-sm mt-0.5">{subtitle}</p>
      </div>
    </button>
  )
}
