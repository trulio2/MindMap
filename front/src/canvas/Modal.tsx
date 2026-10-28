import { useEffect, useRef } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  labelledBy: string
  className?: string
  children: React.ReactNode
}

function isOnBackdrop(e: React.MouseEvent<HTMLDialogElement>) {
  if (e.target !== e.currentTarget) return false
  const box = e.currentTarget.getBoundingClientRect()
  return (
    e.clientX < box.left ||
    e.clientX > box.right ||
    e.clientY < box.top ||
    e.clientY > box.bottom
  )
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
      onCancel={(e) => {
        if (e.target !== e.currentTarget) return
        e.preventDefault()
        onClose()
      }}
      onClose={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onPointerDown={(e) => {
        pressedOutside.current = isOnBackdrop(e)
      }}
      onClick={(e) => {
        if (pressedOutside.current && isOnBackdrop(e)) onClose()
      }}
    >
      <div className="dialog-body">{children}</div>
    </dialog>
  )
}
