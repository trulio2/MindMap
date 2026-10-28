export const ROOT_AREA = 'root'

export const DOC_VERSION = 1

export type NodeKind = 'topic' | 'text' | 'image' | 'link' | 'video'

export const NODE_COLORS = [
  'cyan',
  'green',
  'yellow',
  'orange',
  'red',
  'purple'
] as const

export type NodeColor = (typeof NODE_COLORS)[number]

export interface XY {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export type MapNodeData = {
  label?: string
  text?: string
  src?: string
  url?: string
  color?: NodeColor
}

export interface MapNode {
  id: string
  areaId: string
  kind: NodeKind
  position: XY
  size?: Partial<Size>
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
  label?: string
}

export interface AreaViewport {
  x: number
  y: number
  zoom: number
}

export interface MindMapDoc {
  nodes: Record<string, MapNode>
  edges: Record<string, MapEdge>
  viewports: Record<string, AreaViewport>
}

export type Clip = Pick<MindMapDoc, 'nodes' | 'edges'>
