import { useState } from 'react'
import { useAutoFocus } from './useAutoFocus'

type Props = {
  initial: string
  placeholder?: string
  className?: string
  /** Enter adds a line break; Ctrl/Cmd+Enter or leaving the field saves. */
  multiline?: boolean
  /** Called with the trimmed value, or null when editing was cancelled. */
  onDone: (value: string | null) => void
}

/** A text field that saves on Enter or blur and cancels on Escape. */
export default function InlineInput({
  initial,
  placeholder,
  className = '',
  multiline = false,
  onDone
}: Props) {
  const [draft, setDraft] = useState(initial)
  const ref = useAutoFocus<HTMLInputElement & HTMLTextAreaElement>(true)

  const shared = {
    ref,
    className: `inline-input nodrag nowheel ${className}`,
    value: draft,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(e.target.value),
    onBlur: () => onDone(draft.trim()),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onDone(null)
      else if (e.key === 'Enter' && (!multiline || e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        onDone(draft.trim())
      }
    }
  }

  return multiline ? (
    <textarea {...shared} rows={Math.max(draft.split('\n').length, 2)} />
  ) : (
    <input
      {...shared}
      size={Math.max(draft.length, placeholder?.length ?? 4)}
    />
  )
}
