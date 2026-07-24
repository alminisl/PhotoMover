import { create } from 'zustand'
import type { DriveInfo, PhotoMeta, LibraryPhotoMeta } from '../../../preload/index'
export type { PhotoMeta, LibraryPhotoMeta }

export type AppMode = 'transfer' | 'library'
export type AppView =
  | 'mode-select'
  | 'setup'
  | 'grid'
  | 'transferring'
  | 'done'
  | 'library-setup'
  | 'library-grid'
  | 'library-edit-folder'

export type TagState = 'none' | 'transfer' | 'delete'
export type LibraryTagState = 'none' | 'to-delete' | 'to-edit'
export type LibraryFilterTab = 'all' | 'untagged' | 'to-delete' | 'to-edit' | 'rated'

export interface PhotoWithTag extends PhotoMeta {
  tag: TagState
}

export interface PhotoWithLibraryTag extends LibraryPhotoMeta {
  libraryTag: LibraryTagState
  rating: number
}

interface AppState {
  // ── Shared ──────────────────────────────────────────────────
  mode: AppMode
  view: AppView
  setMode: (mode: AppMode) => void
  setView: (view: AppView) => void

  // ── Transfer mode ────────────────────────────────────────────
  drives: DriveInfo[]
  sourcePath: string | null
  destinationPath: string | null
  photos: PhotoWithTag[]
  scanProgress: { done: number; total: number } | null
  transferResult: { transferred: number; skipped: number; errors: string[] } | null
  selectedIds: Set<string>

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
  setSelectedIds: (ids: Set<string>) => void
  clearSelection: () => void
  setPhotoThumbnail: (id: string, thumbnailData: string) => void

  // ── Library mode ─────────────────────────────────────────────
  libraryPath: string | null
  libraryPhotos: PhotoWithLibraryTag[]
  editFolderPhotos: PhotoWithLibraryTag[]
  libraryScanProgress: { done: number; total: number } | null
  librarySelectedIds: Set<string>
  libraryFilter: LibraryFilterTab

  setLibraryPath: (path: string | null) => void
  addLibraryPhotos: (photos: LibraryPhotoMeta[]) => void
  clearLibraryPhotos: () => void
  setLibraryScanProgress: (p: { done: number; total: number } | null) => void
  setLibraryTag: (id: string, tag: LibraryTagState) => void
  setLibraryTagBulk: (ids: string[], tag: LibraryTagState) => void
  setLibraryTagAll: (tag: LibraryTagState) => void
  setRating: (id: string, rating: number) => void
  setRatingBulk: (ids: string[], rating: number) => void
  setLibrarySelectedIds: (ids: Set<string>) => void
  clearLibrarySelection: () => void
  setLibraryFilter: (tab: LibraryFilterTab) => void
  removeLibraryPhotos: (paths: string[]) => void
  addEditFolderPhotos: (photos: LibraryPhotoMeta[]) => void
  clearEditFolderPhotos: () => void
  setLibraryPhotoThumbnail: (id: string, thumbnailData: string) => void
}

function toLibraryPhoto(p: LibraryPhotoMeta): PhotoWithLibraryTag {
  return { ...p, libraryTag: p.libraryTag ?? 'none', rating: p.rating ?? 0 }
}

