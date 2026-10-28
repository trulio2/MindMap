import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export type MenuItem =
  | {
      label: string
      onSelect: () => void
      hint?: string
      danger?: boolean
    }
  | 'separator'

type Props = {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

const EDGE_GAP = 8

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const menu = ref.current
    if (!menu) return
    const { width, height } = menu.getBoundingClientRect()
    setPosition({
      left: Math.max(EDGE_GAP, Math.min(x, innerWidth - width - EDGE_GAP)),
      top:
        y + height + EDGE_GAP > innerHeight ? Math.max(EDGE_GAP, y - height) : y
    })
    menu.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [x, y])

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('wheel', onClose, { passive: true })
    window.addEventListener('blur', onClose)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('wheel', onClose)
      window.removeEventListener('blur', onClose)
    }
  }, [onClose])

  function onKeyDown(event: React.KeyboardEvent) {
    const buttons = [
      ...ref.current!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    ]
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape' || event.key === 'Tab') onClose()
    else if (event.key === 'ArrowDown')
      buttons[(index + 1) % buttons.length]?.focus()
    else if (event.key === 'ArrowUp')
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus()
    else return
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <div
      ref={ref}
      className="context-menu"
      role="menu"
      style={position}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item === 'separator' ? (
          <div key={i} className="context-menu-sep" role="separator" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className={item.danger ? 'danger' : undefined}
            onClick={() => {
              onClose()
              item.onSelect()
            }}
          >
            <span>{item.label}</span>
            {item.hint && <kbd>{item.hint}</kbd>}
          </button>
        )
      )}
    </div>
  )
}
