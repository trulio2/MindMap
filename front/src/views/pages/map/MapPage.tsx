import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import MindMapCanvas from '@/canvas/MindMapCanvas'
import { areaPath, nodeTitle } from '@/lib/areas'
import { useLibrary } from '@/store/library.store'
import { openMap, useLibraryLoaded } from '@/store/maps'
import { useMindMap } from '@/store/mindmap.store'
import { useUi } from '@/store/ui.store'
import { ROOT_AREA } from '@/types'

const spinner = (
  <div className="spinner" role="status" aria-label="Loading map" />
)

function MapPage() {
  const { mapId = '', areaId = ROOT_AREA } = useParams()
  const libraryLoaded = useLibraryLoaded()
  const mapName = useLibrary((s) => s.maps[mapId]?.name)
  const openMapId = useUi((s) => s.openMapId)
  const docRevision = useUi((s) => s.docRevision)
  const areaNode = useMindMap((s) => s.nodes[areaId])
  const isOpen = openMapId === mapId
  const known = mapName !== undefined

  useEffect(() => {
    if (libraryLoaded && known) void openMap(mapId)
  }, [libraryLoaded, known, mapId])

  const areaTitle = isOpen && areaNode ? nodeTitle(areaNode) : null
  useEffect(() => {
    document.title = [areaTitle, mapName, 'MindMap'].filter(Boolean).join(' · ')
  }, [areaTitle, mapName])

  if (!libraryLoaded) return spinner
  if (!known) return <Navigate to="/" replace />
  if (!isOpen) return spinner
  if (areaId !== ROOT_AREA && !areaNode) {
    return <Navigate to={areaPath(mapId)} replace />
  }

  return (
    <ReactFlowProvider key={`${mapId}:${areaId}:${docRevision}`}>
      <MindMapCanvas areaId={areaId} />
    </ReactFlowProvider>
  )
}

export default MapPage
