import { describe, expect, it } from 'vitest'
import { DOC_VERSION } from '@/types'
import {
  ImportError,
  parseClip,
  parseDoc,
  readMapFile,
  serializeClip
} from './io'

const topic = (areaId = 'root', extra: object = {}) => ({
  areaId,
  kind: 'topic',
  position: { x: 1, y: 2 },
  data: { label: 'T' },
  ...extra
})

const validMap = {
  app: 'mindmap',
  version: 1,
  nodes: {
    a: topic(),
    b: {
      areaId: 'root',
      kind: 'link',
      position: { x: 300, y: 0 },
      data: { label: 'Docs', url: 'https://example.com/', color: 'green' },
      measured: { width: 120, height: 40 }
    },
    c: {
      areaId: 'a',
      kind: 'text',
      position: { x: 0, y: 0 },
      size: { width: 220 },
      data: { text: 'inside **a**' }
    }
  },
  edges: {
    e1: {
      areaId: 'root',
      source: 'a',
      target: 'b',
      sourceHandle: 'r',
      label: 'see'
    }
  },
  viewports: { root: { x: 0, y: 0, zoom: 1 }, a: { x: 5, y: 6, zoom: 0.8 } }
}

describe('parseDoc: valid maps', () => {
  it('keeps every field of a valid map', () => {
    const { doc, skipped } = parseDoc(validMap)
    expect(skipped).toBe(0)
    expect(Object.keys(doc.nodes).sort()).toEqual(['a', 'b', 'c'])
    expect(doc.nodes.b).toEqual({
      id: 'b',
      areaId: 'root',
      kind: 'link',
      position: { x: 300, y: 0 },
      data: { label: 'Docs', url: 'https://example.com/', color: 'green' },
      measured: { width: 120, height: 40 }
    })
    expect(doc.nodes.c.size).toEqual({ width: 220 })
    expect(doc.edges.e1).toEqual({
      id: 'e1',
      areaId: 'root',
      source: 'a',
      target: 'b',
      sourceHandle: 'r',
      targetHandle: null,
      label: 'see'
    })
    expect(doc.viewports).toEqual(validMap.viewports)
  })

  it('accepts data without the app marker or version (saved state)', () => {
    const bare = { nodes: validMap.nodes, edges: validMap.edges }
    expect(parseDoc(bare).skipped).toBe(0)
  })

  it('accepts every element kind', () => {
    const kinds = ['topic', 'text', 'sticky', 'image', 'link', 'video']
    const nodes = Object.fromEntries(
      kinds.map((kind) => [kind, { ...topic(), kind }])
    )
    const { doc } = parseDoc({ nodes, edges: {} })
    expect(Object.keys(doc.nodes).sort()).toEqual([...kinds].sort())
  })
})

describe('parseDoc: rejected files', () => {
  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'map'],
    ['missing edges', { nodes: {} }],
    ['nodes as an array', { nodes: [], edges: {} }],
    ['another app', { app: 'other', nodes: {}, edges: {} }]
  ])('rejects %s', (_, raw) => {
    expect(() => parseDoc(raw)).toThrow(ImportError)
  })

  it('rejects maps from a newer version with a clear message', () => {
    expect(() =>
      parseDoc({ version: DOC_VERSION + 1, nodes: {}, edges: {} })
    ).toThrow(/newer version/)
  })
})

