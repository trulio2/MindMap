import type { MapEdge, MapNode, MindMapDoc } from '@/types'
import type { FlowEdge, FlowNode } from './types'

const nodeCache = new WeakMap<
  MapNode,
  { selected: boolean; childCount: number; flow: FlowNode }
>()

export function toFlowNode(
  node: MapNode,
  selected: boolean,
  childCount: number
): FlowNode {
  const hit = nodeCache.get(node)
  if (hit && hit.selected === selected && hit.childCount === childCount) {
    return hit.flow
  }
  const flow: FlowNode = {
    id: node.id,
    type: node.kind,
    position: node.position,
    width: node.size?.width,
    height: node.size?.height,
    measured: node.measured,
    data: childCount ? { ...node.data, childCount } : node.data,
    selected
  }
  nodeCache.set(node, { selected, childCount, flow })
  return flow
}

const edgeCache = new WeakMap<MapEdge, { selected: boolean; flow: FlowEdge }>()

export function toFlowEdge(edge: MapEdge, selected: boolean): FlowEdge {
  const hit = edgeCache.get(edge)
  if (hit && hit.selected === selected) return hit.flow
  const flow: FlowEdge = {
    id: edge.id,
    type: 'labeled',
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    data: { label: edge.label },
    selected
  }
  edgeCache.set(edge, { selected, flow })
  return flow
}

export const areaNodes = (areaId: string) => (s: MindMapDoc) =>
  Object.values(s.nodes).filter((n) => n.areaId === areaId)

export const areaEdges = (areaId: string) => (s: MindMapDoc) =>
  Object.values(s.edges).filter((e) => e.areaId === areaId)

export const childCounts = (s: MindMapDoc) => {
  const counts: Record<string, number> = {}
  for (const n of Object.values(s.nodes)) {
    counts[n.areaId] = (counts[n.areaId] ?? 0) + 1
  }
  return counts
}
