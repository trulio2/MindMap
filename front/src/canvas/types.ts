import type { Edge, Node, NodeProps } from '@xyflow/react'
import type { MapNodeData, NodeKind } from '@/types'

export type FlowNode = Node<MapNodeData, NodeKind>
export type MapNodeProps = NodeProps<FlowNode>

export type EdgeData = { label?: string }
export type FlowEdge = Edge<EdgeData, 'labeled'>
