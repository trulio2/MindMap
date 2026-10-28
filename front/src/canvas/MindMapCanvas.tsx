import { useCallback, useEffect, useMemo, useRef } from 'react'
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
import { fitSize, loadImageFile } from '@/lib/image'
import { normalizeUrl } from '@/lib/url'
import { useMindMap } from '@/store/mindmap.store'
import { useUi, type StorageError } from '@/store/ui.store'
import type { MapNode, NodeKind, XY } from '@/types'
import Breadcrumbs from './Breadcrumbs'
import NoticeBar from './NoticeBar'
import { useMapFiles } from './useMapFiles'
import LabeledEdge from './edges/LabeledEdge'
import ImageNode from './nodes/ImageNode'
import LinkNode from './nodes/LinkNode'
import TextNode from './nodes/TextNode'
import TopicNode from './nodes/TopicNode'
import type { FlowEdge, FlowNode } from './types'

const nodeTypes = {
  topic: TopicNode,
  text: TextNode,
  image: ImageNode,
  link: LinkNode
}
const edgeTypes = { labeled: LabeledEdge }
const deleteKeys = ['Backspace', 'Delete']

const storageMessages: Record<StorageError, string> = {
  full: 'Browser storage is full, so recent changes are not saved. Remove some images or export your map.',
  unavailable:
    'This browser is blocking storage, so changes are not saved. Export your map to keep it.'
}

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  )
}

function isJsonFile(file: File) {
  return file.type === 'application/json' || file.name.endsWith('.json')
}

function imageFiles(files: FileList | undefined | null) {
  return [...(files ?? [])].filter((f) => f.type.startsWith('image/'))
}

type Props = { areaId: string }

