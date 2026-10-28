import { useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { areaPath } from '@/lib/areas'

export function useAreaLink() {
  const { mapId = '' } = useParams()
  return useCallback((areaId: string) => areaPath(mapId, areaId), [mapId])
}
