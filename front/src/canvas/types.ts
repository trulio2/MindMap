import type { Edge, Node, NodeProps } from '@xyflow/react'
import type { MapNodeData, NodeKind } from '@/types'

export type FlowNodeData = MapNodeData & { childCount?: number }

export type FlowNode = Node<FlowNodeData, NodeKind>
export type MapNodeProps = NodeProps<FlowNode>

export type EdgeData = { label?: string }
export type FlowEdge = Edge<EdgeData, 'labeled'>
