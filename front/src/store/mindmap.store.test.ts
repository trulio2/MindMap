import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import type { XY } from '@/types'
import { idbDelete, idbGet, idbSet } from './idb'
import { useMindMap } from './mindmap.store'
import { flushPendingWrites } from './storage'
import { useUi } from './ui.store'

const at = (x = 0, y = 0): XY => ({ x, y })
const map = () => useMindMap.getState()
const steps = () => map().past.length
const ids = () => Object.keys(map().nodes).sort()

function addTopic(areaId = 'root', label = 'T', position = at()) {
  return map().addNode(areaId, { kind: 'topic', position, data: { label } })
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  await useMindMap.persist.rehydrate()
})
afterAll(() => vi.useRealTimers())
afterEach(() => vi.restoreAllMocks())

beforeEach(async () => {
  useMindMap.setState({
    nodes: {},
    edges: {},
    viewports: {},
    past: [],
    future: []
  })
  await flushPendingWrites()
  await idbDelete('mindmap')
  localStorage.clear()
  useUi.setState({
    selectedNodes: {},
    selectedEdges: {},
    editingId: null,
    storageError: null,
    clipboard: null
  })
})

describe('adding nodes', () => {
  it('fills in defaults for each kind', () => {
    const t = map().addNode('root', { kind: 'topic', position: at() })
    const x = map().addNode('root', { kind: 'text', position: at() })
    const s = map().addNode('root', { kind: 'sticky', position: at() })
    const v = map().addNode('root', { kind: 'video', position: at() })
    const { nodes } = map()
    expect(nodes[t].data).toEqual({ label: 'New topic' })
    expect(nodes[x]).toMatchObject({ data: { text: '' }, size: { width: 220 } })
    expect(nodes[s]).toMatchObject({
      data: { text: '', color: 'yellow' },
      size: { width: 200, height: 200 }
    })
    expect(nodes[v]).toMatchObject({ size: { width: 360 } })
  })

  it('records one undo step per node', () => {
    addTopic()
    addTopic()
    expect(steps()).toBe(2)
  })
})

describe('editing', () => {
  it('only records a step when the data actually changes', () => {
    const id = addTopic('root', 'Same')
    map().updateNodeData(id, { label: 'Same' })
    map().updateNodeData(id, { color: undefined })
    expect(steps()).toBe(1)
    map().updateNodeData(id, { label: 'New' })
    expect(steps()).toBe(2)
    expect(map().nodes[id].data.label).toBe('New')
  })

  it('moves and resizes without recording steps', () => {
    const id = addTopic()
    map().patchNodes({ [id]: { position: at(5, 6), size: { width: 99 } } })
    expect(map().nodes[id]).toMatchObject({
      position: at(5, 6),
      size: { width: 99 }
    })
    expect(steps()).toBe(1)
  })
})

describe('deleting', () => {
  it('removes nested content, touching edges and saved views', () => {
    const a = addTopic()
    const b = addTopic()
    const inner = addTopic(a)
    const deeper = addTopic(inner)
    const innerSibling = addTopic(a)
    map().addEdge('root', { source: a, target: b })
    map().addEdge(a, { source: inner, target: innerSibling })
    map().saveViewport(a, { x: 1, y: 2, zoom: 1 })
    map().saveViewport(inner, { x: 1, y: 2, zoom: 1 })

    map().deleteNodes([a])

    expect(ids()).toEqual([b])
    expect(map().edges).toEqual({})
    expect(map().viewports).toEqual({})
    expect(map().nodes[deeper]).toBeUndefined()
  })
})

describe('edges', () => {
  it('refuses self-connections and duplicates in either direction', () => {
    const a = addTopic()
    const b = addTopic()
    expect(map().addEdge('root', { source: a, target: a })).toBeNull()
    expect(map().addEdge('root', { source: a, target: b })).not.toBeNull()
    expect(map().addEdge('root', { source: a, target: b })).toBeNull()
    expect(map().addEdge('root', { source: b, target: a })).toBeNull()
    expect(Object.keys(map().edges)).toHaveLength(1)
  })

  it('sets and clears labels, ignoring no-op changes', () => {
    const e = map().addEdge('root', { source: addTopic(), target: addTopic() })!
    const before = steps()
    map().setEdgeLabel(e, 'leads to')
    expect(map().edges[e].label).toBe('leads to')
    map().setEdgeLabel(e, 'leads to')
    expect(steps()).toBe(before + 1)
    map().setEdgeLabel(e, '')
    expect('label' in map().edges[e]).toBe(false)
  })
})

