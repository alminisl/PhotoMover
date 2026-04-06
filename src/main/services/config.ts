import { app } from 'electron'
import { join } from 'path'
import { readJson, writeJson, pathExists } from 'fs-extra'

const CONFIG_PATH = join(app.getPath('userData'), 'config.json')

export interface AppConfig {
  sourcePath: string | null
  destinationPath: string | null
}

const defaults: AppConfig = {
  sourcePath: null,
  destinationPath: null
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
