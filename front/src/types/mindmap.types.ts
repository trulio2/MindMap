export const ROOT_AREA = 'root'

/** Bump when MindMapDoc changes shape, and add a migration for the old one. */
export const DOC_VERSION = 1

export type NodeKind = 'topic' | 'text' | 'image' | 'link'

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

/** One shape for every kind; each kind reads the fields it needs. */
export type MapNodeData = {
  /** Topic title, link title or image caption. */
  label?: string
  /** Text bubble content. */
  text?: string
  /** Image as a data URL. */
  src?: string
  url?: string
  color?: NodeColor
}

export interface MapNode {
  id: string
  /** 'root' or the id of the node whose inner area contains this node. */
  areaId: string
  kind: NodeKind
  position: XY
  /** Size set by the user with a resize handle. */
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
  /** Last pan and zoom of each area you have visited, by area id. */
  viewports: Record<string, AreaViewport>
}
