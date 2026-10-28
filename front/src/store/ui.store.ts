import { create } from 'zustand'

type Selection = Record<string, true>

export type StorageError = 'full' | 'unavailable'

type UiState = {
  selectedNodes: Selection
  selectedEdges: Selection
  /** Node or edge being edited inline. */
  editingId: string | null
  storageError: StorageError | null
  /** Short message about the last import or export. */
  notice: Notice | null
  /** Bumped when the whole map is replaced, so the canvas starts fresh. */
  docRevision: number
  selectNodes: (changes: Record<string, boolean>) => void
  selectEdges: (changes: Record<string, boolean>) => void
  setEditing: (id: string | null) => void
  /** Drops selection and editing, e.g. when moving to another area. */
  resetInteraction: () => void
  setStorageError: (error: StorageError | null) => void
  setNotice: (notice: Notice | null) => void
  docReplaced: () => void
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

  selectNodes: (changes) =>
    set((s) => ({ selectedNodes: applySelection(s.selectedNodes, changes) })),
  selectEdges: (changes) =>
    set((s) => ({ selectedEdges: applySelection(s.selectedEdges, changes) })),
  setEditing: (id) => set({ editingId: id }),
  resetInteraction: () =>
    set({ selectedNodes: {}, selectedEdges: {}, editingId: null }),
  // Returning the same state skips a re-render on every successful save.
  setStorageError: (error) =>
    set((s) => (s.storageError === error ? s : { storageError: error })),
  setNotice: (notice) => set({ notice }),
  docReplaced: () =>
    set((s) => ({
      docRevision: s.docRevision + 1,
      selectedNodes: {},
      selectedEdges: {},
      editingId: null
    }))
}))
