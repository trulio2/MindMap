import { create } from 'zustand'

type Selection = Record<string, true>

export type StorageError = 'full' | 'unavailable'

type UiState = {
  selectedNodes: Selection
  selectedEdges: Selection
  /** Node or edge being edited inline. */
  editingId: string | null
  storageError: StorageError | null
  selectNodes: (changes: Record<string, boolean>) => void
  selectEdges: (changes: Record<string, boolean>) => void
  setEditing: (id: string | null) => void
  setStorageError: (error: StorageError | null) => void
}

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

  selectNodes: (changes) =>
    set((s) => ({ selectedNodes: applySelection(s.selectedNodes, changes) })),
  selectEdges: (changes) =>
    set((s) => ({ selectedEdges: applySelection(s.selectedEdges, changes) })),
  setEditing: (id) => set({ editingId: id }),
  // Returning the same state skips a re-render on every successful save.
  setStorageError: (error) =>
    set((s) => (s.storageError === error ? s : { storageError: error }))
}))
