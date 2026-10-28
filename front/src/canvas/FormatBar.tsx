import type { Format } from '@/lib/format'

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

type Props = {
  onFormat: (kind: Format) => void
  lists?: boolean
  floating?: boolean
}

export default function FormatBar({ onFormat, lists, floating }: Props) {
  return (
    <div
      className={`format-bar nodrag${floating ? ' floating' : ''}`}
      role="toolbar"
      aria-label="Format"
    >
      {buttons
        .filter((b) => lists || b.format !== 'list')
        .map((b) => (
          <button
            key={b.format}
            type="button"
            className={`format-btn format-${b.format}`}
            title={b.title}
            aria-label={b.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onFormat(b.format)}
          >
            {b.label}
          </button>
        ))}
    </div>
  )
}
