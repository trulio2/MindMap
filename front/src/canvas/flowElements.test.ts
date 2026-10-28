import { describe, expect, it } from 'vitest'
import type { MapEdge, MapNode, MindMapDoc } from '@/types'
import {
  areaEdges,
  areaNodes,
  childCounts,
  toFlowEdge,
  toFlowNode
} from './flowElements'

const node = (id: string, areaId = 'root'): MapNode => ({
  id,
  areaId,
  kind: 'topic',
  position: { x: 1, y: 2 },
  size: { width: 50 },
  measured: { width: 50, height: 20 },
  data: { label: id }
})

const edge = (id: string, areaId = 'root'): MapEdge => ({
  id,
  areaId,
  source: 'a',
  target: 'b',
  sourceHandle: 'r',
  label: 'x'
})

describe('toFlowNode', () => {
  it('maps a stored node to a React Flow node', () => {
    expect(toFlowNode(node('a'), true, 0)).toEqual({
      id: 'a',
      type: 'topic',
      position: { x: 1, y: 2 },
      width: 50,
      height: undefined,
      measured: { width: 50, height: 20 },
      data: { label: 'a' },
      selected: true
    })
  })

  it('returns the same object while nothing changed', () => {
    const n = node('a')
    expect(toFlowNode(n, false, 0)).toBe(toFlowNode(n, false, 0))
  })

  it('returns a new object when the node, selection or badge changes', () => {
    const n = node('a')
    const first = toFlowNode(n, false, 0)
    expect(toFlowNode({ ...n }, false, 0)).not.toBe(first)
    expect(toFlowNode(n, true, 0)).not.toBe(first)
    const withBadge = toFlowNode(n, true, 3)
    expect(withBadge.data).toEqual({ label: 'a', childCount: 3 })
    expect(n.data).toEqual({ label: 'a' })
  })
})

describe('toFlowEdge', () => {
  it('maps and caches edges the same way', () => {
    const e = edge('e1')
    const flow = toFlowEdge(e, false)
    expect(flow).toEqual({
      id: 'e1',
      type: 'labeled',
      source: 'a',
      target: 'b',
      sourceHandle: 'r',
      targetHandle: undefined,
      data: { label: 'x' },
      selected: false
    })
    expect(toFlowEdge(e, false)).toBe(flow)
    expect(toFlowEdge(e, true)).not.toBe(flow)
  })
})

describe('area selectors', () => {
  const doc: MindMapDoc = {
    nodes: { a: node('a'), b: node('b', 'a'), c: node('c', 'a') },
    edges: { e1: edge('e1'), e2: edge('e2', 'a') },
    viewports: {}
  }

  it('pick the nodes and edges of one area', () => {
    expect(areaNodes('a')(doc).map((n) => n.id)).toEqual(['b', 'c'])
    expect(areaEdges('root')(doc).map((e) => e.id)).toEqual(['e1'])
  })

  it('count what is inside each node', () => {
    expect(childCounts(doc)).toEqual({ root: 1, a: 2 })
  })
})
