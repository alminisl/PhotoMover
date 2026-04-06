import { useAppStore } from '../stores/appStore'

export function TitleBar(): JSX.Element {
  const view = useAppStore((s) => s.view)

  const labels: Record<string, string> = {
    setup: 'Select Source & Destination',
    grid: 'Review Photos',
    transferring: 'Transferring...',
    done: 'Transfer Complete'
  }

  return (
    <div className="drag-region h-9 flex items-center px-4 bg-[#0f0f11] border-b border-zinc-800/60 flex-shrink-0">
      <div className="flex items-center gap-2 no-drag">
        <span className="text-[13px] font-semibold text-zinc-100 tracking-tight">Photo Transfer</span>
        <span className="text-zinc-600 text-[11px]">/</span>
        <span className="text-zinc-400 text-[12px]">{labels[view]}</span>
      </div>
    </div>
  )
}
