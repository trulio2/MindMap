import { create } from 'zustand'
import type { Clip } from '@/types'

type Selection = Record<string, true>

export type StorageError = 'full' | 'unavailable'

type UiState = {
  selectedNodes: Selection
  selectedEdges: Selection
  editingId: string | null
  storageError: StorageError | null
  notice: Notice | null
  docRevision: number
  clipboard: Clip | null
  openMapId: string | null
  libraryOpen: boolean
  selectNodes: (changes: Record<string, boolean>) => void
  selectEdges: (changes: Record<string, boolean>) => void
  setEditing: (id: string | null) => void
  resetInteraction: () => void
  setStorageError: (error: StorageError | null) => void
  setNotice: (notice: Notice | null) => void
  docReplaced: () => void
  setClipboard: (clip: Clip | null) => void
  setOpenMap: (id: string | null) => void
  setLibraryOpen: (open: boolean) => void
}

export type Notice = { kind: 'info' | 'error'; text: string }

function applySelection(current: Selection, changes: Record<string, boolean>) {
  const next = { ...current }
  for (const [id, selected] of Object.entries(changes)) {
    if (selected) next[id] = true
    else delete next[id]
  }
  return next
}

export const useUi = create<UiState>()((set) => ({
  selectedNodes: {},
  selectedEdges: {},
  editingId: null,
  storageError: null,
  notice: null,
  docRevision: 0,
  clipboard: null,
  openMapId: null,
  libraryOpen: false,

  selectNodes: (changes) =>
    set((s) => ({ selectedNodes: applySelection(s.selectedNodes, changes) })),
  selectEdges: (changes) =>
    set((s) => ({ selectedEdges: applySelection(s.selectedEdges, changes) })),
  setEditing: (id) => set({ editingId: id }),
  resetInteraction: () =>
    set({ selectedNodes: {}, selectedEdges: {}, editingId: null }),
  setStorageError: (error) =>
    set((s) => (s.storageError === error ? s : { storageError: error })),
  setNotice: (notice) => set({ notice }),
  setClipboard: (clipboard) => set({ clipboard }),
  setOpenMap: (openMapId) => set({ openMapId }),
  setLibraryOpen: (libraryOpen) => set({ libraryOpen }),
  docReplaced: () =>
    set((s) => ({
      docRevision: s.docRevision + 1,
      selectedNodes: {},
      selectedEdges: {},
      editingId: null
    }))
}))
