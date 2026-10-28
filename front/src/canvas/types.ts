import type { Edge, Node } from '@xyflow/react'
import type { MapNodeData } from '@/types'

export type TopicFlowNode = Node<MapNodeData, 'topic'>
export type FlowNode = TopicFlowNode
export type FlowEdge = Edge
