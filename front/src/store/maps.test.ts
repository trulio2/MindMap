import { beforeEach, describe, expect, it } from 'vitest'
import { DOC_VERSION, type MindMapDoc } from '@/types'
import { idbDelete, idbGet, idbSet } from './idb'
import { folderPath, folderTree, mapKey, useLibrary } from './library.store'
import {
  bootLibrary,
  createMap,
  deleteFolder,
  exportTree,
  importTree,
  openMap,
  readMap,
  startMapId
} from './maps'
import { useMindMap } from './mindmap.store'
import { flushPendingWrites } from './storage'
import { useUi } from './ui.store'

const doc = (...labels: string[]): MindMapDoc => ({
  nodes: Object.fromEntries(
    labels.map((label, i) => [
      `n${i}`,
      {
        id: `n${i}`,
        areaId: 'root',
        kind: 'topic' as const,
        position: { x: i, y: 0 },
        data: { label }
      }
    ])
  ),
  edges: {},
  viewports: {}
})

const labels = () =>
  Object.values(useMindMap.getState().nodes).map((n) => n.data.label)

const saved = async (id: string) =>
  (await idbGet<{ state: MindMapDoc }>(mapKey(id)))?.state

beforeEach(async () => {
  await flushPendingWrites()
  useLibrary.setState({ folders: {}, maps: {}, lastOpenedId: null })
  await flushPendingWrites()
  await idbDelete('library')
  await idbDelete('mindmap')
  localStorage.clear()
  useUi.setState({ openMapId: null })
})

describe('folders', () => {
  it('finds a folder with everything inside it', () => {
    const lib = useLibrary.getState()
    const a = lib.addFolder('A', null)
    const b = lib.addFolder('B', a)
    const c = lib.addFolder('C', b)
    const other = lib.addFolder('Other', null)
    const { folders } = useLibrary.getState()
    expect([...folderTree(folders, a)].sort()).toEqual([a, b, c].sort())
    expect(folderTree(folders, other)).toEqual(new Set([other]))
    expect(folderPath(folders, c).map((f) => f.name)).toEqual(['A', 'B', 'C'])
    expect(folderPath(folders, null)).toEqual([])
  })

  it('refuses to move a folder into itself or its subfolders', () => {
    const lib = useLibrary.getState()
    const a = lib.addFolder('A', null)
    const b = lib.addFolder('B', a)
    expect(lib.moveFolder(a, b)).toBe(false)
    expect(lib.moveFolder(a, a)).toBe(false)
    expect(lib.moveFolder(b, null)).toBe(true)
    expect(useLibrary.getState().folders[b].parentId).toBeNull()
  })

  it('repairs saved folders and maps that point at missing folders', async () => {
    await idbSet('library', {
      version: 1,
      state: {
        folders: { f: { name: 'F', parentId: 'gone' } },
        maps: { m: { name: '', folderId: 'gone', createdAt: 1 } },
        lastOpenedId: 'm'
      }
    })
    await useLibrary.persist.rehydrate()
    const { folders, maps, lastOpenedId } = useLibrary.getState()
    expect(folders.f).toEqual({ id: 'f', name: 'F', parentId: null })
    expect(maps.m).toMatchObject({ name: 'Untitled map', folderId: null })
    expect(lastOpenedId).toBe('m')
  })
})

describe('startup', () => {
  it('turns the map saved by earlier versions into "My map"', async () => {
    await idbSet('mindmap', { version: 1, state: doc('Old idea') })
    await bootLibrary()
    const [map] = Object.values(useLibrary.getState().maps)
    expect(map.name).toBe('My map')
    expect((await saved(map.id))?.nodes.n0.data.label).toBe('Old idea')
    expect(await idbGet('mindmap')).toBeUndefined()
  })

  it('also picks up a map still in localStorage from older versions', async () => {
    localStorage.setItem(
      'mindmap',
      JSON.stringify({ version: 1, state: doc('Very old') })
    )
    await bootLibrary()
    const [map] = Object.values(useLibrary.getState().maps)
    expect((await saved(map.id))?.nodes.n0.data.label).toBe('Very old')
    expect(localStorage.getItem('mindmap')).toBeNull()
  })

  it('starts with one empty map when there is nothing to migrate', async () => {
    await bootLibrary()
    expect(
      Object.values(useLibrary.getState().maps).map((m) => m.name)
    ).toEqual(['My map'])
  })

  it('opens the last map, else the first by name, else a new one', async () => {
    expect(await startMapId()).toBe(Object.keys(useLibrary.getState().maps)[0])
    useLibrary.setState({ maps: {} })
    const b = await createMap('Beta', null)
    const a = await createMap('alpha', null)
    expect(await startMapId()).toBe(a)
    useLibrary.getState().setLastOpened(b)
    expect(await startMapId()).toBe(b)
  })
})