describe('parseDoc: broken or hostile entries', () => {
  const hostile = JSON.parse(`{
    "nodes": {
      "good2": { "areaId": "root", "kind": "topic", "position": { "x": 9, "y": 9 }, "data": {} },
      "good": { "areaId": "root", "kind": "topic", "position": { "x": 0, "y": 0 },
                "data": { "label": "Fine", "color": "hotpink", "onclick": "x" }, "extra": 1 },
      "__proto__": { "areaId": "root", "kind": "topic", "position": { "x": 0, "y": 0 }, "data": {} },
      "constructor": { "areaId": "root", "kind": "topic", "position": { "x": 0, "y": 0 }, "data": {} },
      "root": { "areaId": "root", "kind": "topic", "position": { "x": 0, "y": 0 }, "data": {} },
      "bad id!": { "areaId": "root", "kind": "topic", "position": { "x": 0, "y": 0 }, "data": {} },
      "orphan": { "areaId": "missing", "kind": "topic", "position": { "x": 0, "y": 0 }, "data": {} },
      "loopA": { "areaId": "loopB", "kind": "topic", "position": { "x": 0, "y": 0 }, "data": {} },
      "loopB": { "areaId": "loopA", "kind": "topic", "position": { "x": 0, "y": 0 }, "data": {} },
      "badKind": { "areaId": "root", "kind": "script", "position": { "x": 0, "y": 0 }, "data": {} },
      "noPos": { "areaId": "root", "kind": "topic", "position": { "x": "a" }, "data": {} },
      "nanPos": { "areaId": "root", "kind": "topic", "position": { "x": 1e999, "y": 0 }, "data": {} },
      "child": { "areaId": "good", "kind": "text", "position": { "x": 0, "y": 0 },
                 "data": { "text": 42 }, "size": { "width": -5, "height": 10 } }
    },
    "edges": {
      "ok": { "areaId": "root", "source": "good", "target": "child" },
      "self": { "areaId": "root", "source": "good", "target": "good" },
      "dangling": { "areaId": "root", "source": "good", "target": "nope" },
      "__proto__": { "areaId": "root", "source": "good", "target": "good2" }
    },
    "viewports": { "root": { "x": 0, "y": 0, "zoom": 1 }, "nope": { "x": 0, "y": 0, "zoom": 1 },
                   "good": { "x": 0, "y": 0, "zoom": -2 } }
  }`)

  it('keeps only valid, reachable entries and counts the rest', () => {
    const { doc, skipped } = parseDoc(hostile)
    expect(Object.keys(doc.nodes).sort()).toEqual(['child', 'good', 'good2'])
    expect(Object.keys(doc.edges)).toEqual([])
    expect(Object.keys(doc.viewports)).toEqual(['root'])
    expect(skipped).toBe(10 + 4)
  })

  it('rebuilds nodes from known fields only', () => {
    const { doc } = parseDoc(hostile)
    expect(doc.nodes.good).toEqual({
      id: 'good',
      areaId: 'root',
      kind: 'topic',
      position: { x: 0, y: 0 },
      data: { label: 'Fine' }
    })
    expect(doc.nodes.child.data).toEqual({})
    expect(doc.nodes.child.size).toEqual({ height: 10 })
  })

  it('never changes object prototypes', () => {
    const { doc } = parseDoc(hostile)
    expect(Object.getPrototypeOf(doc.nodes)).toBe(Object.prototype)
    expect(Object.getPrototypeOf(doc.edges)).toBe(Object.prototype)
    expect(({} as Record<string, unknown>).areaId).toBeUndefined()
  })
})

describe('clipboard clips', () => {
  const clip = parseDoc(validMap).doc

  it('round-trips through clipboard text', () => {
    const parsed = parseClip(serializeClip(clip))
    expect(parsed?.nodes).toEqual(clip.nodes)
    expect(parsed?.edges).toEqual(clip.edges)
  })

  it('ignores ordinary text, map exports and broken JSON', () => {
    expect(parseClip('hello world')).toBeNull()
    expect(parseClip(JSON.stringify(validMap))).toBeNull()
    expect(parseClip('{"app":"mindmap-clip", broken')).toBeNull()
    expect(
      parseClip(JSON.stringify({ app: 'mindmap-clip', nodes: {}, edges: {} }))
    ).toBeNull()
  })

  it('validates pasted clips like imports', () => {
    const text = JSON.stringify({
      app: 'mindmap-clip',
      nodes: {
        x: {
          areaId: 'root',
          kind: 'link',
          position: { x: 0, y: 0 },
          data: { url: 'javascript:alert(1)', html: '<b>' }
        }
      },
      edges: {}
    })
    expect(parseClip(text)?.nodes.x.data).toEqual({
      url: 'javascript:alert(1)'
    })
  })
})

describe('readMapFile', () => {
  const file = (text: string, name = 'map.json') =>
    new File([text], name, { type: 'application/json' })

  it('reads a valid export', async () => {
    const { doc } = await readMapFile(file(JSON.stringify(validMap)))
    expect(Object.keys(doc.nodes)).toHaveLength(3)
  })

  it('names the file when it is not JSON', async () => {
    await expect(readMapFile(file('{ nope', 'broken.json'))).rejects.toThrow(
      '"broken.json" isn\'t a valid JSON file.'
    )
  })

  it('refuses files over 50 MB without reading them', async () => {
    const big = file('{}')
    Object.defineProperty(big, 'size', { value: 50 * 1024 * 1024 + 1 })
    await expect(readMapFile(big)).rejects.toThrow(/too large/)
  })
})