describe('undo and redo', () => {
  it('steps back and forward through changes', () => {
    const a = addTopic('root', 'A')
    map().updateNodeData(a, { label: 'A2' })
    const b = addTopic('root', 'B')

    map().undo()
    expect(ids()).toEqual([a])
    map().undo()
    expect(map().nodes[a].data.label).toBe('A')
    map().redo()
    map().redo()
    expect(ids()).toEqual([a, b].sort())
    expect(map().nodes[a].data.label).toBe('A2')
  })

  it('does nothing at either end of the history', () => {
    map().undo()
    map().redo()
    expect(ids()).toEqual([])
  })

  it('drops the redo stack on a new change', () => {
    addTopic()
    map().undo()
    expect(map().future).toHaveLength(1)
    addTopic()
    expect(map().future).toHaveLength(0)
  })

  it('keeps at most 100 steps', () => {
    for (let i = 0; i < 120; i++) addTopic()
    expect(steps()).toBe(100)
  })

  it('treats a group of changes as one step', () => {
    const a = addTopic()
    const before = steps()
    map().group(() => {
      const b = addTopic()
      map().addEdge('root', { source: a, target: b })
    })
    expect(steps()).toBe(before + 1)
    map().undo()
    expect(ids()).toEqual([a])
    expect(map().edges).toEqual({})
  })

  it('skips a checkpoint when nothing changed since the last one', () => {
    addTopic()
    map().checkpoint()
    map().checkpoint()
    expect(steps()).toBe(2)
    map().checkpoint()
    expect(steps()).toBe(2)
  })

  it('can undo replacing the whole map', () => {
    const a = addTopic()
    map().replaceDoc({ nodes: {}, edges: {}, viewports: {} })
    expect(ids()).toEqual([])
    map().undo()
    expect(ids()).toEqual([a])
  })
})

describe('copy and paste', () => {
  function sample() {
    const a = addTopic('root', 'A', at(100, 100))
    const b = addTopic('root', 'B', at(300, 100))
    const outside = addTopic('root', 'Outside', at(0, 0))
    const inner = addTopic(a, 'Inner', at(7, 8))
    const inner2 = addTopic(a, 'Inner2', at(50, 8))
    map().addEdge('root', { source: a, target: b })
    map().addEdge('root', { source: a, target: outside })
    map().addEdge(a, { source: inner, target: inner2 })
    return { a, b, outside, inner, inner2 }
  }

  it('copies nodes with their contents, rebased to the clip root', () => {
    const { a, b, inner, inner2 } = sample()
    const clip = map().copyNodes([a, b])!
    expect(Object.keys(clip.nodes).sort()).toEqual([a, b, inner, inner2].sort())
    expect(clip.nodes[a].areaId).toBe('root')
    expect(clip.nodes[inner].areaId).toBe(a)
    // Only edges with both ends copied come along.
    expect(Object.values(clip.edges).map((e) => [e.source, e.target])).toEqual(
      expect.arrayContaining([
        [a, b],
        [inner, inner2]
      ])
    )
    expect(Object.keys(clip.edges)).toHaveLength(2)
  })

  it('pastes with new ids into any area, placed at the given point', () => {
    const { a, b, outside } = sample()
    const clip = map().copyNodes([a, b])!
    const pasted = map().pasteClip(outside, clip, at(10, 20))

    expect(pasted).toHaveLength(2)
    expect(pasted).not.toContain(a)
    const [pa, pb] = pasted.map((id) => map().nodes[id])
    expect(pa.areaId).toBe(outside)
    // The group's top-left corner lands on the point; spacing is kept.
    expect(pa.position).toEqual(at(10, 20))
    expect(pb.position).toEqual(at(210, 20))

    const pastedInner = Object.values(map().nodes).filter(
      (n) => n.areaId === pa.id
    )
    expect(pastedInner.map((n) => n.position)).toEqual([at(7, 8), at(50, 8)])
    const pastedEdges = Object.values(map().edges).filter(
      (e) => e.areaId === outside || e.areaId === pa.id
    )
    expect(pastedEdges).toHaveLength(2)
  })

  it('gives every paste fresh ids', () => {
    const { a } = sample()
    const clip = map().copyNodes([a])!
    const first = map().pasteClip('root', clip)
    const second = map().pasteClip('root', clip)
    expect(first[0]).not.toBe(second[0])
  })

  it('duplicates next to the original as one undo step', () => {
    const { a } = sample()
    const before = steps()
    const [copy] = map().duplicateNodes([a])
    expect(map().nodes[copy].position).toEqual(at(124, 124))
    expect(map().nodes[copy].areaId).toBe('root')
    expect(steps()).toBe(before + 1)
    map().undo()
    expect(map().nodes[copy]).toBeUndefined()
  })
})

