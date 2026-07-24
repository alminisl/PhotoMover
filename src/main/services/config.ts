import { app } from 'electron'
import { join } from 'path'
import { readJson, writeJson, pathExists } from 'fs-extra'

const CONFIG_PATH = join(app.getPath('userData'), 'config.json')

export type AppMode = 'transfer' | 'library'

export interface AppConfig {
  sourcePath: string | null
  destinationPath: string | null
  deleteOriginal: boolean
  organizeByDay: boolean
  separateRaw: boolean
  libraryPath: string
  lastMode: AppMode
}

const defaults: AppConfig = {
  sourcePath: null,
  destinationPath: null,
  deleteOriginal: true,
  organizeByDay: false,
  separateRaw: false,
  libraryPath: '',
  lastMode: 'transfer'
}

export async function loadConfig(): Promise<AppConfig> {
  if (!(await pathExists(CONFIG_PATH))) return { ...defaults }
  try {
    const data = await readJson(CONFIG_PATH)
    return { ...defaults, ...data }
  } catch {
    return { ...defaults }
  }
}

export async function saveConfig(config: Partial<AppConfig>): Promise<void> {
  const existing = await loadConfig()
  await writeJson(CONFIG_PATH, { ...existing, ...config }, { spaces: 2 })
}
