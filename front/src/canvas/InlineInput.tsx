import { useLayoutEffect, useRef, useState } from 'react'
import { applyFormat, type Format } from '@/lib/format'
import { useAutoFocus } from './useAutoFocus'

type Props = {
  initial: string
  placeholder?: string
  className?: string
  multiline?: boolean
  formatting?: boolean
  onDone: (value: string | null) => void
}

const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl+'

const buttons: { format: Format; label: string; title: string }[] = [
  { format: 'bold', label: 'B', title: `Bold (${mod}B)` },
  { format: 'italic', label: 'I', title: `Italic (${mod}I)` },
  { format: 'strike', label: 'S', title: 'Strikethrough' },
  { format: 'link', label: '🔗', title: `Link (${mod}K)` },
  { format: 'code', label: '</>', title: 'Code' },
  { format: 'list', label: '•', title: 'Bullet list' }
]

const shortcutFormats: Record<string, Format> = {
  b: 'bold',
  i: 'italic',
  k: 'link'
}

export default function InlineInput({
  initial,
  placeholder,
  className = '',
  multiline = false,
  formatting = false,
  onDone
}: Props) {
  const [draft, setDraft] = useState(initial)
  const ref = useAutoFocus<HTMLInputElement & HTMLTextAreaElement>(true)
  const pendingSelection = useRef<[number, number] | null>(null)

  useLayoutEffect(() => {
    const field = ref.current
    if (!field || !pendingSelection.current) return
    field.setSelectionRange(...pendingSelection.current)
    pendingSelection.current = null
  }, [draft, ref])

  function format(kind: Format) {
    const field = ref.current
    if (!field) return
    const edit = applyFormat(
      draft,
      field.selectionStart ?? draft.length,
      field.selectionEnd ?? draft.length,
      kind
    )
    pendingSelection.current = [edit.start, edit.end]
    setDraft(edit.value)
  }

  const shared = {
    ref,
    className: `inline-input nodrag nowheel ${className}`,
    value: draft,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(e.target.value),
    onBlur: () => onDone(draft.trim()),
    onKeyDown: (e: React.KeyboardEvent) => {
      const shortcut =
        formatting && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey
          ? shortcutFormats[e.key.toLowerCase()]
          : undefined
      if (shortcut) {
        e.preventDefault()
        format(shortcut)
      } else if (e.key === 'Escape') onDone(null)
      else if (e.key === 'Enter' && (!multiline || e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        onDone(draft.trim())
      }
    }
  }

  return (
    <>
      {formatting && (
        <div className="format-bar nodrag" role="toolbar" aria-label="Format">
          {buttons
            .filter((b) => multiline || b.format !== 'list')
            .map((b) => (
              <button
                key={b.format}
                type="button"
                className={`format-btn format-${b.format}`}
                title={b.title}
                aria-label={b.title}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => format(b.format)}
              >
                {b.label}
              </button>
            ))}
        </div>
      )}
      {multiline ? (
        <textarea {...shared} rows={Math.max(draft.split('\n').length, 2)} />
      ) : (
        <input
          {...shared}
          size={Math.max(draft.length, placeholder?.length ?? 4)}
        />
      )}
    </>
  )
}
