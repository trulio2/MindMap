import { useCallback, useMemo, useRef } from 'react'
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
  type NodeChange,
  type OnConnectEnd,
  type ReactFlowInstance
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMindMap } from '@/store/mindmap.store'
import { useUi, type StorageError } from '@/store/ui.store'
import type { XY } from '@/types'
import TopicNode from './nodes/TopicNode'
import type { FlowEdge, FlowNode } from './types'

const nodeTypes = { topic: TopicNode }
const deleteKeys = ['Backspace', 'Delete']

const storageMessages: Record<StorageError, string> = {
  full: 'Browser storage is full, so recent changes are not saved. Remove some images or export your map.',
  unavailable:
    'This browser is blocking storage, so changes are not saved. Export your map to keep it.'
}

type Props = { areaId: string }

export default function MindMapCanvas({ areaId }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()

  const docNodes = useMindMap((s) => s.nodes)
  const docEdges = useMindMap((s) => s.edges)
  const { addNode, patchNodes, deleteNodes, addEdge, deleteEdges } =
    useMindMap.getState()

  const selectedNodes = useUi((s) => s.selectedNodes)
  const selectedEdges = useUi((s) => s.selectedEdges)
  const storageError = useUi((s) => s.storageError)
  const { selectNodes, selectEdges, setEditing } = useUi.getState()

  // Fit once on open from the saved node sizes. React Flow's own fitView
  // drops the fit when restored nodes are measured before its zoom handler
  // exists, and on an empty area it zooms right into the first new node.
  const fitOnInit = useCallback(
    (flow: ReactFlowInstance<FlowNode, FlowEdge>) => {
      const areaNodes = Object.values(useMindMap.getState().nodes).filter(
        (n) => n.areaId === areaId
      )
      const rect = wrapperRef.current?.getBoundingClientRect()
      if (!areaNodes.length || !rect) return
      const bounds = getNodesBounds(areaNodes)
      void flow.setViewport(
        getViewportForBounds(bounds, rect.width, rect.height, 0.1, 1.25, 0.1)
      )
    },
    [areaId]
  )

  const nodes = useMemo<FlowNode[]>(
    () =>
      Object.values(docNodes)
        .filter((n) => n.areaId === areaId)
        .map((n) => ({
          id: n.id,
          type: n.kind,
          position: n.position,
          measured: n.measured,
          data: n.data,
          selected: !!selectedNodes[n.id]
        })),
    [docNodes, areaId, selectedNodes]
  )

  const edges = useMemo<FlowEdge[]>(
    () =>
      Object.values(docEdges)
        .filter((e) => e.areaId === areaId)
        .map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          selected: !!selectedEdges[e.id]
        })),
    [docEdges, areaId, selectedEdges]
  )

  const onNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      const patches: Parameters<typeof patchNodes>[0] = {}
      const selection: Record<string, boolean> = {}
      const removed: string[] = []

      for (const change of changes) {
        switch (change.type) {
          case 'position':
            if (change.position)
              patches[change.id] = {
                ...patches[change.id],
                position: change.position
              }
            break
          case 'dimensions':
            if (change.dimensions)
              patches[change.id] = {
                ...patches[change.id],
                measured: change.dimensions
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

  const createTopicAt = useCallback(
    (position: XY) => {
      const id = addNode(areaId, position)
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

      const target = createTopicAt(
        screenToFlowPosition({ x: clientX, y: clientY })
      )
      addEdge(areaId, { ...from, target, targetHandle: null })
    },
    [addEdge, areaId, createTopicAt, screenToFlowPosition]
  )

  function onDoubleClick(event: React.MouseEvent) {
    if (!(event.target as Element).classList.contains('react-flow__pane'))
      return
    createTopicAt(screenToFlowPosition({ x: event.clientX, y: event.clientY }))
  }

  function addTopicAtCenter() {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return
    createTopicAt(
      screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      })
    )
  }

  return (
    <div className="canvas" ref={wrapperRef} onDoubleClick={onDoubleClick}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        connectionMode={ConnectionMode.Loose}
        deleteKeyCode={deleteKeys}
        zoomOnDoubleClick={false}
        minZoom={0.1}
        maxZoom={4}
        colorMode="dark"
        onInit={fitOnInit}
      >
        <Background gap={24} />
        <Controls />
        <MiniMap pannable zoomable />
        <Panel position="top-left" className="toolbar">
          <button type="button" className="btn" onClick={addTopicAtCenter}>
            + Topic
          </button>
        </Panel>
        {storageError && (
          <Panel position="top-center" className="banner" role="alert">
            {storageMessages[storageError]}
          </Panel>
        )}
        <Panel position="bottom-center" className="hint">
          Double-click the canvas to add a topic · Drag from a dot to connect ·
          Double-click a topic to rename · Del to delete
        </Panel>
      </ReactFlow>
    </div>
  )
}
