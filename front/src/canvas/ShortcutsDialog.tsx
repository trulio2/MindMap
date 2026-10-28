import { useEffect, useRef } from 'react'

const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl'
const alt = isMac ? '⌥' : 'Alt'

const groups: { title: string; keys: [string, string][] }[] = [
  {
    title: 'Create',
    keys: [
      ['Double-click canvas', 'New topic'],
      ['Drag from a dot', 'Connect, or drop on empty space for a new topic'],
      [`${mod} V`, 'Paste an image, link or text'],
      [`${mod} D`, 'Duplicate selection']
    ]
  },
  {
    title: 'Edit',
    keys: [
      ['Enter or F2', 'Rename the selected node'],
      ['Double-click', 'Edit a node or connection label'],
      ['Delete', 'Delete selection'],
      [`${mod} Z`, 'Undo'],
      [`${mod} Shift Z`, 'Redo']
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
      ['?', 'Show this list']
    ]
  }
]

type Props = { open: boolean; onClose: () => void }

export default function ShortcutsDialog({ open, onClose }: Props) {
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
      className="dialog shortcuts"
      aria-labelledby="shortcuts-title"
      onClose={onClose}
    >
      <h2 id="shortcuts-title">Keyboard shortcuts</h2>
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
