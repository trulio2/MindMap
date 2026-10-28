import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  ConnectionMode,
  Controls,
  getNodesBounds,
  getViewportForBounds,
  MiniMap,
  Panel,
  ReactFlow,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type EdgeMouseHandler,
  type NodeChange,
  type OnConnectEnd,
  type ReactFlowInstance
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { isTyping } from '@/lib/dom'
import { fitSize, loadImageFile } from '@/lib/image'
import { useNavigate } from 'react-router-dom'
import { areaPath } from '@/lib/areas'
import { parseClip } from '@/lib/io'
import { normalizeUrl } from '@/lib/url'
import { parseYouTube, watchUrl } from '@/lib/video'
import { useShallow } from 'zustand/react/shallow'
import { useMindMap } from '@/store/mindmap.store'
import { useUi, type StorageError } from '@/store/ui.store'
import type { MapNode, NodeKind, XY } from '@/types'
import Breadcrumbs from './Breadcrumbs'
import NoticeBar from './NoticeBar'
import HelpDialog from './HelpDialog'
import { useMapFiles } from './useMapFiles'
import { FIT_VIEW_OPTIONS, useShortcuts } from './useShortcuts'
import LabeledEdge from './edges/LabeledEdge'
import ImageNode from './nodes/ImageNode'
import LinkNode from './nodes/LinkNode'
import TextNode from './nodes/TextNode'
import TopicNode from './nodes/TopicNode'
import VideoNode from './nodes/VideoNode'
import StickyNode from './nodes/StickyNode'
import ContextMenu, { type MenuItem } from './ContextMenu'
import { selectedInArea, useClipboard } from './useClipboard'
import {
  areaEdges,
  areaNodes,
  childCounts,
  toFlowEdge,
  toFlowNode
} from './flowElements'
import type { FlowEdge, FlowNode } from './types'

const nodeTypes = {
  topic: TopicNode,
  text: TextNode,
  image: ImageNode,
  link: LinkNode,
  video: VideoNode,
  sticky: StickyNode
}

const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
const modKey = isMac ? '⌘' : 'Ctrl+'
const altKey = isMac ? '⌥' : 'Alt+'
const edgeTypes = { labeled: LabeledEdge }

const ADD_ITEMS: { kind: NodeKind; label: string; short?: string }[] = [
  { kind: 'topic', label: 'Topic' },
  { kind: 'text', label: 'Text' },
  { kind: 'sticky', label: 'Sticky note', short: 'Sticky' },
  { kind: 'link', label: 'Link' },
  { kind: 'image', label: 'Image' },
  { kind: 'video', label: 'Video' }
]

const ADD_DRAG_TYPE = 'application/x-mindmap-kind'
const deleteKeys = ['Backspace', 'Delete']

const storageMessages: Record<StorageError, string> = {
  full: 'Browser storage is full, so recent changes are not saved. Remove some images or export your map.',
  unavailable:
    'This browser is blocking storage, so changes are not saved. Export your map to keep it.'
}

function isJsonFile(file: File) {
  return file.type === 'application/json' || file.name.endsWith('.json')
}

function imageFiles(files: FileList | undefined | null) {
  return [...(files ?? [])].filter((f) => f.type.startsWith('image/'))
}

type ConnectFrom = { source: string; sourceHandle: string | null }

type Props = { areaId: string }

