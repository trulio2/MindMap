import { useState } from 'react'
import FormatBar from './FormatBar'
import { useFormatting } from './useFormatting'
import { useAutoFocus } from './useAutoFocus'

type Props = {
  initial: string
  placeholder?: string
  className?: string
  multiline?: boolean
  formatting?: boolean
  onDone: (value: string | null) => void
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
  const { format, handleShortcut } = useFormatting(ref, draft, setDraft)

  const shared = {
    ref,
    className: `inline-input nodrag nowheel ${className}`,
    value: draft,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft(e.target.value),
    onBlur: () => onDone(draft.trim()),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (formatting && handleShortcut(e)) return
      if (e.key === 'Escape') onDone(null)
      else if (e.key === 'Enter' && (!multiline || e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        onDone(draft.trim())
      }
    }
  }

  return (
    <>
      {formatting && <FormatBar onFormat={format} lists={multiline} floating />}
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
