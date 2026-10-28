import { ROOT_AREA, type MapNode } from '@/types'
import { plainText } from './markdown'
import { displayHost, safeHref } from './url'

/** Route for a map, or for an area (the inside of a node) in that map. */
export function areaPath(mapId: string, areaId: string = ROOT_AREA) {
  const map = `/map/${encodeURIComponent(mapId)}`
  return areaId === ROOT_AREA
    ? map
    : `${map}/area/${encodeURIComponent(areaId)}`
}

export function nodeTitle(node: MapNode): string {
  const { label, text, url } = node.data
  if (label) return plainText(label)
  if ((node.kind === 'text' || node.kind === 'sticky') && text) {
    const firstLine = plainText(text.split('\n')[0])
    return firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine
  }
  const href = safeHref(url)
  if (node.kind === 'link' && href) return displayHost(href)
  if (node.kind === 'video') return 'Video'
  return node.kind === 'image' ? 'Image' : 'Untitled'
}

export function areaTrail(
  nodes: Record<string, MapNode>,
  areaId: string
): MapNode[] {
  const trail: MapNode[] = []
  const seen = new Set<string>()
  let current = nodes[areaId]
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    trail.unshift(current)
    current = nodes[current.areaId]
  }
  return trail
}
