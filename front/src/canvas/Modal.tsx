import { useEffect, useRef } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  labelledBy: string
  className?: string
  children: React.ReactNode
}

export default function Modal({
  open,
  onClose,
  labelledBy,
  className = '',
  children
}: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const pressedOutside = useRef(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onPointerDown={(e) => {
        pressedOutside.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (pressedOutside.current && e.target === e.currentTarget) onClose()
      }}
    >
      <div className="dialog-body">{children}</div>
    </dialog>
  )
}
