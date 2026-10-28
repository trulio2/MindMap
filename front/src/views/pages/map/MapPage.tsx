import { useParams } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import MindMapCanvas from '@/canvas/MindMapCanvas'
import { ROOT_AREA } from '@/types'

function MapPage() {
  const { areaId = ROOT_AREA } = useParams()

  return (
    <ReactFlowProvider>
      <MindMapCanvas key={areaId} areaId={areaId} />
    </ReactFlowProvider>
  )
}

export default MapPage
