import {
  DOC_VERSION,
  NODE_COLORS,
  ROOT_AREA,
  type AreaViewport,
  type Clip,
  type MapEdge,
  type MapNode,
  type MapNodeData,
  type MindMapDoc,
  type NodeColor,
  type NodeKind,
  type Size,
  type XY
} from '@/types'

export const FILE_APP = 'mindmap'

const MAX_FILE_BYTES = 50 * 1024 * 1024

const NODE_KINDS = new Set<string>([
  'topic',
  'text',
  'image',
  'link',
  'video',
  'sticky'
] satisfies NodeKind[])

export type MapFile = MindMapDoc & {
  app: typeof FILE_APP
  version: number
  exportedAt: string
}

export class ImportError extends Error {}

export type ParsedDoc = {
  doc: MindMapDoc
  skipped: number
}

export const emptyDoc = (): MindMapDoc => ({
  nodes: {},
  edges: {},
  viewports: {}
})

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v)

const optionalString = (v: unknown) => (typeof v === 'string' ? v : undefined)

const isSafeId = (id: string) =>
  /^[\w-]{1,64}$/.test(id) &&
  !['__proto__', 'constructor', 'prototype'].includes(id)

function readXY(v: unknown): XY | null {
  return isRecord(v) && isNumber(v.x) && isNumber(v.y)
    ? { x: v.x, y: v.y }
    : null
}

function readSize(v: unknown): Partial<Size> | undefined {
  if (!isRecord(v)) return undefined
  const size: Partial<Size> = {}
  if (isNumber(v.width) && v.width > 0) size.width = v.width
  if (isNumber(v.height) && v.height > 0) size.height = v.height
  return Object.keys(size).length ? size : undefined
}

function readData(v: unknown): MapNodeData {
  if (!isRecord(v)) return {}
  const data: MapNodeData = {}
  for (const key of ['label', 'text', 'src', 'url'] as const) {
    const value = optionalString(v[key])
    if (value !== undefined) data[key] = value
  }
  if (NODE_COLORS.includes(v.color as NodeColor)) {
    data.color = v.color as NodeColor
  }
  return data
}

function readNode(id: string, v: unknown): MapNode | null {
  if (id === ROOT_AREA || !isSafeId(id) || !isRecord(v)) return null
  const position = readXY(v.position)
  if (
    typeof v.areaId !== 'string' ||
    !NODE_KINDS.has(v.kind as string) ||
    !position
  ) {
    return null
  }

  const node: MapNode = {
    id,
    areaId: v.areaId,
    kind: v.kind as NodeKind,
    position,
    data: readData(v.data)
  }
  const size = readSize(v.size)
  if (size) node.size = size
  const measured = readSize(v.measured)
  if (measured?.width && measured.height) {
    node.measured = { width: measured.width, height: measured.height }
  }
  return node
}

function reachableNodes(candidates: MapNode[]): Record<string, MapNode> {
  const byArea = new Map<string, MapNode[]>()
  for (const node of candidates) {
    byArea.set(node.areaId, [...(byArea.get(node.areaId) ?? []), node])
  }
  const nodes: Record<string, MapNode> = {}
  const queue = [ROOT_AREA]
  while (queue.length) {
    for (const node of byArea.get(queue.pop()!) ?? []) {
      if (nodes[node.id]) continue
      nodes[node.id] = node
      queue.push(node.id)
    }
  }
  return nodes
}

function readEdge(
  id: string,
  v: unknown,
  nodes: Record<string, MapNode>
): MapEdge | null {
  if (!isSafeId(id) || !isRecord(v)) return null
  const { areaId, source, target } = v
  if (
    typeof areaId !== 'string' ||
    typeof source !== 'string' ||
    typeof target !== 'string' ||
    source === target ||
    nodes[source]?.areaId !== areaId ||
    nodes[target]?.areaId !== areaId
  ) {
    return null
  }

  const handle = (h: unknown) => (typeof h === 'string' ? h : null)
  const edge: MapEdge = {
    id,
    areaId,
    source,
    target,
    sourceHandle: handle(v.sourceHandle),
    targetHandle: handle(v.targetHandle)
  }
  const label = optionalString(v.label)
  if (label) edge.label = label
  return edge
}

function readViewports(
  v: unknown,
  nodes: Record<string, MapNode>
): Record<string, AreaViewport> {
  if (!isRecord(v)) return {}
  const viewports: Record<string, AreaViewport> = {}
  for (const [areaId, vp] of Object.entries(v)) {
    if (areaId !== ROOT_AREA && !nodes[areaId]) continue
    if (isRecord(vp) && isNumber(vp.x) && isNumber(vp.y) && isNumber(vp.zoom)) {
      if (vp.zoom > 0) viewports[areaId] = { x: vp.x, y: vp.y, zoom: vp.zoom }
    }
  }
  return viewports
}

export function parseDoc(raw: unknown, app = FILE_APP): ParsedDoc {
  if (!isRecord(raw) || !isRecord(raw.nodes) || !isRecord(raw.edges)) {
    throw new ImportError("This file isn't a mind map export.")
  }
  if (raw.app !== undefined && raw.app !== app) {
    throw new ImportError("This file isn't a mind map export.")
  }
  const version = raw.version ?? DOC_VERSION
  if (!isNumber(version) || version > DOC_VERSION) {
    throw new ImportError(
      'This map was made with a newer version of the app. Update the app and try again.'
    )
  }

  const rawNodes = Object.entries(raw.nodes)
  const rawEdges = Object.entries(raw.edges)
  const candidates = rawNodes
    .map(([id, v]) => readNode(id, v))
    .filter((n) => n !== null)
  const nodes = reachableNodes(candidates)

  const edges: Record<string, MapEdge> = {}
  for (const [id, v] of rawEdges) {
    const edge = readEdge(id, v, nodes)
    if (edge) edges[id] = edge
  }

  const skipped =
    rawNodes.length -
    Object.keys(nodes).length +
    rawEdges.length -
    Object.keys(edges).length

  return {
    doc: { nodes, edges, viewports: readViewports(raw.viewports, nodes) },
    skipped
  }
}

const CLIP_APP = 'mindmap-clip'

export function serializeClip(clip: Clip): string {
  return JSON.stringify({ app: CLIP_APP, version: DOC_VERSION, ...clip })
}

export function parseClip(text: string): Clip | null {
  if (!text.includes(CLIP_APP)) return null
  try {
    const { nodes, edges } = parseDoc(JSON.parse(text), CLIP_APP).doc
    return Object.keys(nodes).length ? { nodes, edges } : null
  } catch {
    return null
  }
}

export async function readMapFile(file: File): Promise<ParsedDoc> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportError(
      'This file is too large to be a mind map (over 50 MB).'
    )
  }
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    throw new ImportError(`"${file.name}" isn't a valid JSON file.`)
  }
  return parseDoc(raw)
}

export function downloadDoc(doc: MindMapDoc) {
  const file: MapFile = {
    app: FILE_APP,
    version: DOC_VERSION,
    exportedAt: new Date().toISOString(),
    nodes: doc.nodes,
    edges: doc.edges,
    viewports: doc.viewports
  }
  const blob = new Blob([JSON.stringify(file, null, 2)], {
    type: 'application/json'
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `mindmap-${file.exportedAt.slice(0, 10)}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