export const useAppStore = create<AppState>((set) => ({
  // ── Shared ──────────────────────────────────────────────────
  mode: 'transfer',
  view: 'mode-select',
  setMode: (mode) => set({ mode }),
  setView: (view) => set({ view }),

  // ── Transfer mode ────────────────────────────────────────────
  drives: [],
  sourcePath: null,
  destinationPath: null,
  photos: [],
  scanProgress: null,
  transferResult: null,
  selectedIds: new Set(),

  setDrives: (drives) => set({ drives }),
  setSourcePath: (sourcePath) => set({ sourcePath }),
  setDestinationPath: (destinationPath) => set({ destinationPath }),

  addPhotos: (newPhotos) =>
    set((state) => ({
      photos: [...state.photos, ...newPhotos.map((p) => ({ ...p, tag: 'none' as TagState }))]
    })),

  clearPhotos: () => set({ photos: [], scanProgress: null }),
  setScanProgress: (scanProgress) => set({ scanProgress }),

  setTag: (id, tag) =>
    set((state) => ({ photos: state.photos.map((p) => (p.id === id ? { ...p, tag } : p)) })),

  setTagBulk: (ids, tag) => {
    const idSet = new Set(ids)
    set((state) => ({ photos: state.photos.map((p) => (idSet.has(p.id) ? { ...p, tag } : p)) }))
  },

  setTagAll: (tag) => set((state) => ({ photos: state.photos.map((p) => ({ ...p, tag })) })),

  setTransferResult: (transferResult) => set({ transferResult }),
  setSelectedIds: (selectedIds) => set({ selectedIds }),
  clearSelection: () => set({ selectedIds: new Set() }),

  setPhotoThumbnail: (id, thumbnailData) =>
    set((state) => ({
      photos: state.photos.map((p) => (p.id === id ? { ...p, thumbnailData } : p))
    })),

  // ── Library mode ─────────────────────────────────────────────
  libraryPath: null,
  libraryPhotos: [],
  editFolderPhotos: [],
  libraryScanProgress: null,
  librarySelectedIds: new Set(),
  libraryFilter: 'all',

  setLibraryPath: (libraryPath) => set({ libraryPath }),

  addLibraryPhotos: (newPhotos) =>
    set((state) => ({ libraryPhotos: [...state.libraryPhotos, ...newPhotos.map(toLibraryPhoto)] })),

  clearLibraryPhotos: () => set({ libraryPhotos: [], libraryScanProgress: null }),

  setLibraryScanProgress: (libraryScanProgress) => set({ libraryScanProgress }),

  setLibraryTag: (id, libraryTag) =>
    set((state) => ({
      libraryPhotos: state.libraryPhotos.map((p) => (p.id === id ? { ...p, libraryTag } : p)),
      editFolderPhotos: state.editFolderPhotos.map((p) => (p.id === id ? { ...p, libraryTag } : p))
    })),

  setLibraryTagBulk: (ids, libraryTag) => {
    const idSet = new Set(ids)
    set((state) => ({
      libraryPhotos: state.libraryPhotos.map((p) => (idSet.has(p.id) ? { ...p, libraryTag } : p)),
      editFolderPhotos: state.editFolderPhotos.map((p) => (idSet.has(p.id) ? { ...p, libraryTag } : p))
    }))
  },

  setLibraryTagAll: (libraryTag) =>
    set((state) => ({
      libraryPhotos: state.libraryPhotos.map((p) => ({ ...p, libraryTag })),
      editFolderPhotos: state.editFolderPhotos.map((p) => ({ ...p, libraryTag }))
    })),

  setRating: (id, rating) =>
    set((state) => ({
      libraryPhotos: state.libraryPhotos.map((p) => (p.id === id ? { ...p, rating } : p)),
      editFolderPhotos: state.editFolderPhotos.map((p) => (p.id === id ? { ...p, rating } : p))
    })),

  setRatingBulk: (ids, rating) => {
    const idSet = new Set(ids)
    set((state) => ({
      libraryPhotos: state.libraryPhotos.map((p) => (idSet.has(p.id) ? { ...p, rating } : p)),
      editFolderPhotos: state.editFolderPhotos.map((p) => (idSet.has(p.id) ? { ...p, rating } : p))
    }))
  },

  setLibrarySelectedIds: (librarySelectedIds) => set({ librarySelectedIds }),
  clearLibrarySelection: () => set({ librarySelectedIds: new Set() }),
  setLibraryFilter: (libraryFilter) => set({ libraryFilter }),

  removeLibraryPhotos: (paths) => {
    const pathSet = new Set(paths)
    set((state) => ({
      libraryPhotos: state.libraryPhotos.filter((p) => !pathSet.has(p.path)),
      editFolderPhotos: state.editFolderPhotos.filter((p) => !pathSet.has(p.path))
    }))
  },

  addEditFolderPhotos: (newPhotos) =>
    set((state) => ({ editFolderPhotos: [...state.editFolderPhotos, ...newPhotos.map(toLibraryPhoto)] })),

  clearEditFolderPhotos: () => set({ editFolderPhotos: [] }),

  setLibraryPhotoThumbnail: (id, thumbnailData) =>
    set((state) => ({
      libraryPhotos: state.libraryPhotos.map((p) => (p.id === id ? { ...p, thumbnailData } : p)),
      editFolderPhotos: state.editFolderPhotos.map((p) => (p.id === id ? { ...p, thumbnailData } : p))
    }))
}))
