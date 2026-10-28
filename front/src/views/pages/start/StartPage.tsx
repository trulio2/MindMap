import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { areaPath } from '@/lib/areas'
import { startMapId, useLibraryLoaded } from '@/store/maps'
import { ROOT_AREA } from '@/types'

export default function StartPage() {
  const { areaId = ROOT_AREA } = useParams()
  const loaded = useLibraryLoaded()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loaded) return
    let cancelled = false
    void startMapId().then((id) => {
      if (!cancelled) navigate(areaPath(id, areaId), { replace: true })
    })
    return () => {
      cancelled = true
    }
  }, [loaded, areaId, navigate])

  return <div className="spinner" role="status" aria-label="Loading" />
}
