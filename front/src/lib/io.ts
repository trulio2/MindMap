import {
  DOC_VERSION,
  NODE_COLORS,
  ROOT_AREA,
  type AreaViewport,
  type Clip,
  type Folder,
  type LibraryTree,
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
  name?: string
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

export const LIBRARY_APP = 'mindmap-library'

const MAX_NAME_LENGTH = 120

export function cleanName(value: unknown, fallback: string): string {
  const name =
    typeof value === 'string' ? value.trim().slice(0, MAX_NAME_LENGTH) : ''
  return name || fallback
}

export function parseLibrary(raw: unknown): {
  tree: LibraryTree
  skipped: number
} {
  if (
    !isRecord(raw) ||
    raw.app !== LIBRARY_APP ||
    !Array.isArray(raw.folders) ||
    !Array.isArray(raw.maps)
  ) {
    throw new ImportError("This file isn't a mind map library export.")
  }
  if (!isNumber(raw.version) || raw.version > DOC_VERSION) {
    throw new ImportError(
      'This library was made with a newer version of the app. Update the app and try again.'
    )
  }

  let skipped = 0
  const candidates = new Map<string, Folder>()
  for (const f of raw.folders) {
    if (!isRecord(f) || typeof f.id !== 'string' || !isSafeId(f.id)) {
      skipped++
      continue
    }
    if (candidates.has(f.id)) {
      skipped++
      continue
    }
    candidates.set(f.id, {
      id: f.id,
      name: cleanName(f.name, 'Untitled folder'),
      parentId: typeof f.parentId === 'string' ? f.parentId : null
    })
  }

  const folders: Folder[] = []
  const kept = new Set<string>()
  for (let grew = true; grew; ) {
    grew = false
    for (const folder of candidates.values()) {
      if (kept.has(folder.id)) continue
      if (folder.parentId === null || kept.has(folder.parentId)) {
        kept.add(folder.id)
        folders.push(folder)
        grew = true
      }
    }
  }
  skipped += candidates.size - kept.size

  const maps: LibraryTree['maps'] = []
  const mapIds = new Set<string>()
  for (const m of raw.maps) {
    if (
      !isRecord(m) ||
      typeof m.id !== 'string' ||
      !isSafeId(m.id) ||
      mapIds.has(m.id)
    ) {
      skipped++
      continue
    }
    try {
      const { doc } = parseDoc(m.doc)
      mapIds.add(m.id)
      maps.push({
        id: m.id,
        name: cleanName(m.name, 'Untitled map'),
        folderId:
          typeof m.folderId === 'string' && kept.has(m.folderId)
            ? m.folderId
            : null,
        doc
      })
    } catch {
      skipped++
    }
  }

  return { tree: { folders, maps }, skipped }
}

export type ImportedFile =
  | { kind: 'map'; name: string; parsed: ParsedDoc }
  | { kind: 'library'; tree: LibraryTree; skipped: number }

export async function readImportFile(file: File): Promise<ImportedFile> {
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
  if (isRecord(raw) && raw.app === LIBRARY_APP) {
    return { kind: 'library', ...parseLibrary(raw) }
  }
  const parsed = parseDoc(raw)
  const fallback = cleanName(file.name.replace(/\.json$/i, ''), 'Imported map')
  const name = isRecord(raw) ? cleanName(raw.name, fallback) : fallback
  return { kind: 'map', name, parsed }
}

export function slug(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'mindmap'
  )
}

function downloadJson(fileName: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function mapFile(name: string, doc: MindMapDoc): MapFile {
  return {
    app: FILE_APP,
    version: DOC_VERSION,
    exportedAt: new Date().toISOString(),
    name,
    nodes: doc.nodes,
    edges: doc.edges,
    viewports: doc.viewports
  }
}

export function libraryFile(tree: LibraryTree) {
  return {
    app: LIBRARY_APP,
    version: DOC_VERSION,
    exportedAt: new Date().toISOString(),
    folders: tree.folders,
    maps: tree.maps.map(({ doc, ...meta }) => ({
      ...meta,
      doc: { nodes: doc.nodes, edges: doc.edges, viewports: doc.viewports }
    }))
  }
}

export function downloadMap(name: string, doc: MindMapDoc) {
  downloadJson(`${slug(name)}.json`, mapFile(name, doc))
}

export function downloadLibrary(fileName: string, tree: LibraryTree) {
  downloadJson(fileName, libraryFile(tree))
}
