import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { areaPath } from '@/lib/areas'
import {
  downloadMap,
  emptyDoc,
  ImportError,
  readImportFile,
  type ImportedFile
} from '@/lib/io'
import { useLibrary } from '@/store/library.store'
import { createMap, importTree } from '@/store/maps'
import { useMindMap } from '@/store/mindmap.store'
import { useUi, type Notice } from '@/store/ui.store'
import ConfirmDialog, { type ConfirmRequest } from './ConfirmDialog'

export type ImportResult =
  | { kind: 'map'; id: string }
  | { kind: 'library' }
  | null

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

function brokenNote(skipped: number) {
  return skipped
    ? ` ${plural(skipped, 'broken entry was', 'broken entries were')} left out.`
    : ''
}

export function useMapFiles() {
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const setNotice = useUi((s) => s.setNotice)

  const exportMap = useCallback(() => {
    const { nodes, edges, viewports } = useMindMap.getState()
    const id = useUi.getState().openMapId
    const name = (id && useLibrary.getState().maps[id]?.name) || 'mindmap'
    downloadMap(name, { nodes, edges, viewports })
  }, [])

  const importFile = useCallback(
    async (
      file: File,
      folderId: string | null = null,
      { open = true } = {}
    ): Promise<ImportResult> => {
      let imported: ImportedFile
      try {
        imported = await readImportFile(file)
      } catch (error) {
        setNotice({
          kind: 'error',
          text:
            error instanceof ImportError
              ? error.message
              : `Could not read "${file.name}".`
        })
        return null
      }

      if (imported.kind === 'library') {
        const counts = await importTree(imported.tree, folderId)
        setNotice({
          kind: 'info',
          text: `Imported ${plural(counts.folders, 'folder', 'folders')} and ${plural(counts.maps, 'map', 'maps')}.${brokenNote(imported.skipped)}`
        })
        return { kind: 'library' }
      }

      const { doc, skipped } = imported.parsed
      const id = await createMap(imported.name, folderId, doc)
      if (open) navigate(areaPath(id))
      setNotice({
        kind: 'info',
        text: `Imported "${imported.name}" as a new map.${brokenNote(skipped)}`
      })
      return { kind: 'map', id }
    },
    [navigate, setNotice]
  )

  const clearMap = useCallback(() => {
    const clear = () => {
      useMindMap.getState().replaceDoc(emptyDoc())
      useUi.getState().docReplaced()
      const id = useUi.getState().openMapId
      if (id) navigate(areaPath(id))
      setNotice({ kind: 'info', text: 'Cleared the map.' } satisfies Notice)
    }
    if (!Object.keys(useMindMap.getState().nodes).length) return clear()
    setConfirm({
      title: 'Clear this map?',
      message:
        'This removes everything in the map, including what is inside nodes. Export it first if you want to keep a copy, or undo right after.',
      confirmLabel: 'Clear map',
      onConfirm: clear
    })
  }, [navigate, setNotice])

  const dialog = (
    <ConfirmDialog
      request={confirm}
      onClose={() => setConfirm(null)}
      extra={{ label: 'Export first', onClick: exportMap }}
    />
  )

  return { exportMap, importFile, clearMap, dialog }
}
