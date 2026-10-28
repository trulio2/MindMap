import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { areaPath } from '@/lib/areas'
import { downloadLibrary, downloadMap, slug } from '@/lib/io'
import { folderPath, folderTree, useLibrary } from '@/store/library.store'
import {
  createMap,
  deleteFolder,
  deleteMaps,
  exportTree,
  readMap,
  startMapId
} from '@/store/maps'
import { useUi } from '@/store/ui.store'
import type { Folder, MapMeta } from '@/types'
import ConfirmDialog, { type ConfirmRequest } from './ConfirmDialog'
import type { ImportResult } from './useMapFiles'
import ContextMenu, { type MenuItem } from './ContextMenu'
import InlineInput from './InlineInput'
import Modal from './Modal'

type Props = {
  open: boolean
  onClose: () => void
  importFile: (
    file: File,
    folderId: string | null,
    options: { open: boolean }
  ) => Promise<ImportResult>
}

type Item = { kind: 'folder'; id: string } | { kind: 'map'; id: string }

const DRAG_TYPE = 'application/x-mindmap-library-item'

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { numeric: true })

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

export default function LibraryDialog({ open, onClose, importFile }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="library-title"
      className="library"
    >
      {open && <LibraryBody onClose={onClose} importFile={importFile} />}
    </Modal>
  )
}

