import { app } from 'electron'
import { join } from 'path'
import { readJson, writeJson, pathExists, move } from 'fs-extra'
import { rename } from 'fs/promises'

export type LibraryTagState = 'none' | 'to-delete' | 'to-edit'

export interface PhotoMetadataEntry {
  rating: number
  libraryTag: LibraryTagState
  absolutePath: string
  lastSeenMtime: number
}

interface MetadataStore {
  version: 1
  entries: Record<string, PhotoMetadataEntry>
}

const META_PATH = join(app.getPath('userData'), 'library-metadata.json')
const TMP_PATH = META_PATH + '.tmp'

class LibraryMetadataService {
  private cache = new Map<string, PhotoMetadataEntry>()
  private dirty = false
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  async load(): Promise<void> {
    try {
      if (!(await pathExists(META_PATH))) return
      const data = (await readJson(META_PATH)) as MetadataStore
      if (data.version !== 1 || typeof data.entries !== 'object') {
        await this.handleCorruption()
        return
      }
      for (const [key, entry] of Object.entries(data.entries)) {
        this.cache.set(key, entry)
      }
    } catch {
      await this.handleCorruption()
    }
  }

  private async handleCorruption(): Promise<void> {
    this.cache.clear()
    try {
      if (await pathExists(META_PATH)) {
        const corrupt = META_PATH.replace('.json', `.corrupt-${Date.now()}.json`)
        await rename(META_PATH, corrupt)
      }
    } catch { /* ignore */ }
  }

  private key(absolutePath: string): string {
    return absolutePath.replace(/\\/g, '/')
  }

  get(absolutePath: string): PhotoMetadataEntry | undefined {
    return this.cache.get(this.key(absolutePath))
  }

  upsert(absolutePath: string, patch: Partial<Omit<PhotoMetadataEntry, 'absolutePath'>>): void {
    const k = this.key(absolutePath)
    const existing = this.cache.get(k) ?? {
      rating: 0,
      libraryTag: 'none' as LibraryTagState,
      absolutePath,
      lastSeenMtime: 0
    }
    this.cache.set(k, { ...existing, ...patch, absolutePath })
    this.scheduleFlush()
  }

  upsertMany(updates: Array<{ absolutePath: string; rating?: number; libraryTag?: LibraryTagState }>): void {
    for (const { absolutePath, rating, libraryTag } of updates) {
      const k = this.key(absolutePath)
      const existing = this.cache.get(k) ?? {
        rating: 0,
        libraryTag: 'none' as LibraryTagState,
        absolutePath,
        lastSeenMtime: 0
      }
      this.cache.set(k, {
        ...existing,
        ...(rating !== undefined ? { rating } : {}),
        ...(libraryTag !== undefined ? { libraryTag } : {}),
        absolutePath
      })
    }
    this.scheduleFlush()
  }

  rekey(oldPath: string, newPath: string): void {
    const oldKey = this.key(oldPath)
    const newKey = this.key(newPath)
    const entry = this.cache.get(oldKey)
    if (entry) {
      this.cache.delete(oldKey)
      this.cache.set(newKey, { ...entry, absolutePath: newPath })
      this.scheduleFlush()
    }
  }

  delete(absolutePath: string): void {
    this.cache.delete(this.key(absolutePath))
    this.scheduleFlush()
  }

  deleteMany(paths: string[]): void {
    for (const p of paths) this.cache.delete(this.key(p))
    this.scheduleFlush()
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    if (!this.dirty) return
    this.dirty = false
    const store: MetadataStore = {
      version: 1,
      entries: Object.fromEntries(this.cache)
    }
    await writeJson(TMP_PATH, store, { spaces: 2 })
    await move(TMP_PATH, META_PATH, { overwrite: true })
  }

  private scheduleFlush(): void {
    this.dirty = true
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => this.flush(), 500)
  }
}

export const libraryMetadata = new LibraryMetadataService()
