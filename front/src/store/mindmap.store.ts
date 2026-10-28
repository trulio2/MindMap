import { useSyncExternalStore } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import {
  DOC_VERSION,
  ROOT_AREA,
  type AreaViewport,
  type Clip,
  type MapEdge,
  type MapNode,
  type MapNodeData,
  type MindMapDoc,
  type NodeKind,
  type XY
} from '@/types'
import { emptyDoc, parseDoc } from '@/lib/io'
import { mapStorage, onSavedElsewhere } from './storage'
import { useUi } from './ui.store'

const STORAGE_KEY = 'mindmap'
const HISTORY_LIMIT = 100
const PASTE_OFFSET = 24

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

type Snapshot = Pick<MindMapDoc, 'nodes' | 'edges'>

const defaultSize: Partial<Record<NodeKind, MapNode['size']>> = {
  text: { width: 220 },
  video: { width: 360 },
  sticky: { width: 200, height: 200 }
}

const defaultData: Record<NodeKind, MapNodeData> = {
  topic: { label: 'New topic' },
  text: { text: '' },
  image: {},
  link: { label: '', url: '' },
  video: { label: '', url: '', text: '' },
  sticky: { text: '', color: 'yellow' }
}

type MindMapState = MindMapDoc & {
  past: Snapshot[]
  future: Snapshot[]

  addNode: (areaId: string, node: NewNode) => string
  updateNodeData: (id: string, data: Partial<MapNodeData>) => void
  patchNodes: (patches: Record<string, NodePatch>) => void
  deleteNodes: (ids: string[]) => void
  copyNodes: (ids: string[]) => Clip | null
  pasteClip: (areaId: string, clip: Clip, at?: XY) => string[]
  discardNode: (id: string) => void
  duplicateNodes: (ids: string[]) => string[]
  addEdge: (areaId: string, ends: EdgeEnds) => string | null
  setEdgeLabel: (id: string, label: string) => void
  deleteEdges: (ids: string[]) => void
  saveViewport: (areaId: string, viewport: AreaViewport) => void
  replaceDoc: (doc: MindMapDoc) => void
  checkpoint: () => void
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

        copyNodes: (ids) => {
          const { nodes, edges } = get()
          const copied = collectWithDescendants(
            nodes,
            ids.filter((id) => nodes[id])
          )
          if (!copied.size) return null

          const toClip = (areaId: string) =>
            copied.has(areaId) ? areaId : ROOT_AREA
          const clip: Clip = { nodes: {}, edges: {} }
          for (const id of copied) {
            clip.nodes[id] = { ...nodes[id], areaId: toClip(nodes[id].areaId) }
          }
          for (const edge of Object.values(edges)) {
            if (copied.has(edge.source) && copied.has(edge.target)) {
              clip.edges[edge.id] = { ...edge, areaId: toClip(edge.areaId) }
            }
          }
          return clip
        },

        pasteClip: (areaId, clip, at) => {
          const newId = new Map(
            Object.keys(clip.nodes).map((id) => [id, nanoid()])
          )
          const remap = (id: string) =>
            id === ROOT_AREA ? areaId : (newId.get(id) ?? id)
          const top = Object.values(clip.nodes).filter(
            (n) => n.areaId === ROOT_AREA
          )
          if (!top.length) return []

          const minX = Math.min(...top.map((n) => n.position.x))
          const minY = Math.min(...top.map((n) => n.position.y))
          const dx = at ? at.x - minX : PASTE_OFFSET
          const dy = at ? at.y - minY : PASTE_OFFSET

          const newNodes: Record<string, MapNode> = {}
          for (const node of Object.values(clip.nodes)) {
            const isTop = node.areaId === ROOT_AREA
            newNodes[remap(node.id)] = {
              ...node,
              id: remap(node.id),
              areaId: remap(node.areaId),
              position: isTop
                ? { x: node.position.x + dx, y: node.position.y + dy }
                : node.position
            }
          }
          const newEdges: Record<string, MapEdge> = {}
          for (const edge of Object.values(clip.edges)) {
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
          return top.map((n) => remap(n.id))
        },

        discardNode: (id) => {
          const { past, nodes, deleteNodes } = get()
          if (!nodes[id]) return
          const last = past.at(-1)
          if (last && !last.nodes[id]) {
            set({ ...last, past: past.slice(0, -1) })
          } else {
            deleteNodes([id])
          }
        },

        duplicateNodes: (ids) => {
          const { copyNodes, pasteClip, nodes } = get()
          const clip = copyNodes(ids)
          const areaId = nodes[ids[0]]?.areaId
          return clip && areaId ? pasteClip(areaId, clip) : []
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
      storage: mapStorage,
      partialize: (s): MindMapDoc => ({
        nodes: s.nodes,
        edges: s.edges,
        viewports: s.viewports
      }),
      migrate: (persisted) => readDoc(persisted),
      merge: (persisted, current) => ({
        ...current,
        ...readDoc(persisted),
        past: [],
        future: []
      })
    }
  )
)

function isEmptyNode({ kind, data }: MapNode) {
  if (kind === 'text' || kind === 'sticky') return !data.text?.trim()
  if (kind === 'link' || kind === 'video') return !data.url
  return false
}

useUi.subscribe((state, prev) => {
  const id = prev.editingId
  if (!id || id === state.editingId) return
  const node = useMindMap.getState().nodes[id]
  if (node && isEmptyNode(node)) useMindMap.getState().discardNode(id)
})

onSavedElsewhere((name) => {
  if (name === STORAGE_KEY) void useMindMap.persist.rehydrate()
})

let firstLoadDone = useMindMap.persist.hasHydrated()
const loadListeners = new Set<() => void>()
useMindMap.persist.onFinishHydration(() => {
  if (firstLoadDone) return
  firstLoadDone = true
  loadListeners.forEach((listener) => listener())
})

export function useMapLoaded() {
  return useSyncExternalStore(
    (listener) => {
      loadListeners.add(listener)
      return () => loadListeners.delete(listener)
    },
    () => firstLoadDone
  )
}
