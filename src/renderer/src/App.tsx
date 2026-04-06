import { useEffect } from 'react'
import { useAppStore } from './stores/appStore'
import { SetupView } from './components/SetupView'
import { GridView } from './components/GridView'
import { TransferView } from './components/TransferView'
import { DoneView } from './components/DoneView'
import { TitleBar } from './components/TitleBar'

export default function App(): JSX.Element {
  const { view, setDrives, setSourcePath, setDestinationPath } = useAppStore()

  useEffect(() => {
    // Load drives on startup
    window.api.listDrives().then(setDrives)

    // Restore saved config
    window.api.loadConfig().then((config) => {
      if (config.sourcePath) setSourcePath(config.sourcePath)
      if (config.destinationPath) setDestinationPath(config.destinationPath)
    })

    // Listen for drive changes
    const unsub = window.api.onDrivesChanged(setDrives)
    return unsub
  }, [setDrives, setSourcePath, setDestinationPath])

  return (
    <div className="flex flex-col h-screen bg-[#0f0f11] text-zinc-200">
      <TitleBar />
      <div className="flex-1 overflow-hidden">
        {view === 'setup' && <SetupView />}
        {view === 'grid' && <GridView />}
        {view === 'transferring' && <TransferView />}
        {view === 'done' && <DoneView />}
      </div>
    </div>
  )
}
