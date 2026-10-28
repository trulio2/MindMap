import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import MindMapCanvas from '@/canvas/MindMapCanvas'
import { nodeTitle } from '@/lib/areas'
import { useMapLoaded, useMindMap } from '@/store/mindmap.store'
import { useUi } from '@/store/ui.store'
import { ROOT_AREA } from '@/types'

function MapPage() {
  const { areaId = ROOT_AREA } = useParams()
  const areaNode = useMindMap((s) => s.nodes[areaId])
  const docRevision = useUi((s) => s.docRevision)
  const loaded = useMapLoaded()
  const title = areaNode ? nodeTitle(areaNode) : null

  useEffect(() => {
    document.title = title ? `${title} · MindMap` : 'MindMap'
  }, [title])

  if (!loaded) {
    return <div className="spinner" role="status" aria-label="Loading map" />
  }
  if (areaId !== ROOT_AREA && !areaNode) return <Navigate to="/" replace />

  return (
    <ReactFlowProvider key={`${areaId}:${docRevision}`}>
      <MindMapCanvas areaId={areaId} />
    </ReactFlowProvider>
  )
}

export default MapPage
