import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import MindMapCanvas from '@/canvas/MindMapCanvas'
import { nodeTitle } from '@/lib/areas'
import { useMindMap } from '@/store/mindmap.store'
import { ROOT_AREA } from '@/types'

function MapPage() {
  const { areaId = ROOT_AREA } = useParams()
  const areaNode = useMindMap((s) => s.nodes[areaId])
  const title = areaNode ? nodeTitle(areaNode) : null

  useEffect(() => {
    document.title = title ? `${title} · MindMap` : 'MindMap'
  }, [title])

  // The node may have been deleted (here or in another tab), or the link is stale.
  if (areaId !== ROOT_AREA && !areaNode) return <Navigate to="/" replace />

  return (
    <ReactFlowProvider key={areaId}>
      <MindMapCanvas areaId={areaId} />
    </ReactFlowProvider>
  )
}

export default MapPage
