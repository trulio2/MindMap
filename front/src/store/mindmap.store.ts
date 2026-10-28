import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import {
  DOC_VERSION,
  type MapEdge,
  type MapNode,
  type MapNodeData,
  type MindMapDoc,
  type XY
} from '@/types'
import { debouncedLocalStorage } from './storage'

const STORAGE_KEY = 'mindmap'

type NodePatch = Partial<Pick<MapNode, 'position' | 'measured'>>

type EdgeEnds = Pick<
  MapEdge,
  'source' | 'target' | 'sourceHandle' | 'targetHandle'
>

type MindMapState = MindMapDoc & {
  addNode: (areaId: string, position: XY, data?: Partial<MapNodeData>) => string
  updateNodeData: (id: string, data: Partial<MapNodeData>) => void
  patchNodes: (patches: Record<string, NodePatch>) => void
  /** Removes the nodes, everything inside their areas and every touching edge. */
  deleteNodes: (ids: string[]) => void
  addEdge: (areaId: string, ends: EdgeEnds) => string | null
  deleteEdges: (ids: string[]) => void
}

function collectWithDescendants(
  nodes: Record<string, MapNode>,
  ids: string[]
): Set<string> {
  const removed = new Set(ids)
  let grew = true
  while (grew) {
    grew = false
    for (const node of Object.values(nodes)) {
      if (!removed.has(node.id) && removed.has(node.areaId)) {
        removed.add(node.id)
        grew = true
      }
    }
  }
  return removed
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Keeps only the saved document; anything malformed falls back to an empty map. */
function readDoc(value: unknown): MindMapDoc {
  if (!isRecord(value) || !isRecord(value.nodes) || !isRecord(value.edges)) {
    return { nodes: {}, edges: {} }
  }
  return {
    nodes: value.nodes as MindMapDoc['nodes'],
    edges: value.edges as MindMapDoc['edges']
  }
}

export const useMindMap = create<MindMapState>()(
  persist(
    (set, get) => ({
      nodes: {},
      edges: {},

      addNode: (areaId, position, data) => {
        const id = nanoid()
        const node: MapNode = {
          id,
          areaId,
          kind: 'topic',
          position,
          data: { label: 'New topic', ...data }
        }
        set((s) => ({ nodes: { ...s.nodes, [id]: node } }))
        return id
      },

      updateNodeData: (id, data) =>
        set((s) => {
          const node = s.nodes[id]
          if (!node) return s
          return {
            nodes: {
              ...s.nodes,
              [id]: { ...node, data: { ...node.data, ...data } }
            }
          }
        }),

      patchNodes: (patches) =>
        set((s) => {
          const nodes = { ...s.nodes }
          for (const [id, patch] of Object.entries(patches)) {
            if (nodes[id]) nodes[id] = { ...nodes[id], ...patch }
          }
          return { nodes }
        }),

      deleteNodes: (ids) =>
        set((s) => {
          const removed = collectWithDescendants(s.nodes, ids)
          const nodes = Object.fromEntries(
            Object.entries(s.nodes).filter(([id]) => !removed.has(id))
          )
          const edges = Object.fromEntries(
            Object.entries(s.edges).filter(
              ([, e]) =>
                !removed.has(e.source) &&
                !removed.has(e.target) &&
                !removed.has(e.areaId)
            )
          )
          return { nodes, edges }
        }),

      addEdge: (areaId, ends) => {
        const { source, target } = ends
        if (source === target) return null
        const duplicate = Object.values(get().edges).some(
          (e) =>
            (e.source === source && e.target === target) ||
            (e.source === target && e.target === source)
        )
        if (duplicate) return null

        const id = nanoid()
        set((s) => ({ edges: { ...s.edges, [id]: { id, areaId, ...ends } } }))
        return id
      },

      deleteEdges: (ids) =>
        set((s) => {
          const edges = { ...s.edges }
          for (const id of ids) delete edges[id]
          return { edges }
        })
    }),
    {
      name: STORAGE_KEY,
      version: DOC_VERSION,
      storage: createJSONStorage(() => debouncedLocalStorage),
      partialize: (s): MindMapDoc => ({ nodes: s.nodes, edges: s.edges }),
      // Add a step here for each DOC_VERSION bump.
      migrate: (persisted) => readDoc(persisted),
      merge: (persisted, current) => ({ ...current, ...readDoc(persisted) })
    }
  )
)

// Pick up changes saved by the app in another tab.
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) void useMindMap.persist.rehydrate()
})