describe('empty elements', () => {
  it('discards a node and its creation step when it was the last change', () => {
    const keep = addTopic()
    const before = steps()
    const id = map().addNode('root', { kind: 'text', position: at() })
    map().discardNode(id)
    expect(ids()).toEqual([keep])
    expect(steps()).toBe(before)
  })

  it('deletes normally when the node is older', () => {
    const id = map().addNode('root', { kind: 'text', position: at() })
    addTopic()
    map().discardNode(id)
    expect(map().nodes[id]).toBeUndefined()
    map().undo()
    expect(map().nodes[id]).toBeDefined()
  })

  it.each(['text', 'sticky', 'link', 'video'] as const)(
    'removes an empty %s when editing ends',
    (kind) => {
      const id = map().addNode('root', { kind, position: at() })
      useUi.getState().setEditing(id)
      useUi.getState().resetInteraction()
      expect(map().nodes[id]).toBeUndefined()
    }
  )

  it('keeps filled-in elements and topics', () => {
    const text = map().addNode('root', {
      kind: 'text',
      position: at(),
      data: { text: 'hi' }
    })
    const topic = addTopic()
    for (const id of [text, topic]) {
      useUi.getState().setEditing(id)
      useUi.getState().setEditing(null)
    }
    expect(ids()).toEqual([text, topic].sort())
  })

  it('removes a connected element together with its connection', () => {
    const a = addTopic()
    const before = steps()
    let id = ''
    map().group(() => {
      id = map().addNode('root', { kind: 'text', position: at() })
      map().addEdge('root', { source: a, target: id })
    })
    useUi.getState().setEditing(id)
    useUi.getState().setEditing(null)
    expect(ids()).toEqual([a])
    expect(map().edges).toEqual({})
    expect(steps()).toBe(before)
  })
})

describe('saving', () => {
  const saved = () =>
    idbGet<{ version: number; state: Record<string, unknown> }>('mindmap')

  async function settle() {
    await vi.advanceTimersByTimeAsync(300)
    await flushPendingWrites()
  }

  it('writes the map 300 ms after the last change, as an object', async () => {
    const id = addTopic()
    map().saveViewport('root', { x: 1, y: 2, zoom: 3 })
    expect(await saved()).toBeUndefined()

    await settle()
    const value = await saved()
    expect(value?.version).toBe(1)
    expect(Object.keys(value!.state).sort()).toEqual([
      'edges',
      'nodes',
      'viewports'
    ])
    expect(value!.state.nodes).toMatchObject({ [id]: { data: { label: 'T' } } })
  })

  it('tells other tabs when it saves', async () => {
    const other = new BroadcastChannel('mindmap')
    const received = new Promise(
      (resolve) => (other.onmessage = (e) => resolve(e.data))
    )
    addTopic()
    await settle()
    expect(await received).toBe('mindmap')
    other.close()
  })

  it('reports full storage and recovers on the next good save', async () => {
    const put = vi
      .spyOn(IDBObjectStore.prototype, 'put')
      .mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError')
      })
    addTopic()
    await settle()
    expect(useUi.getState().storageError).toBe('full')

    put.mockRestore()
    addTopic()
    await settle()
    expect(useUi.getState().storageError).toBeNull()
  })

  it('moves a map saved by the old version out of localStorage', async () => {
    localStorage.setItem(
      'mindmap',
      JSON.stringify({
        version: 1,
        state: {
          nodes: {
            old: {
              areaId: 'root',
              kind: 'topic',
              position: at(),
              data: { label: 'Old' }
            }
          },
          edges: {},
          viewports: {}
        }
      })
    )
    await useMindMap.persist.rehydrate()
    expect(ids()).toEqual(['old'])
    expect(localStorage.getItem('mindmap')).toBeNull()
    expect((await saved())?.state.nodes).toHaveProperty('old')
  })

  it('loads saved data through the import checks, with a fresh history', async () => {
    addTopic()
    await settle()
    await idbSet('mindmap', {
      version: 1,
      state: {
        nodes: {
          ok: { areaId: 'root', kind: 'topic', position: at(), data: {} },
          bad: { areaId: 'root', kind: 'script', position: at(), data: {} }
        },
        edges: {},
        viewports: {}
      }
    })
    await useMindMap.persist.rehydrate()
    expect(ids()).toEqual(['ok'])
    expect(map().past).toEqual([])
  })

  it('falls back to an empty map when saved data is unreadable', async () => {
    await idbSet('mindmap', { version: 1, state: 'x' })
    await useMindMap.persist.rehydrate()
    expect(ids()).toEqual([])
  })

  it('never saves before the stored map has been read', async () => {
    vi.resetModules()
    const fresh = await import('./storage')
    await idbSet('mindmap', {
      version: 1,
      state: { nodes: { keep: {} }, edges: {}, viewports: {} }
    })

    fresh.persistStorage().setItem('mindmap', {
      version: 1,
      state: { nodes: {}, edges: {}, viewports: {} }
    })
    await vi.advanceTimersByTimeAsync(300)
    await fresh.flushPendingWrites()

    expect((await saved())?.state.nodes).toHaveProperty('keep')
  })
})
