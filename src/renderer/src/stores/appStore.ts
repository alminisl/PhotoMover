import { create } from 'zustand'
import type { DriveInfo, PhotoMeta } from '../../../preload/index'
// Re-export for consumers
export type { PhotoMeta }

export type AppView = 'setup' | 'grid' | 'transferring' | 'done'
export type TagState = 'none' | 'transfer' | 'delete'

export interface PhotoWithTag extends PhotoMeta {
  tag: TagState
}

interface AppState {
  view: AppView
  drives: DriveInfo[]
  sourcePath: string | null
  destinationPath: string | null
  photos: PhotoWithTag[]
  scanProgress: { done: number; total: number } | null
  transferResult: { transferred: number; skipped: number; errors: string[] } | null

  setView: (view: AppView) => void
  setDrives: (drives: DriveInfo[]) => void
  setSourcePath: (path: string | null) => void
  setDestinationPath: (path: string | null) => void
  addPhotos: (photos: PhotoMeta[]) => void
  clearPhotos: () => void
  setScanProgress: (p: { done: number; total: number } | null) => void
  setTag: (id: string, tag: TagState) => void
  setTagBulk: (ids: string[], tag: TagState) => void
  setTagAll: (tag: TagState) => void
  setTransferResult: (r: { transferred: number; skipped: number; errors: string[] } | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  view: 'setup',
  drives: [],
  sourcePath: null,
  destinationPath: null,
  photos: [],
  scanProgress: null,
  transferResult: null,

  setView: (view) => set({ view }),
  setDrives: (drives) => set({ drives }),
  setSourcePath: (sourcePath) => set({ sourcePath }),
  setDestinationPath: (destinationPath) => set({ destinationPath }),

  addPhotos: (newPhotos) =>
    set((state) => ({
      photos: [
        ...state.photos,
        ...newPhotos.map((p) => ({ ...p, tag: 'none' as TagState }))
      ]
    })),

  clearPhotos: () => set({ photos: [], scanProgress: null }),

  setScanProgress: (scanProgress) => set({ scanProgress }),

  setTag: (id, tag) =>
    set((state) => ({
      photos: state.photos.map((p) => (p.id === id ? { ...p, tag } : p))
    })),

  setTagBulk: (ids, tag) => {
    const idSet = new Set(ids)
    set((state) => ({
      photos: state.photos.map((p) => (idSet.has(p.id) ? { ...p, tag } : p))
    }))
  },

  setTagAll: (tag) =>
    set((state) => ({
      photos: state.photos.map((p) => ({ ...p, tag }))
    })),

  setTransferResult: (transferResult) => set({ transferResult })
}))
