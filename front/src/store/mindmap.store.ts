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
const HISTORY_LIMIT = 100
const DUPLICATE_OFFSET = 24

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

/** What undo restores. Pan and zoom are not part of it. */
type Snapshot = Pick<MindMapDoc, 'nodes' | 'edges'>

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
  /** Undo and redo stacks; kept in memory only, never saved. */
  past: Snapshot[]
  future: Snapshot[]

  addNode: (areaId: string, node: NewNode) => string
  updateNodeData: (id: string, data: Partial<MapNodeData>) => void
  /** Moves and resizes; call `checkpoint` when such a gesture starts. */
  patchNodes: (patches: Record<string, NodePatch>) => void
  /** Removes the nodes, everything inside their areas and every touching edge. */
  deleteNodes: (ids: string[]) => void
  /** Copies the nodes with everything inside them; returns the new ids. */
  duplicateNodes: (ids: string[]) => string[]
  addEdge: (areaId: string, ends: EdgeEnds) => string | null
  setEdgeLabel: (id: string, label: string) => void
  deleteEdges: (ids: string[]) => void
  saveViewport: (areaId: string, viewport: AreaViewport) => void
  /** Swaps in a whole map, e.g. from an import or "New map". Undoable. */
  replaceDoc: (doc: MindMapDoc) => void
  /** Records the current map as an undo step before a drag or resize. */
  checkpoint: () => void
  /** Runs several changes as a single undo step. */
  group: <T>(changes: () => T) => T
  undo: () => void
  redo: () => void
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
    (set, get) => {
      // State is immutable, so a snapshot is just the current references.
      // A click that starts a drag but moves nothing would push the same
      // references twice; skip those so every undo step changes something.
      let grouping = false
      const checkpoint = () => {
        if (grouping) return
        set((s) => {
          const last = s.past.at(-1)
          if (last?.nodes === s.nodes && last.edges === s.edges) return s
          return {
            past: [
              ...s.past.slice(1 - HISTORY_LIMIT),
              { nodes: s.nodes, edges: s.edges }
            ],
            future: []
          }
        })
      }

      return {
        nodes: {},
        edges: {},
        viewports: {},
        past: [],
        future: [],

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
          checkpoint()
          set((s) => ({ nodes: { ...s.nodes, [id]: node } }))
          return id
        },

        updateNodeData: (id, data) => {
          const current = get().nodes[id]?.data
          // Saving an edit without changes shouldn't leave an empty undo step.
          const changed =
            current &&
            Object.entries(data).some(
              ([key, value]) => current[key as keyof MapNodeData] !== value
            )
          if (!changed) return
          checkpoint()
          set((s) => {
            const node = s.nodes[id]
            return {
              nodes: {
                ...s.nodes,
                [id]: { ...node, data: { ...node.data, ...data } }
              }
            }
          })
        },

        patchNodes: (patches) =>
          set((s) => {
            const nodes = { ...s.nodes }
            for (const [id, patch] of Object.entries(patches)) {
              if (nodes[id]) nodes[id] = { ...nodes[id], ...patch }
            }
            return { nodes }
          }),

        deleteNodes: (ids) => {
          checkpoint()
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
          })
        },

        duplicateNodes: (ids) => {
          const { nodes, edges } = get()
          const copied = collectWithDescendants(
            nodes,
            ids.filter((id) => nodes[id])
          )
          if (!copied.size) return []
          const newId = new Map([...copied].map((id) => [id, nanoid()]))
          const remap = (id: string) => newId.get(id) ?? id

          const newNodes: Record<string, MapNode> = {}
          for (const id of copied) {
            const node = nodes[id]
            // Only the selected nodes move; their contents keep their layout.
            const isTop = !copied.has(node.areaId)
            newNodes[remap(id)] = {
              ...node,
              id: remap(id),
              areaId: remap(node.areaId),
              position: isTop
                ? {
                    x: node.position.x + DUPLICATE_OFFSET,
                    y: node.position.y + DUPLICATE_OFFSET
                  }
                : node.position
            }
          }

          const newEdges: Record<string, MapEdge> = {}
          for (const edge of Object.values(edges)) {
            if (!copied.has(edge.source) || !copied.has(edge.target)) continue
            const id = nanoid()
            newEdges[id] = {
              ...edge,
              id,
              areaId: remap(edge.areaId),
              source: remap(edge.source),
              target: remap(edge.target)
            }
          }

          checkpoint()
          set((s) => ({
            nodes: { ...s.nodes, ...newNodes },
            edges: { ...s.edges, ...newEdges }
          }))
          return ids.filter((id) => nodes[id]).map(remap)
        },

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
          checkpoint()
          set((s) => ({
            edges: { ...s.edges, [id]: { id, areaId, ...ends } }
          }))
          return id
        },

        setEdgeLabel: (id, label) => {
          const edge = get().edges[id]
          if (!edge || (edge.label ?? '') === label) return
          checkpoint()
          const next: MapEdge = { ...edge, label }
          if (!label) delete next.label
          set((s) => ({ edges: { ...s.edges, [id]: next } }))
        },

        deleteEdges: (ids) => {
          checkpoint()
          set((s) => {
            const edges = { ...s.edges }
            for (const id of ids) delete edges[id]
            return { edges }
          })
        },

        saveViewport: (areaId, viewport) =>
          set((s) => ({ viewports: { ...s.viewports, [areaId]: viewport } })),

        replaceDoc: ({ nodes, edges, viewports }) => {
          checkpoint()
          set({ nodes, edges, viewports })
        },

        checkpoint,

        group: (changes) => {
          checkpoint()
          grouping = true
          try {
            return changes()
          } finally {
            grouping = false
          }
        },

        undo: () =>
          set((s) => {
            const previous = s.past.at(-1)
            if (!previous) return s
            return {
              ...previous,
              past: s.past.slice(0, -1),
              future: [{ nodes: s.nodes, edges: s.edges }, ...s.future]
            }
          }),

        redo: () =>
          set((s) => {
            const next = s.future[0]
            if (!next) return s
            return {
              ...next,
              past: [...s.past, { nodes: s.nodes, edges: s.edges }],
              future: s.future.slice(1)
            }
          })
      }
    },
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
      // Loading (or syncing from another tab) starts a fresh history, since
      // old steps would undo changes made elsewhere.
      merge: (persisted, current) => ({
        ...current,
        ...readDoc(persisted),
        past: [],
        future: []
      })
    }
  )
)

// Pick up changes saved by the app in another tab.
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY) void useMindMap.persist.rehydrate()
})