function LibraryBody({ onClose, importFile }: Omit<Props, 'open'>) {
  const navigate = useNavigate()
  const folders = useLibrary((s) => s.folders)
  const maps = useLibrary((s) => s.maps)
  const openMapId = useUi((s) => s.openMapId)
  const library = useLibrary.getState()

  const [folderId, setFolderId] = useState<string | null>(
    () => (openMapId && library.maps[openMapId]?.folderId) || null
  )
  const [renaming, setRenaming] = useState<Item | null>(null)
  const [menu, setMenu] = useState<{
    x: number
    y: number
    items: MenuItem[]
  } | null>(null)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const latestNotice = useUi((s) => s.notice)
  const [noticeAtOpen] = useState(() => useUi.getState().notice)
  const notice = latestNotice === noticeAtOpen ? null : latestNotice
  const scrollToHighlight = useCallback(
    (el: HTMLLIElement | null) => el?.scrollIntoView({ block: 'nearest' }),
    []
  )
  const fileInput = useRef<HTMLInputElement>(null)

  const current = folderId && folders[folderId] ? folderId : null
  const trail = folderPath(folders, current)

  const subfolders = useMemo(
    () =>
      Object.values(folders)
        .filter((f) => f.parentId === current)
        .sort(byName),
    [folders, current]
  )
  const folderMaps = useMemo(
    () =>
      Object.values(maps)
        .filter((m) => m.folderId === current)
        .sort(byName),
    [maps, current]
  )

  function openMapAndClose(id: string) {
    navigate(areaPath(id))
    onClose()
  }

  function contentsOf(id: string) {
    const tree = folderTree(folders, id)
    return {
      folders: tree.size - 1,
      maps: Object.values(maps).filter(
        (m) => m.folderId && tree.has(m.folderId)
      ).length
    }
  }

  async function leaveIfOpenMapIsGone() {
    const open = useUi.getState().openMapId
    if (open && !useLibrary.getState().maps[open]) {
      navigate(areaPath(await startMapId()), { replace: true })
    }
  }

  async function newMap() {
    const id = await createMap('Untitled map', current)
    setHighlight(id)
    setRenaming({ kind: 'map', id })
  }

  function newFolder() {
    const id = library.addFolder('New folder', current)
    setRenaming({ kind: 'folder', id })
  }

  function finishRename(item: Item, name: string | null) {
    setRenaming(null)
    if (name) {
      if (item.kind === 'map') library.renameMap(item.id, name)
      else library.renameFolder(item.id, name)
    }
  }

  function moveItem(item: Item, to: string | null) {
    if (item.kind === 'map') library.moveMap(item.id, to)
    else library.moveFolder(item.id, to)
  }

  function destinations(item: Item): MenuItem[] {
    const blocked =
      item.kind === 'folder' ? folderTree(folders, item.id) : new Set<string>()
    const here =
      item.kind === 'map' ? maps[item.id]?.folderId : folders[item.id]?.parentId
    const options: MenuItem[] = []
    if (here !== null) {
      options.push({
        label: 'Library (top level)',
        onSelect: () => moveItem(item, null)
      })
    }
    for (const f of Object.values(folders)) {
      if (blocked.has(f.id) || f.id === here) continue
      const label = folderPath(folders, f.id)
        .map((p) => p.name)
        .join(' / ')
      options.push({ label, onSelect: () => moveItem(item, f.id) })
    }
    return options.sort((a, b) =>
      a === 'separator' || b === 'separator'
        ? 0
        : a.label.localeCompare(b.label)
    )
  }

  function showMenu(event: React.MouseEvent, items: MenuItem[]) {
    setMenu({ ...menuAnchor(event), items })
  }

  async function exportFolder(folder: Folder | null) {
    const tree = await exportTree(folder?.id ?? null)
    const date = new Date().toISOString().slice(0, 10)
    downloadLibrary(
      folder
        ? `${slug(folder.name)}-folder.json`
        : `mindmap-library-${date}.json`,
      tree
    )
  }

  function mapMenu(event: React.MouseEvent, map: MapMeta) {
    const item: Item = { kind: 'map', id: map.id }
    const moves = destinations(item)
    const anchor = menuAnchor(event)
    showMenu(event, [
      { label: 'Open', onSelect: () => openMapAndClose(map.id) },
      { label: 'Rename', onSelect: () => setRenaming(item) },
      ...(moves.length
        ? [
            {
              label: 'Move to…',
              onSelect: () => setMenu({ ...anchor, items: moves })
            }
          ]
        : []),
      {
        label: 'Export',
        onSelect: async () => downloadMap(map.name, await readMap(map.id))
      },
      'separator',
      {
        label: 'Delete',
        danger: true,
        onSelect: () =>
          setConfirm({
            title: `Delete "${map.name}"?`,
            message:
              "The map and everything in it will be deleted. This can't be undone, so export it first if you might need it.",
            confirmLabel: 'Delete map',
            onConfirm: async () => {
              await deleteMaps([map.id])
              await leaveIfOpenMapIsGone()
            }
          })
      }
    ])
  }

  function folderMenu(event: React.MouseEvent, folder: Folder) {
    const item: Item = { kind: 'folder', id: folder.id }
    const moves = destinations(item)
    const anchor = menuAnchor(event)
    showMenu(event, [
      { label: 'Open', onSelect: () => setFolderId(folder.id) },
      { label: 'Rename', onSelect: () => setRenaming(item) },
      ...(moves.length
        ? [
            {
              label: 'Move to…',
              onSelect: () => setMenu({ ...anchor, items: moves })
            }
          ]
        : []),
      { label: 'Export', onSelect: () => void exportFolder(folder) },
      'separator',
      {
        label: 'Delete',
        danger: true,
        onSelect: () => {
          const inside = contentsOf(folder.id)
          const what = [
            inside.maps && plural(inside.maps, 'map', 'maps'),
            inside.folders && plural(inside.folders, 'folder', 'folders')
          ]
            .filter(Boolean)
            .join(' and ')
          setConfirm({
            title: `Delete folder "${folder.name}"?`,
            message: what
              ? `The folder and the ${what} inside it will be deleted. This can't be undone, so export it first if you might need it.`
              : 'The folder is empty.',
            confirmLabel: 'Delete folder',
            onConfirm: async () => {
              await deleteFolder(folder.id)
              await leaveIfOpenMapIsGone()
            }
          })
        }
      }
    ])
  }

  const dragProps = (item: Item) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(item))
      e.dataTransfer.effectAllowed = 'move'
    }
  })

  const dropProps = (target: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDropTarget(target ?? 'top')
    },
    onDragLeave: () => setDropTarget(null),
    onDrop: (e: React.DragEvent) => {
      setDropTarget(null)
      const raw = e.dataTransfer.getData(DRAG_TYPE)
      if (!raw) return
      e.preventDefault()
      const item = JSON.parse(raw) as Item
      if (item.kind === 'folder' && item.id === target) return
      moveItem(item, target)
    }
  })

  const empty = !subfolders.length && !folderMaps.length

  return (
    <>
      <div className="library-head">
        <h2 id="library-title">Maps</h2>
        <button
          type="button"
          className="banner-close"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <nav className="library-trail" aria-label="Folder">
        <button
          type="button"
          className={`crumb${dropTarget === 'top' ? ' drop' : ''}`}
          onClick={() => setFolderId(null)}
          {...dropProps(null)}
        >
          Library
        </button>
        {trail.map((f) => (
          <span key={f.id}>
            <span className="crumb-sep">›</span>
            <button
              type="button"
              className={`crumb${dropTarget === f.id ? ' drop' : ''}`}
              aria-current={f.id === current ? 'page' : undefined}
              onClick={() => setFolderId(f.id)}
              {...dropProps(f.id)}
            >
              {f.name}
            </button>
          </span>
        ))}
      </nav>

      <div className="library-actions">
        <button type="button" className="btn" onClick={() => void newMap()}>
          + New map
        </button>
        <button type="button" className="btn" onClick={newFolder}>
          + New folder
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => fileInput.current?.click()}
          title="Import a map or library file as new maps"
        >
          Import…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file)
              void importFile(file, current, { open: false }).then((result) => {
                if (result?.kind === 'map') setHighlight(result.id)
              })
          }}
        />
        <button
          type="button"
          className="btn"
          onClick={(e) =>
            showMenu(e, [
              ...(current
                ? [
                    {
                      label: `Export "${folders[current].name}"`,
                      onSelect: () => void exportFolder(folders[current])
                    }
                  ]
                : []),
              {
                label: 'Export everything',
                onSelect: () => void exportFolder(null)
              }
            ])
          }
        >
          Export ▾
        </button>
      </div>

      <ul className="library-list">
        {subfolders.map((f) => {
          const inside = contentsOf(f.id)
          const item: Item = { kind: 'folder', id: f.id }
          return (
            <li
              key={f.id}
              className={`library-row${dropTarget === f.id ? ' drop' : ''}`}
              {...dragProps(item)}
              {...dropProps(f.id)}
            >
              <span className="library-icon" aria-hidden="true">
                📁
              </span>
              {renaming?.kind === 'folder' && renaming.id === f.id ? (
                <InlineInput
                  initial={f.name}
                  className="library-rename"
                  onDone={(name) => finishRename(item, name)}
                />
              ) : (
                <button
                  type="button"
                  className="library-name"
                  onClick={() => setFolderId(f.id)}
                >
                  {f.name}
                </button>
              )}
              <span className="library-meta">
                {inside.maps || inside.folders
                  ? [
                      inside.maps && plural(inside.maps, 'map', 'maps'),
                      inside.folders &&
                        plural(inside.folders, 'folder', 'folders')
                    ]
                      .filter(Boolean)
                      .join(', ')
                  : 'Empty'}
              </span>
              <button
                type="button"
                className="library-more"
                aria-label={`Actions for folder ${f.name}`}
                onClick={(e) => folderMenu(e, f)}
              >
                ⋯
              </button>
            </li>
          )
        })}
        {folderMaps.map((m) => {
          const item: Item = { kind: 'map', id: m.id }
          const isOpen = m.id === openMapId
          return (
            <li
              key={m.id}
              className={`library-row${m.id === highlight ? ' just-added' : ''}`}
              ref={m.id === highlight ? scrollToHighlight : undefined}
              {...dragProps(item)}
            >
              <span className="library-icon" aria-hidden="true">
                🗺
              </span>
              {renaming?.kind === 'map' && renaming.id === m.id ? (
                <InlineInput
                  initial={m.name}
                  className="library-rename"
                  onDone={(name) => finishRename(item, name)}
                />
              ) : (
                <button
                  type="button"
                  className="library-name"
                  onClick={() => openMapAndClose(m.id)}
                >
                  {m.name}
                </button>
              )}
              <span className="library-meta">{isOpen ? 'Open now' : ''}</span>
              <button
                type="button"
                className="library-more"
                aria-label={`Actions for map ${m.name}`}
                onClick={(e) => mapMenu(e, m)}
              >
                ⋯
              </button>
            </li>
          )
        })}
      </ul>
      {empty && (
        <p className="library-empty">
          This folder is empty. Create a map or folder, or drag one here.
        </p>
      )}
      {notice && (
        <p
          className={`library-notice notice-${notice.kind}`}
          role={notice.kind === 'error' ? 'alert' : 'status'}
        >
          {notice.text}
        </p>
      )}

      {menu && <ContextMenu {...menu} onClose={() => setMenu(null)} />}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  )
}

function menuAnchor(event: React.MouseEvent) {
  const r = (event.currentTarget as HTMLElement).getBoundingClientRect()
  return { x: r.left, y: r.bottom + 4 }
}
