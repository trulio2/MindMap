export const ROOT_AREA = 'root'

export type NodeKind = 'topic'

export interface XY {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export type MapNodeData = {
  label: string
}

export interface MapNode {
  id: string
  /** 'root' or the id of the node whose inner area contains this node. */
  areaId: string
  kind: NodeKind
  position: XY
  measured?: Size
  data: MapNodeData
}

export interface MapEdge {
  id: string
  areaId: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

export interface MindMapDoc {
  nodes: Record<string, MapNode>
  edges: Record<string, MapEdge>
}
