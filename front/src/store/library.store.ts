import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import { cleanName, isRecord } from '@/lib/io'
import type { Folder, Library, MapMeta } from '@/types'
import { persistStorage } from './storage'

export const LIBRARY_KEY = 'library'
export const mapKey = (id: string) => `map:${id}`

type LibraryState = Library & {
  addMap: (name: string, folderId: string | null) => string
  renameMap: (id: string, name: string) => void
  moveMap: (id: string, folderId: string | null) => void
  removeMaps: (ids: string[]) => void
  addFolder: (name: string, parentId: string | null) => string
  renameFolder: (id: string, name: string) => void
  moveFolder: (id: string, parentId: string | null) => boolean
  removeFolders: (ids: string[]) => void
  setLastOpened: (id: string) => void
}

export function folderTree(
  folders: Record<string, Folder>,
  id: string
): Set<string> {
  const tree = new Set([id])
  for (let grew = true; grew; ) {
    grew = false
    for (const f of Object.values(folders)) {
      if (f.parentId && tree.has(f.parentId) && !tree.has(f.id)) {
        tree.add(f.id)
        grew = true
      }
    }
  }
  return tree
}

export function folderPath(
  folders: Record<string, Folder>,
  id: string | null
): Folder[] {
  const path: Folder[] = []
  const seen = new Set<string>()
  for (let f = id ? folders[id] : undefined; f && !seen.has(f.id); ) {
    seen.add(f.id)
    path.unshift(f)
    f = f.parentId ? folders[f.parentId] : undefined
  }
  return path
}

function readLibrary(value: unknown): Library {
  const library: Library = { folders: {}, maps: {}, lastOpenedId: null }
  if (!isRecord(value)) return library
  if (isRecord(value.folders)) {
    for (const [id, f] of Object.entries(value.folders)) {
      if (!isRecord(f)) continue
      library.folders[id] = {
        id,
        name: cleanName(f.name, 'Untitled folder'),
        parentId: typeof f.parentId === 'string' ? f.parentId : null
      }
    }
  }
  if (isRecord(value.maps)) {
    for (const [id, m] of Object.entries(value.maps)) {
      if (!isRecord(m)) continue
      library.maps[id] = {
        id,
        name: cleanName(m.name, 'Untitled map'),
        folderId: typeof m.folderId === 'string' ? m.folderId : null,
        createdAt: typeof m.createdAt === 'number' ? m.createdAt : 0
      }
    }
  }
  for (const f of Object.values(library.folders)) {
    if (f.parentId && !library.folders[f.parentId]) f.parentId = null
  }
  for (const m of Object.values(library.maps)) {
    if (m.folderId && !library.folders[m.folderId]) m.folderId = null
  }
  if (typeof value.lastOpenedId === 'string') {
    library.lastOpenedId = value.lastOpenedId
  }
  return library
}

function without<T>(record: Record<string, T>, ids: string[]) {
  const next = { ...record }
  for (const id of ids) delete next[id]
  return next
}

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      folders: {},
      maps: {},
      lastOpenedId: null,

      addMap: (name, folderId) => {
        const id = nanoid()
        const meta: MapMeta = {
          id,
          name: cleanName(name, 'Untitled map'),
          folderId,
          createdAt: Date.now()
        }
        set((s) => ({ maps: { ...s.maps, [id]: meta } }))
        return id
      },

      renameMap: (id, name) =>
        set((s) =>
          s.maps[id]
            ? {
                maps: {
                  ...s.maps,
                  [id]: {
                    ...s.maps[id],
                    name: cleanName(name, s.maps[id].name)
                  }
                }
              }
            : s
        ),

      moveMap: (id, folderId) =>
        set((s) =>
          s.maps[id]
            ? { maps: { ...s.maps, [id]: { ...s.maps[id], folderId } } }
            : s
        ),

      removeMaps: (ids) => set((s) => ({ maps: without(s.maps, ids) })),

      addFolder: (name, parentId) => {
        const id = nanoid()
        const folder: Folder = {
          id,
          name: cleanName(name, 'Untitled folder'),
          parentId
        }
        set((s) => ({ folders: { ...s.folders, [id]: folder } }))
        return id
      },

      renameFolder: (id, name) =>
        set((s) =>
          s.folders[id]
            ? {
                folders: {
                  ...s.folders,
                  [id]: {
                    ...s.folders[id],
                    name: cleanName(name, s.folders[id].name)
                  }
                }
              }
            : s
        ),

      moveFolder: (id, parentId) => {
        const { folders } = get()
        if (!folders[id]) return false
        if (parentId && folderTree(folders, id).has(parentId)) return false
        set({ folders: { ...folders, [id]: { ...folders[id], parentId } } })
        return true
      },

      removeFolders: (ids) =>
        set((s) => ({ folders: without(s.folders, ids) })),

      setLastOpened: (id) =>
        set((s) => (s.lastOpenedId === id ? s : { lastOpenedId: id }))
    }),
    {
      name: LIBRARY_KEY,
      version: 1,
      storage: persistStorage<Library>(),
      skipHydration: true,
      partialize: (s): Library => ({
        folders: s.folders,
        maps: s.maps,
        lastOpenedId: s.lastOpenedId
      }),
      merge: (persisted, current) => ({ ...current, ...readLibrary(persisted) })
    }
  )
)
