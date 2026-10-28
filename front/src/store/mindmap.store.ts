import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import {
  DOC_VERSION,
  type AreaViewport,
  type MapEdge,
  type MapNode,
  type MapNodeData,
  type MindMapDoc,
  type NodeKind,
  type XY
} from '@/types'
import { emptyDoc, parseDoc } from '@/lib/io'
import { debouncedLocalStorage } from './storage'

const STORAGE_KEY = 'mindmap'

type NodePatch = Partial<Pick<MapNode, 'position' | 'measured' | 'size'>>

type EdgeEnds = Pick<
  MapEdge,
  'source' | 'target' | 'sourceHandle' | 'targetHandle'
>

type NewNode = {
  kind: NodeKind
  position: XY
  data?: MapNodeData
  size?: MapNode['size']
}

const defaultSize: Partial<Record<NodeKind, MapNode['size']>> = {
  text: { width: 220 }
}

const defaultData: Record<NodeKind, MapNodeData> = {
  topic: { label: 'New topic' },
  text: { text: '' },
  image: {},
  link: { label: '', url: '' }
}

type MindMapState = MindMapDoc & {
  addNode: (areaId: string, node: NewNode) => string
  updateNodeData: (id: string, data: Partial<MapNodeData>) => void
  patchNodes: (patches: Record<string, NodePatch>) => void
  /** Removes the nodes, everything inside their areas and every touching edge. */
  deleteNodes: (ids: string[]) => void
  addEdge: (areaId: string, ends: EdgeEnds) => string | null
  setEdgeLabel: (id: string, label: string) => void
  deleteEdges: (ids: string[]) => void
  saveViewport: (areaId: string, viewport: AreaViewport) => void
  /** Swaps in a whole map, e.g. from an import or "New map". */
  replaceDoc: (doc: MindMapDoc) => void
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

/**
 * Saved state gets the same checks as an imported file; anything that isn't
 * a map at all falls back to an empty one.
 */
function readDoc(value: unknown): MindMapDoc {
  try {
    return parseDoc(value).doc
  } catch {
    return emptyDoc()
  }
}

function without<T>(record: Record<string, T>, removed: Set<string>) {
  return Object.fromEntries(
    Object.entries(record).filter(([id]) => !removed.has(id))
  )
}

export const useMindMap = create<MindMapState>()(
  persist(
    (set, get) => ({
      nodes: {},
      edges: {},
      viewports: {},

      addNode: (areaId, { kind, position, data, size }) => {
        const id = nanoid()
        const node: MapNode = {
          id,
          areaId,
          kind,
          position,
          data: { ...defaultData[kind], ...data }
        }
        const nodeSize = size ?? defaultSize[kind]
        if (nodeSize) node.size = nodeSize
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
          const edges = Object.fromEntries(
            Object.entries(s.edges).filter(
              ([, e]) =>
                !removed.has(e.source) &&
                !removed.has(e.target) &&
                !removed.has(e.areaId)
            )
          )
          return {
            nodes: without(s.nodes, removed),
            edges,
            viewports: without(s.viewports, removed)
          }
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

      setEdgeLabel: (id, label) =>
        set((s) => {
          const edge = s.edges[id]
          if (!edge) return s
          const next: MapEdge = { ...edge, label }
          if (!label) delete next.label
          return { edges: { ...s.edges, [id]: next } }
        }),

      deleteEdges: (ids) =>
        set((s) => {
          const edges = { ...s.edges }
          for (const id of ids) delete edges[id]
          return { edges }
        }),

      saveViewport: (areaId, viewport) =>
        set((s) => ({ viewports: { ...s.viewports, [areaId]: viewport } })),

      replaceDoc: ({ nodes, edges, viewports }) =>
        set({ nodes, edges, viewports })
    }),
    {
      name: STORAGE_KEY,
      version: DOC_VERSION,
      storage: createJSONStorage(() => debouncedLocalStorage),
      partialize: (s): MindMapDoc => ({
        nodes: s.nodes,
        edges: s.edges,
        viewports: s.viewports
      }),
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
