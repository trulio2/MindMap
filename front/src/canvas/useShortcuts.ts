import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReactFlow } from '@xyflow/react'
import { useAreaLink } from './useAreaLink'
import { isTyping } from '@/lib/dom'
import { useMindMap } from '@/store/mindmap.store'
import { useUi } from '@/store/ui.store'
import { ROOT_AREA } from '@/types'

export const FIT_VIEW_OPTIONS = { maxZoom: 1.25, duration: 200 }

const selectAll = (ids: string[]) =>
  Object.fromEntries(ids.map((id) => [id, true]))

export function useShortcuts(areaId: string, toggleHelp: () => void) {
  const navigate = useNavigate()
  const areaPath = useAreaLink()
  const { fitView } = useReactFlow()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || isTyping(event.target)) return
      if (document.querySelector('dialog[open]')) return

      const map = useMindMap.getState()
      const ui = useUi.getState()
      const mod = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      const selected = Object.keys(ui.selectedNodes).filter(
        (id) => map.nodes[id]?.areaId === areaId
      )
      const single = selected.length === 1 ? map.nodes[selected[0]] : null

      if (mod && key === 'z' && !event.shiftKey) {
        map.undo()
        ui.resetInteraction()
      } else if (mod && (key === 'y' || (key === 'z' && event.shiftKey))) {
        map.redo()
        ui.resetInteraction()
      } else if (mod && key === 'd') {
        if (!selected.length) return
        const copies = map.duplicateNodes(selected)
        ui.resetInteraction()
        ui.selectNodes(selectAll(copies))
      } else if (mod && key === 'a') {
        const inArea = (n: { areaId: string }) => n.areaId === areaId
        ui.selectNodes(
          selectAll(
            Object.values(map.nodes)
              .filter(inArea)
              .map((n) => n.id)
          )
        )
        ui.selectEdges(
          selectAll(
            Object.values(map.edges)
              .filter(inArea)
              .map((e) => e.id)
          )
        )
      } else if (event.altKey && event.key === 'ArrowUp') {
        if (areaId === ROOT_AREA) return
        navigate(areaPath(map.nodes[areaId]?.areaId ?? ROOT_AREA))
      } else if (event.altKey && event.key === 'ArrowDown') {
        if (!single) return
        navigate(areaPath(single.id))
      } else if (mod || event.altKey) {
        return
      } else if (event.key === 'Enter' || event.key === 'F2') {
        if (!single || single.kind === 'image') return
        ui.setEditing(single.id)
      } else if (event.key === 'Escape') {
        ui.resetInteraction()
      } else if (key === 'f') {
        void fitView(FIT_VIEW_OPTIONS)
      } else if (key === 'm') {
        ui.setLibraryOpen(true)
      } else if (key === 'h') {
        toggleHelp()
      } else {
        return
      }
      event.preventDefault()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [areaId, areaPath, fitView, navigate, toggleHelp])
}
