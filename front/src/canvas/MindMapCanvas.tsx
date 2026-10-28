import { Background, Controls, MiniMap, ReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

export default function MindMapCanvas() {
  return (
    <div className="canvas">
      <ReactFlow nodes={[]} edges={[]} colorMode="dark" fitView>
        <Background gap={24} />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  )
}