describe('switching maps', () => {
  it('saves the open map and loads the next one, without mixing them', async () => {
    const a = await createMap('A', null, doc('From A'))
    const b = await createMap('B', null, doc('From B'))

    await openMap(a)
    expect(labels()).toEqual(['From A'])
    expect(useUi.getState().openMapId).toBe(a)
    useMindMap.getState().addNode('root', {
      kind: 'topic',
      position: { x: 0, y: 0 },
      data: { label: 'Edited in A' }
    })

    await openMap(b)
    expect(labels()).toEqual(['From B'])
    expect(useMindMap.getState().past).toEqual([])
    expect(useLibrary.getState().lastOpenedId).toBe(b)

    await flushPendingWrites()
    expect(
      Object.values((await saved(a))!.nodes).map((n) => n.data.label)
    ).toEqual(['From A', 'Edited in A'])
    expect(Object.keys((await saved(b))!.nodes)).toEqual(['n0'])
  })

  it('keeps a map intact when it is opened again later', async () => {
    const a = await createMap('A', null, doc('Keep me'))
    const b = await createMap('B', null, doc('Other'))
    await openMap(a)
    await openMap(b)
    await openMap(a)
    expect(labels()).toEqual(['Keep me'])
    await openMap(b)
    await flushPendingWrites()
    expect((await saved(a))?.nodes.n0.data.label).toBe('Keep me')
    expect((await saved(b))?.nodes.n0.data.label).toBe('Other')
  })

  it('never saves the previous map over the one being opened', async () => {
    const a = await createMap('A', null, doc('Keep me'))
    const b = await createMap('B', null, doc('Other'))
    await openMap(a)
    await openMap(b)
    const stop = useMindMap.persist.onHydrate(() => {
      stop()
      useMindMap.getState().updateNodeData('n0', { label: 'Mid-switch edit' })
    })
    await openMap(a)
    expect(labels()).toEqual(['Keep me'])
    await flushPendingWrites()
    expect((await saved(a))?.nodes.n0.data.label).toBe('Keep me')
  })

  it('opens a new empty map as empty', async () => {
    await openMap(await createMap('Filled', null, doc('x')))
    await openMap(await createMap('Empty', null))
    expect(labels()).toEqual([])
  })

  it('queues quick switches so the last one wins', async () => {
    const a = await createMap('A', null, doc('A'))
    const b = await createMap('B', null, doc('B'))
    await Promise.all([openMap(a), openMap(b), openMap(a), openMap(b)])
    expect(useUi.getState().openMapId).toBe(b)
    expect(labels()).toEqual(['B'])
  })

  it('reads the open map live and closed maps from storage', async () => {
    const a = await createMap('A', null, doc('Saved'))
    const b = await createMap('B', null, doc('Other'))
    await openMap(a)
    useMindMap.getState().updateNodeData('n0', { label: 'Unsaved edit' })
    expect((await readMap(a)).nodes.n0.data.label).toBe('Unsaved edit')
    expect((await readMap(b)).nodes.n0.data.label).toBe('Other')
  })

  it('reloads the open map when another tab saves it', async () => {
    const a = await createMap('A', null, doc('Before'))
    await openMap(a)
    await idbSet(mapKey(a), {
      version: DOC_VERSION,
      state: doc('From other tab')
    })
    const reloaded = new Promise<void>((resolve) => {
      const stop = useMindMap.persist.onFinishHydration(() => {
        stop()
        resolve()
      })
    })
    const other = new BroadcastChannel('mindmap')
    other.postMessage(mapKey(a))
    await reloaded
    expect(labels()).toEqual(['From other tab'])
    other.close()
  })
})

describe('folders with maps', () => {
  async function sampleTree() {
    const lib = useLibrary.getState()
    const work = lib.addFolder('Work', null)
    const plans = lib.addFolder('Plans', work)
    const top = await createMap('Top', null, doc('top'))
    const inWork = await createMap('In work', work, doc('work'))
    const inPlans = await createMap('In plans', plans, doc('plans'))
    return { work, plans, top, inWork, inPlans }
  }

  it('deletes a folder with its subfolders and maps', async () => {
    const { work, top, inWork, inPlans } = await sampleTree()
    const deleted = await deleteFolder(work)
    expect(deleted.sort()).toEqual([inWork, inPlans].sort())
    const { folders, maps } = useLibrary.getState()
    expect(folders).toEqual({})
    expect(Object.keys(maps)).toEqual([top])
    expect(await idbGet(mapKey(inPlans))).toBeUndefined()
    expect(await saved(top)).toBeDefined()
  })

  it('exports a folder as its own tree', async () => {
    const { work, plans } = await sampleTree()
    const tree = await exportTree(work)
    expect(tree.folders.map((f) => [f.name, f.parentId])).toEqual([
      ['Work', null],
      ['Plans', work]
    ])
    expect(tree.maps.map((m) => [m.name, m.folderId]).sort()).toEqual([
      ['In plans', plans],
      ['In work', work]
    ])
    expect(
      tree.maps.find((m) => m.name === 'In work')?.doc.nodes.n0.data.label
    ).toBe('work')
  })

  it('exports everything and imports it as copies with new ids', async () => {
    await sampleTree()
    const everything = await exportTree(null)
    expect(everything.folders).toHaveLength(2)
    expect(everything.maps).toHaveLength(3)

    const target = useLibrary.getState().addFolder('Imported', null)
    const counts = await importTree(everything, target)
    expect(counts).toEqual({ folders: 2, maps: 3 })

    const { folders, maps } = useLibrary.getState()
    const work = Object.values(folders).find(
      (f) => f.name === 'Work' && f.parentId === target
    )!
    const plans = Object.values(folders).find((f) => f.parentId === work.id)!
    expect(plans.name).toBe('Plans')
    const copy = Object.values(maps).find(
      (m) => m.name === 'In plans' && m.folderId === plans.id
    )!
    expect((await saved(copy.id))?.nodes.n0.data.label).toBe('plans')
    expect(Object.keys(maps)).toHaveLength(6)
  })
})