export default function MindMapCanvas({ areaId }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const lastPointer = useRef<XY | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mapFileInputRef = useRef<HTMLInputElement>(null)
  const { exportMap, importFile, newMap, dialog: fileDialog } = useMapFiles()
  const { screenToFlowPosition } = useReactFlow()

  const docNodes = useMindMap((s) => s.nodes)
  const docEdges = useMindMap((s) => s.edges)
  const {
    addNode,
    patchNodes,
    deleteNodes,
    addEdge,
    deleteEdges,
    saveViewport
  } = useMindMap.getState()

  const selectedNodes = useUi((s) => s.selectedNodes)
  const selectedEdges = useUi((s) => s.selectedEdges)
  const storageError = useUi((s) => s.storageError)
  const { selectNodes, selectEdges, setEditing } = useUi.getState()

  // Start a new canvas without the previous area's selection or edit.
  useEffect(() => useUi.getState().resetInteraction(), [])

  // On open, go back to where you left this area. Otherwise fit its content
  // from the saved node sizes: React Flow's own fitView drops the fit when
  // restored nodes are measured before its zoom handler exists, and on an
  // empty area it zooms right into the first new node.
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
    const childCounts: Record<string, number> = {}
    for (const n of Object.values(docNodes)) {
      childCounts[n.areaId] = (childCounts[n.areaId] ?? 0) + 1
    }
    return Object.values(docNodes)
      .filter((n) => n.areaId === areaId)
      .map((n) => ({
        id: n.id,
        type: n.kind,
        position: n.position,
        width: n.size?.width,
        height: n.size?.height,
        measured: n.measured,
        // Only nodes with content get a new data object, so the rest
        // keep their identity and skip re-rendering.
        data: childCounts[n.id]
          ? { ...n.data, childCount: childCounts[n.id] }
          : n.data,
        selected: !!selectedNodes[n.id]
      }))
  }, [docNodes, areaId, selectedNodes])

  const edges = useMemo<FlowEdge[]>(
    () =>
      Object.values(docEdges)
        .filter((e) => e.areaId === areaId)
        .map((e) => ({
          id: e.id,
          type: 'labeled',
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          data: { label: e.label },
          selected: !!selectedEdges[e.id]
        })),
    [docEdges, areaId, selectedEdges]
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
            // Resize handles set the size; text bubbles only take a width
            // so their height keeps following the text.
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

  /** Adds a node and, for kinds you type into, opens it for editing. */
  const createNode = useCallback(
    (kind: NodeKind, position: XY, extra?: Pick<MapNode, 'data' | 'size'>) => {
      const id = addNode(areaId, { kind, position, ...extra })
      if (kind === 'image' || extra?.data) return id
      setEditing(id)
      return id
    },
    [addNode, areaId, setEditing]
  )

  // Dropping a connection on empty canvas creates a new connected topic;
  // dropping it on a node body (away from its handles) connects to that node.
  const onConnectEnd = useCallback<OnConnectEnd>(
    (event, state) => {
      if (state.isValid || !state.fromNode || !state.fromHandle) return
      const { clientX, clientY } =
        'changedTouches' in event ? event.changedTouches[0] : event
      const from = {
        source: state.fromNode.id,
        sourceHandle: state.fromHandle.id
      }

      const dropTarget = (event.target as Element | null)?.closest(
        '.react-flow__node'
      )
      const targetId = dropTarget?.getAttribute('data-id')
      if (targetId) {
        addEdge(areaId, { ...from, target: targetId, targetHandle: null })
        return
      }
      if (!(event.target as Element | null)?.closest('.react-flow__pane'))
        return

      const target = createNode(
        'topic',
        screenToFlowPosition({ x: clientX, y: clientY })
      )
      addEdge(areaId, { ...from, target, targetHandle: null })
    },
    [addEdge, areaId, createNode, screenToFlowPosition]
  )

  /** Where new things go: the pointer if it is over the canvas, else the center. */
  const insertPoint = useCallback((): XY => {
    const rect = wrapperRef.current!.getBoundingClientRect()
    const screen = lastPointer.current ?? {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    }
    return screenToFlowPosition(screen)
  }, [screenToFlowPosition])

  const addImages = useCallback(
    async (files: File[], at: XY) => {
      for (const [i, file] of files.entries()) {
        try {
          const image = await loadImageFile(file)
          const size = fitSize(image.size)
          createNode(
            'image',
            {
              x: at.x - size.width / 2 + i * 24,
              y: at.y - size.height / 2 + i * 24
            },
            { data: { src: image.src, label: image.name }, size }
          )
        } catch (error) {
          console.warn(`Could not read image ${file.name}`, error)
        }
      }
    },
    [createNode]
  )

  // Pasting outside a text field: images become image nodes, URLs become
  // links and any other text becomes a text bubble.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (isTyping(event.target) || !event.clipboardData) return
      const images = imageFiles(event.clipboardData.files)
      const text = event.clipboardData.getData('text/plain').trim()
      if (!images.length && !text) return
      event.preventDefault()

      const at = insertPoint()
      if (images.length) return void addImages(images, at)
      const url = normalizeUrl(text)
      if (url && !/\s/.test(text)) createNode('link', at, { data: { url } })
      else createNode('text', at, { data: { text } })
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [addImages, createNode, insertPoint])

  function onDoubleClick(event: React.MouseEvent) {
    if (!(event.target as Element).classList.contains('react-flow__pane'))
      return
    createNode(
      'topic',
      screenToFlowPosition({ x: event.clientX, y: event.clientY })
    )
  }

  function onDragOver(event: React.DragEvent) {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  function onDrop(event: React.DragEvent) {
    const files = [...event.dataTransfer.files]
    const mapFile = files.find(isJsonFile)
    if (mapFile) {
      event.preventDefault()
      return void importFile(mapFile)
    }
    const images = imageFiles(event.dataTransfer.files)
    if (!images.length) return
    event.preventDefault()
    void addImages(
      images,
      screenToFlowPosition({ x: event.clientX, y: event.clientY })
    )
  }

  function onPickImages(event: React.ChangeEvent<HTMLInputElement>) {
    const images = imageFiles(event.target.files)
    event.target.value = ''
    lastPointer.current = null
    void addImages(images, insertPoint())
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
        <Controls />
        <MiniMap pannable zoomable />
        <Panel position="top-center">
          <Breadcrumbs areaId={areaId} />
        </Panel>
        <Panel position="top-left" className="toolbar">
          <button
            type="button"
            className="btn"
            onClick={() => addAtCenter('topic')}
          >
            + Topic
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => addAtCenter('text')}
          >
            + Text
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => addAtCenter('link')}
          >
            + Link
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => fileInputRef.current?.click()}
          >
            + Image
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={onPickImages}
          />
          <span className="toolbar-sep" />
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
            New map
          </button>
        </Panel>
        <Panel position="top-right" className="notices">
          {storageError && (
            <div className="banner" role="alert">
              {storageMessages[storageError]}
            </div>
          )}
          <NoticeBar />
        </Panel>
        <Panel position="bottom-center" className="hint">
          Double-click the canvas for a topic · Paste or drop images and links ·
          Double-click anything to edit · Drag from a dot to connect · Del to
          delete
        </Panel>
      </ReactFlow>
      {fileDialog}
    </div>
  )
}
