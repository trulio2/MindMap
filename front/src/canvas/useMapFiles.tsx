import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  downloadDoc,
  emptyDoc,
  ImportError,
  readMapFile,
  type ParsedDoc
} from '@/lib/io'
import { useMindMap } from '@/store/mindmap.store'
import { useUi, type Notice } from '@/store/ui.store'
import type { MindMapDoc } from '@/types'
import ConfirmDialog, { type ConfirmRequest } from './ConfirmDialog'

function importedNotice({ doc, skipped }: ParsedDoc): Notice {
  const count = Object.keys(doc.nodes).length
  const items = count
    ? `Imported ${count} ${count === 1 ? 'item' : 'items'}.`
    : 'Imported an empty map.'
  const broken = skipped
    ? ` ${skipped} broken ${skipped === 1 ? 'entry was' : 'entries were'} left out.`
    : ''
  return { kind: 'info', text: items + broken }
}

export function useMapFiles() {
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const setNotice = useUi((s) => s.setNotice)

  const exportMap = useCallback(() => {
    const { nodes, edges, viewports } = useMindMap.getState()
    downloadDoc({ nodes, edges, viewports })
  }, [])

  const replaceWith = useCallback(
    (doc: MindMapDoc, notice: Notice) => {
      useMindMap.getState().replaceDoc(doc)
      useUi.getState().docReplaced()
      navigate('/')
      setNotice(notice)
    },
    [navigate, setNotice]
  )

  const guard = useCallback((request: ConfirmRequest) => {
    const isEmpty = !Object.keys(useMindMap.getState().nodes).length
    if (isEmpty) request.onConfirm()
    else setConfirm(request)
  }, [])

  const importFile = useCallback(
    async (file: File) => {
      let parsed: ParsedDoc
      try {
        parsed = await readMapFile(file)
      } catch (error) {
        setNotice({
          kind: 'error',
          text:
            error instanceof ImportError
              ? error.message
              : `Could not read "${file.name}".`
        })
        return
      }
      guard({
        title: 'Replace your current map?',
        message: `Importing "${file.name}" replaces everything in your current map, including what is inside nodes. Export it first if you want to keep a copy.`,
        confirmLabel: 'Replace map',
        onConfirm: () => replaceWith(parsed.doc, importedNotice(parsed))
      })
    },
    [guard, replaceWith, setNotice]
  )

  const newMap = useCallback(() => {
    guard({
      title: 'Start a new map?',
      message:
        'This clears everything in your current map, including what is inside nodes. Export it first if you want to keep a copy.',
      confirmLabel: 'Clear map',
      onConfirm: () =>
        replaceWith(emptyDoc(), { kind: 'info', text: 'Started a new map.' })
    })
  }, [guard, replaceWith])

  const dialog = (
    <ConfirmDialog
      request={confirm}
      onClose={() => setConfirm(null)}
      extra={{ label: 'Export first', onClick: exportMap }}
    />
  )

  return { exportMap, importFile, newMap, dialog }
}
