import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { MapEdge, MapNode, MapNodeData, MindMapDoc, XY } from '@/types'

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

export const useMindMap = create<MindMapState>()((set, get) => ({
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
        nodes: { ...s.nodes, [id]: { ...node, data: { ...node.data, ...data } } }
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
}))