export default function MindMapCanvas({ areaId }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const lastPointer = useRef<XY | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mapFileInputRef = useRef<HTMLInputElement>(null)
  const { exportMap, importFile, newMap, dialog: fileDialog } = useMapFiles()
  const { screenToFlowPosition } = useReactFlow()
  const [helpOpen, setHelpOpen] = useState(false)
  const toggleHelp = useCallback(() => setHelpOpen((open) => !open), [])
  useShortcuts(areaId, toggleHelp)
  const { copyToClipboard, paste } = useClipboard(areaId)
  const navigate = useNavigate()
  const [menu, setMenu] = useState<{
    x: number
    y: number
    items: MenuItem[]
  } | null>(null)

  const docNodes = useMindMap(
    useShallow(useMemo(() => areaNodes(areaId), [areaId]))
  )
  const docEdges = useMindMap(
    useShallow(useMemo(() => areaEdges(areaId), [areaId]))
  )
  const counts = useMindMap(useShallow(childCounts))
  const canUndo = useMindMap((s) => s.past.length > 0)
  const canRedo = useMindMap((s) => s.future.length > 0)
  const {
    addNode,
    patchNodes,
    deleteNodes,
    addEdge,
    deleteEdges,
    saveViewport,
    checkpoint,
    group,
    undo,
    redo
  } = useMindMap.getState()

  const selectedNodes = useUi((s) => s.selectedNodes)
  const selectedEdges = useUi((s) => s.selectedEdges)
  const storageError = useUi((s) => s.storageError)
  const { selectNodes, selectEdges, setEditing, resetInteraction } =
    useUi.getState()

  useEffect(() => useUi.getState().resetInteraction(), [])

  const restoreViewport = useCallback(
    (flow: ReactFlowInstance<FlowNode, FlowEdge>) => {
      const { nodes, viewports } = useMindMap.getState()
      const saved = viewports[areaId]
      if (saved) return void flow.setViewport(saved)

      const areaNodes = Object.values(nodes).filter((n) => n.areaId === areaId)
      const rect = wrapperRef.current?.getBoundingClientRect()
      if (!areaNodes.length || !rect) return
      const bounds = getNodesBounds(areaNodes)
      void flow.setViewport(
        getViewportForBounds(bounds, rect.width, rect.height, 0.1, 1.25, 0.1)
      )
    },
    [areaId]
  )

  const nodes = useMemo<FlowNode[]>(() => {
    return docNodes.map((n) =>
      toFlowNode(n, !!selectedNodes[n.id], counts[n.id] ?? 0)
    )
  }, [docNodes, counts, selectedNodes])

  const edges = useMemo<FlowEdge[]>(
    () => docEdges.map((e) => toFlowEdge(e, !!selectedEdges[e.id])),
    [docEdges, selectedEdges]
  )

  const onNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      const patches: Parameters<typeof patchNodes>[0] = {}
      const patch = (id: string, value: (typeof patches)[string]) =>
        (patches[id] = { ...patches[id], ...value })
      const selection: Record<string, boolean> = {}
      const removed: string[] = []

      for (const change of changes) {
        switch (change.type) {
          case 'position':
            if (change.position) patch(change.id, { position: change.position })
            break
          case 'dimensions':
            if (!change.dimensions) break
            patch(change.id, { measured: change.dimensions })
            if (change.setAttributes) {
              const { width, height } = change.dimensions
              const kind = useMindMap.getState().nodes[change.id]?.kind
              patch(change.id, {
                size: kind === 'text' ? { width } : { width, height }
              })
            }
            break
          case 'select':
            selection[change.id] = change.selected
            break
          case 'remove':
            removed.push(change.id)
            break
        }
      }

      if (Object.keys(patches).length) patchNodes(patches)
      if (Object.keys(selection).length) selectNodes(selection)
      if (removed.length) {
        deleteNodes(removed)
        selectNodes(Object.fromEntries(removed.map((id) => [id, false])))
      }
    },
    [patchNodes, selectNodes, deleteNodes]
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange<FlowEdge>[]) => {
      const selection: Record<string, boolean> = {}
      const removed: string[] = []
      for (const change of changes) {
        if (change.type === 'select') selection[change.id] = change.selected
        if (change.type === 'remove') removed.push(change.id)
      }
      if (Object.keys(selection).length) selectEdges(selection)
      if (removed.length) {
        deleteEdges(removed)
        selectEdges(Object.fromEntries(removed.map((id) => [id, false])))
      }
    },
    [selectEdges, deleteEdges]
  )

  const onConnect = useCallback(
    (connection: Connection) => addEdge(areaId, connection),
    [addEdge, areaId]
  )

  const onEdgeDoubleClick = useCallback<EdgeMouseHandler<FlowEdge>>(
    (_, edge) => setEditing(edge.id),
    [setEditing]
  )

  const createNode = useCallback(
    (kind: NodeKind, position: XY, extra?: Pick<MapNode, 'data' | 'size'>) => {
      const id = addNode(areaId, { kind, position, ...extra })
      if (kind === 'image' || extra?.data) return id
      setEditing(id)
      return id
    },
    [addNode, areaId, setEditing]
  )

  const insertPoint = useCallback((): XY => {
    const rect = wrapperRef.current!.getBoundingClientRect()
    const screen = lastPointer.current ?? {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    }
    return screenToFlowPosition(screen)
  }, [screenToFlowPosition])

  const addImages = useCallback(
    async (files: File[], at: XY, connectFrom?: ConnectFrom) => {
      for (const [i, file] of files.entries()) {
        try {
          const image = await loadImageFile(file)
          const size = fitSize(image.size)
          group(() => {
            const id = createNode(
              'image',
              {
                x: at.x - size.width / 2 + i * 24,
                y: at.y - size.height / 2 + i * 24
              },
              { data: { src: image.src, label: image.name }, size }
            )
            if (connectFrom && i === 0) {
              addEdge(areaId, {
                ...connectFrom,
                target: id,
                targetHandle: null
              })
            }
          })
        } catch (error) {
          console.warn(`Could not read image ${file.name}`, error)
        }
      }
    },
    [addEdge, areaId, createNode, group]
  )

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (isTyping(event.target) || !event.clipboardData) return
      if (document.querySelector('dialog[open]')) return
      const images = imageFiles(event.clipboardData.files)
      const text = event.clipboardData.getData('text/plain').trim()
      if (!images.length && !text) return
      event.preventDefault()

      const at = insertPoint()
      const clip = parseClip(text)
      if (clip) return paste(clip, at)
      if (images.length) return void addImages(images, at)
      const singleWord = !/\s/.test(text)
      const video = singleWord ? parseYouTube(text) : null
      const url = singleWord ? normalizeUrl(text) : null
      if (video) createNode('video', at, { data: { url: watchUrl(video) } })
      else if (url) createNode('link', at, { data: { url } })
      else createNode('text', at, { data: { text } })
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [addImages, createNode, insertPoint, paste])

  const imageTarget = useRef<{ at: XY; connectFrom?: ConnectFrom } | null>(null)

  function pickImagesAt(at: XY | null, connectFrom?: ConnectFrom) {
    imageTarget.current = at && { at, connectFrom }
    fileInputRef.current?.click()
  }

  const closeMenu = useCallback(() => setMenu(null), [])

  const openAddMenu = useCallback(
    (screen: XY, connectFrom?: ConnectFrom) => {
      const at = screenToFlowPosition(screen)
      const clipboard = useUi.getState().clipboard
      const add = (label: string, kind: NodeKind): MenuItem => ({
        label,
        onSelect: () => {
          if (kind === 'image') return pickImagesAt(at, connectFrom)
          group(() => {
            const id = createNode(kind, at)
            if (connectFrom) {
              addEdge(areaId, {
                ...connectFrom,
                target: id,
                targetHandle: null
              })
            }
          })
        }
      })
      const items: MenuItem[] = ADD_ITEMS.map(({ kind, label }) =>
        add(kind === 'image' ? `${label}…` : label, kind)
      )
      if (clipboard && !connectFrom) {
        items.push('separator', {
          label: 'Paste',
          hint: `${modKey}V`,
          onSelect: () => paste(clipboard, at)
        })
      }
      setMenu({ ...screen, items })
    },
    [addEdge, areaId, createNode, group, paste, screenToFlowPosition]
  )

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault()
      openAddMenu({ x: event.clientX, y: event.clientY })
    },
    [openAddMenu]
  )

  const onConnectEnd = useCallback<OnConnectEnd>(
    (event, state) => {
      if (state.isValid || !state.fromNode || !state.fromHandle) return
      const { clientX, clientY } =
        'changedTouches' in event ? event.changedTouches[0] : event
      const from: ConnectFrom = {
        source: state.fromNode.id,
        sourceHandle: state.fromHandle.id ?? null
      }

      const target = event.target as Element | null
      const targetId = target
        ?.closest('.react-flow__node')
        ?.getAttribute('data-id')
      if (targetId) {
        addEdge(areaId, { ...from, target: targetId, targetHandle: null })
      } else if (target?.closest('.react-flow__pane')) {
        openAddMenu({ x: clientX, y: clientY }, from)
      }
    },
    [addEdge, areaId, openAddMenu]
  )

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: FlowNode) => {
      event.preventDefault()
      const ui = useUi.getState()
      const selection = selectedInArea(areaId)
      const ids = selection.includes(node.id) ? selection : [node.id]
      if (!selection.includes(node.id)) {
        ui.resetInteraction()
        ui.selectNodes({ [node.id]: true })
      }
      const several = ids.length > 1
      const items: MenuItem[] = [
        {
          label: 'Open',
          hint: `${altKey}↓`,
          onSelect: () => navigate(areaPath(node.id))
        },
        {
          label: several ? `Copy ${ids.length} elements` : 'Copy',
          hint: `${modKey}C`,
          onSelect: () => copyToClipboard(ids)
        },
        'separator',
        {
          label: several ? `Delete ${ids.length} elements` : 'Delete',
          hint: 'Del',
          danger: true,
          onSelect: () => {
            deleteNodes(ids)
            useUi.getState().resetInteraction()
          }
        }
      ]
      setMenu({ x: event.clientX, y: event.clientY, items })
    },
    [areaId, copyToClipboard, deleteNodes, navigate]
  )

  function onDoubleClick(event: React.MouseEvent) {
    if (!(event.target as Element).classList.contains('react-flow__pane'))
      return
    openAddMenu({ x: event.clientX, y: event.clientY })
  }

  function onDragOver(event: React.DragEvent) {
    const { types } = event.dataTransfer
    if (!types.includes('Files') && !types.includes(ADD_DRAG_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  function onDrop(event: React.DragEvent) {
    const at = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    const dragged = event.dataTransfer.getData(ADD_DRAG_TYPE)
    const item = ADD_ITEMS.find((i) => i.kind === dragged)
    if (item) {
      event.preventDefault()
      if (item.kind === 'image') pickImagesAt(at)
      else createNode(item.kind, at)
      return
    }

    const files = [...event.dataTransfer.files]
    const mapFile = files.find(isJsonFile)
    if (mapFile) {
      event.preventDefault()
      return void importFile(mapFile)
    }
    const images = imageFiles(event.dataTransfer.files)
    if (!images.length) return
    event.preventDefault()
    void addImages(images, at)
  }

  function onPickImages(event: React.ChangeEvent<HTMLInputElement>) {
    const images = imageFiles(event.target.files)
    event.target.value = ''
    lastPointer.current = null
    const target = imageTarget.current
    imageTarget.current = null
    void addImages(images, target?.at ?? insertPoint(), target?.connectFrom)
  }

  function onPickMapFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void importFile(file)
  }

  function addAtCenter(kind: NodeKind) {
    lastPointer.current = null
    createNode(kind, insertPoint())
  }

  return (
    <div
      className="canvas"
      ref={wrapperRef}
      onDoubleClick={onDoubleClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onPointerMove={(e) =>
        (lastPointer.current = { x: e.clientX, y: e.clientY })
      }
      onPointerLeave={() => (lastPointer.current = null)}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onNodeDragStart={checkpoint}
        onSelectionDragStart={checkpoint}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={deleteKeys}
        zoomOnDoubleClick={false}
        minZoom={0.1}
        maxZoom={4}
        colorMode="dark"
        onInit={restoreViewport}
        onMoveEnd={(_, viewport) => saveViewport(areaId, viewport)}
      >
        <Background gap={24} />
        <Controls fitViewOptions={FIT_VIEW_OPTIONS} />
        <MiniMap pannable zoomable />
        <Panel position="top-center">
          <Breadcrumbs areaId={areaId} />
        </Panel>
        <Panel position="top-left" className="toolbar">
          {ADD_ITEMS.map(({ kind, label, short }) => (
            <button
              key={kind}
              type="button"
              className="btn add-btn"
              title={`Add ${label.toLowerCase()}: click, or drag onto the canvas`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(ADD_DRAG_TYPE, kind)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() =>
                kind === 'image' ? pickImagesAt(null) : addAtCenter(kind)
              }
            >
              + {short ?? label}
            </button>
          ))}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={onPickImages}
          />
          <span className="toolbar-sep" />
          <button
            type="button"
            className="btn icon-btn"
            onClick={() => {
              undo()
              resetInteraction()
            }}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            ↶
          </button>
          <button
            type="button"
            className="btn icon-btn"
            onClick={() => {
              redo()
              resetInteraction()
            }}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            ↷
          </button>
        </Panel>
        <Panel position="top-right" className="top-right">
          <div className="toolbar">
            <button type="button" className="btn" onClick={exportMap}>
              Export
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => mapFileInputRef.current?.click()}
            >
              Import
            </button>
            <input
              ref={mapFileInputRef}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={onPickMapFile}
            />
            <button type="button" className="btn" onClick={newMap}>
              Clear map
            </button>
            <button
              type="button"
              className="btn"
              onClick={toggleHelp}
              title="Help and shortcuts (H)"
            >
              Help
            </button>
          </div>
          <div className="notices">
            {storageError && (
              <div className="banner" role="alert">
                {storageMessages[storageError]}
              </div>
            )}
            <NoticeBar />
          </div>
        </Panel>
      </ReactFlow>
      {fileDialog}
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      {menu && <ContextMenu {...menu} onClose={closeMenu} />}
    </div>
  )
}
