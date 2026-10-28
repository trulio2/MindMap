import { useLayoutEffect, useRef, type RefObject } from 'react'
import { applyFormat, type Format } from '@/lib/format'

const shortcutFormats: Record<string, Format> = {
  b: 'bold',
  i: 'italic',
  k: 'link'
}

type Field = HTMLInputElement | HTMLTextAreaElement

export function useFormatting(
  ref: RefObject<Field | null>,
  value: string,
  setValue: (value: string) => void
) {
  const pendingSelection = useRef<[number, number] | null>(null)

  useLayoutEffect(() => {
    const field = ref.current
    if (!field || !pendingSelection.current) return
    field.setSelectionRange(...pendingSelection.current)
    pendingSelection.current = null
  }, [value, ref])

  function format(kind: Format) {
    const field = ref.current
    if (!field) return
    const edit = applyFormat(
      value,
      field.selectionStart ?? value.length,
      field.selectionEnd ?? value.length,
      kind
    )
    pendingSelection.current = [edit.start, edit.end]
    setValue(edit.value)
  }

  function handleShortcut(e: React.KeyboardEvent) {
    if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return false
    const kind = shortcutFormats[e.key.toLowerCase()]
    if (!kind) return false
    e.preventDefault()
    format(kind)
    return true
  }

  return { format, handleShortcut }
}
