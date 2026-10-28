import { useCallback, useEffect } from 'react'
import { isTyping } from '@/lib/dom'
import { serializeClip } from '@/lib/io'
import { useMindMap } from '@/store/mindmap.store'
import { useUi } from '@/store/ui.store'
import type { Clip, XY } from '@/types'

/** The selected nodes that belong to this area. */
export function selectedInArea(areaId: string) {
  const { nodes } = useMindMap.getState()
  return Object.keys(useUi.getState().selectedNodes).filter(
    (id) => nodes[id]?.areaId === areaId
  )
}

/**
 * Copy and paste of nodes. Copies go to the app's own clipboard (for the
 * canvas menu) and to the system clipboard as JSON, so Ctrl+V also works in
 * another tab. Pasting from the system clipboard is handled by the canvas's
 * paste listener, which calls `paste`.
 */
export function useClipboard(areaId: string) {
  const copy = useCallback((ids: string[]) => {
    const clip = useMindMap.getState().copyNodes(ids)
    if (!clip) return null
    useUi.getState().setClipboard(clip)
    return serializeClip(clip)
  }, [])

  const paste = useCallback(
    (clip: Clip, at?: XY) => {
      const ids = useMindMap.getState().pasteClip(areaId, clip, at)
      const ui = useUi.getState()
      ui.resetInteraction()
      ui.selectNodes(Object.fromEntries(ids.map((id) => [id, true])))
    },
    [areaId]
  )

  /** For the canvas menu, which has no copy event to write into. */
  const copyToClipboard = useCallback(
    (ids: string[]) => {
      const text = copy(ids)
      if (text) navigator.clipboard?.writeText(text).catch(() => {})
    },
    [copy]
  )

  // Ctrl+C with nodes selected. Without a node selection the browser's own
  // copy (of selected text) goes ahead untouched.
  useEffect(() => {
    function onCopy(event: ClipboardEvent) {
      if (isTyping(event.target) || document.querySelector('dialog[open]'))
        return
      const ids = selectedInArea(areaId)
      if (!ids.length || !event.clipboardData) return
      const text = copy(ids)
      if (!text) return
      event.clipboardData.setData('text/plain', text)
      event.preventDefault()
    }
    document.addEventListener('copy', onCopy)
    return () => document.removeEventListener('copy', onCopy)
  }, [areaId, copy])

  return { copyToClipboard, paste }
}
