import { Handle, Position } from '@xyflow/react'

const sides = [
  { id: 't', position: Position.Top },
  { id: 'r', position: Position.Right },
  { id: 'b', position: Position.Bottom },
  { id: 'l', position: Position.Left }
]

/** One handle per side. The canvas uses loose connections, so any handle can start or end an edge. */
export default function NodeHandles() {
  return sides.map((side) => (
    <Handle
      key={side.id}
      id={side.id}
      type="source"
      position={side.position}
      className="node-handle"
    />
  ))
}
