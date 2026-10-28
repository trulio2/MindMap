import { create } from 'zustand'

type Selection = Record<string, true>

type UiState = {
  selectedNodes: Selection
  selectedEdges: Selection
  /** Node whose label is being edited inline. */
  editingNodeId: string | null
  selectNodes: (changes: Record<string, boolean>) => void
  selectEdges: (changes: Record<string, boolean>) => void
  setEditing: (id: string | null) => void
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
  editingNodeId: null,

  selectNodes: (changes) =>
    set((s) => ({ selectedNodes: applySelection(s.selectedNodes, changes) })),
  selectEdges: (changes) =>
    set((s) => ({ selectedEdges: applySelection(s.selectedEdges, changes) })),
  setEditing: (id) => set({ editingNodeId: id })
}))
