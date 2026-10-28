import { useEffect, useRef } from 'react'

const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl'
const alt = isMac ? '⌥' : 'Alt'

const groups: { title: string; keys: [string, string][] }[] = [
  {
    title: 'Create',
    keys: [
      ['Double- or right-click', 'Choose what to add at that spot'],
      [
        'Drag from a dot',
        'Connect to a node, or drop on empty space to add a connected element'
      ],
      [`${mod} V`, 'Paste copied elements, an image, a link or text'],
      ['Drop files', 'Images become image nodes; a .json file imports a map']
    ]
  },
  {
    title: 'Edit',
    keys: [
      ['Double-click', 'Edit a node or a connection label'],
      ['Enter or F2', 'Edit the selected node'],
      ['Right-click a node', 'Open, copy or delete it'],
      [`${mod} C / ${mod} D`, 'Copy / duplicate the selection'],
      ['Delete', 'Delete the selection'],
      [`${mod} Z / ${mod} Shift Z`, 'Undo / redo']
    ]
  },
  {
    title: 'Formatting in topics and text',
    keys: [
      [`**bold**  ${mod} B`, 'Bold'],
      [`*italic*  ${mod} I`, 'Italic'],
      ['~~strike~~', 'Strikethrough'],
      [`[text](url)  ${mod} K`, 'Link'],
      ['`code`', 'Inline code'],
      ['- item / 1. item', 'Lists (text bubbles)']
    ]
  },
  {
    title: 'Navigate',
    keys: [
      [`${alt} ↓`, 'Open the selected node'],
      [`${alt} ↑`, 'Go up one level'],
      ['F', 'Fit everything in view'],
      [`${mod} A`, 'Select all'],
      ['Esc', 'Clear selection'],
      ['H', 'Show this help']
    ]
  }
]

type Props = { open: boolean; onClose: () => void }

export default function HelpDialog({ open, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="dialog help"
      aria-labelledby="help-title"
      onClose={onClose}
    >
      <h2 id="help-title">Help</h2>
      <p className="help-intro">
        The map is saved in this browser; use Export to keep a copy.
      </p>
      {groups.map((group) => (
        <section key={group.title}>
          <h3>{group.title}</h3>
          <dl>
            {group.keys.map(([keys, action]) => (
              <div key={keys}>
                <dt>
                  <kbd>{keys}</kbd>
                </dt>
                <dd>{action}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <div className="dialog-actions">
        <button type="button" className="btn" autoFocus onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  )
}
