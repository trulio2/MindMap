import { useSyncExternalStore } from 'react'
import { isRecord, parseDoc, emptyDoc } from '@/lib/io'
import { DOC_VERSION, type LibraryTree, type MindMapDoc } from '@/types'
import { folderTree, LIBRARY_KEY, mapKey, useLibrary } from './library.store'
import { useMindMap } from './mindmap.store'
import {
  deleteSaved,
  flushPendingWrites,
  forgetLoaded,
  onSavedElsewhere,
  readSaved,
  writeSaved
} from './storage'
import { useUi } from './ui.store'

const LEGACY_MAP_KEY = 'mindmap'

let libraryLoaded = false
const loadListeners = new Set<() => void>()

export function useLibraryLoaded() {
  return useSyncExternalStore(
    (listener) => {
      loadListeners.add(listener)
      return () => loadListeners.delete(listener)
    },
    () => libraryLoaded
  )
}

function readDocSafely(value: unknown): MindMapDoc {
  try {
    return parseDoc(isRecord(value) ? value.state : null).doc
  } catch {
    return emptyDoc()
  }
}

const saveDoc = (id: string, doc: MindMapDoc) =>
  writeSaved(mapKey(id), { state: doc, version: DOC_VERSION })

export async function bootLibrary() {
  await useLibrary.persist.rehydrate()
  if (!Object.keys(useLibrary.getState().maps).length) {
    const legacy = await readSaved(LEGACY_MAP_KEY)
    const id = useLibrary.getState().addMap('My map', null)
    if (legacy) {
      await writeSaved(mapKey(id), legacy)
      await deleteSaved(LEGACY_MAP_KEY)
    }
  }
  libraryLoaded = true
  loadListeners.forEach((listener) => listener())
}

let opening: Promise<void> = Promise.resolve()

export function openMap(id: string) {
  opening = opening.then(async () => {
    if (useUi.getState().openMapId === id) return
    await flushPendingWrites()
    forgetLoaded(mapKey(id))
    useMindMap.persist.setOptions({ name: mapKey(id) })
    await useMindMap.persist.rehydrate()
    useUi.getState().setOpenMap(id)
    useUi.getState().docReplaced()
    useLibrary.getState().setLastOpened(id)
  })
  return opening
}

export async function startMapId() {
  const { maps, lastOpenedId } = useLibrary.getState()
  if (lastOpenedId && maps[lastOpenedId]) return lastOpenedId
  const first = Object.values(maps).sort((a, b) =>
    a.name.localeCompare(b.name)
  )[0]
  return first?.id ?? (await createMap('My map', null))
}

export async function createMap(
  name: string,
  folderId: string | null,
  doc?: MindMapDoc
) {
  const id = useLibrary.getState().addMap(name, folderId)
  if (doc) await saveDoc(id, doc)
  return id
}

export async function readMap(id: string): Promise<MindMapDoc> {
  if (useUi.getState().openMapId === id) {
    const { nodes, edges, viewports } = useMindMap.getState()
    return { nodes, edges, viewports }
  }
  return readDocSafely(await readSaved(mapKey(id)))
}

export async function deleteMaps(ids: string[]) {
  useLibrary.getState().removeMaps(ids)
  await Promise.all(ids.map((id) => deleteSaved(mapKey(id))))
}

export async function deleteFolder(id: string) {
  const { folders, maps } = useLibrary.getState()
  const tree = folderTree(folders, id)
  const mapIds = Object.values(maps)
    .filter((m) => m.folderId && tree.has(m.folderId))
    .map((m) => m.id)
  await deleteMaps(mapIds)
  useLibrary.getState().removeFolders([...tree])
  return mapIds
}

export async function exportTree(
  folderId: string | null
): Promise<LibraryTree> {
  const { folders, maps } = useLibrary.getState()
  const tree = folderId ? folderTree(folders, folderId) : null
  const inTree = (id: string | null) => (tree ? !!id && tree.has(id) : true)

  const exported: LibraryTree = { folders: [], maps: [] }
  for (const f of Object.values(folders)) {
    if (!inTree(f.id)) continue
    exported.folders.push({
      ...f,
      parentId: f.id === folderId ? null : f.parentId
    })
  }
  for (const m of Object.values(maps)) {
    if (!inTree(m.folderId)) continue
    exported.maps.push({
      id: m.id,
      name: m.name,
      folderId: tree && m.folderId === null ? null : m.folderId,
      doc: await readMap(m.id)
    })
  }
  return exported
}

export async function importTree(
  tree: LibraryTree,
  intoFolderId: string | null
) {
  const library = useLibrary.getState()
  const newFolderId = new Map<string, string>()
  for (const f of tree.folders) {
    const parent = f.parentId ? newFolderId.get(f.parentId)! : intoFolderId
    newFolderId.set(f.id, library.addFolder(f.name, parent))
  }
  for (const m of tree.maps) {
    const folder = m.folderId ? newFolderId.get(m.folderId)! : intoFolderId
    await createMap(m.name, folder, m.doc)
  }
  return { folders: tree.folders.length, maps: tree.maps.length }
}

onSavedElsewhere((name) => {
  if (name === LIBRARY_KEY) void useLibrary.persist.rehydrate()
  const open = useUi.getState().openMapId
  if (open && name === mapKey(open)) void useMindMap.persist.rehydrate()
})
