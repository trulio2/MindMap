import { describe, expect, it } from 'vitest'
import type { MapNode } from '@/types'
import { areaPath, areaTrail, nodeTitle } from './areas'

const node = (
  id: string,
  areaId: string,
  kind: MapNode['kind'] = 'topic',
  data: MapNode['data'] = {}
): MapNode => ({ id, areaId, kind, position: { x: 0, y: 0 }, data })

describe('areaPath', () => {
  it('maps the root and node areas to routes', () => {
    expect(areaPath('root')).toBe('/')
    expect(areaPath('abc_1-2')).toBe('/area/abc_1-2')
  })
})

describe('nodeTitle', () => {
  it('uses the label without formatting', () => {
    expect(
      nodeTitle(node('a', 'root', 'topic', { label: '**Big** idea' }))
    ).toBe('Big idea')
  })

  it('uses the first line of text bubbles and sticky notes, shortened', () => {
    expect(
      nodeTitle(node('a', 'root', 'text', { text: 'First\nSecond' }))
    ).toBe('First')
    expect(
      nodeTitle(node('a', 'root', 'sticky', { text: 'x'.repeat(50) }))
    ).toBe(`${'x'.repeat(40)}…`)
  })

  it('falls back to a description of the element', () => {
    expect(
      nodeTitle(node('a', 'root', 'link', { url: 'https://www.example.com/x' }))
    ).toBe('example.com')
    expect(nodeTitle(node('a', 'root', 'video', { url: 'x' }))).toBe('Video')
    expect(nodeTitle(node('a', 'root', 'image'))).toBe('Image')
    expect(nodeTitle(node('a', 'root', 'topic'))).toBe('Untitled')
  })
})

describe('areaTrail', () => {
  it('lists the nodes from the outermost area inwards', () => {
    const nodes = {
      a: node('a', 'root'),
      b: node('b', 'a'),
      c: node('c', 'b')
    }
    expect(areaTrail(nodes, 'c').map((n) => n.id)).toEqual(['a', 'b', 'c'])
    expect(areaTrail(nodes, 'root')).toEqual([])
  })

  it('stops on loops instead of running forever', () => {
    const nodes = { a: node('a', 'b'), b: node('b', 'a') }
    expect(areaTrail(nodes, 'a').map((n) => n.id)).toEqual(['b', 'a'])
  })
})
