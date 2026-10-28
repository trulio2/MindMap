import { useEffect, useRef } from 'react'

export type ConfirmRequest = {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
}

type Props = {
  request: ConfirmRequest | null
  onClose: () => void
  /** Optional middle action, e.g. exporting before the map is replaced. */
  extra?: { label: string; onClick: () => void }
}

/** Modal confirmation built on <dialog>. Cancel has focus by default. */
export default function ConfirmDialog({ request, onClose, extra }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (request && !dialog.open) dialog.showModal()
    if (!request && dialog.open) dialog.close()
  }, [request])

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="confirm-title"
      // Escape closes the dialog natively; keep React state in sync.
      onClose={onClose}
    >
      {request && (
        <>
          <h2 id="confirm-title">{request.title}</h2>
          <p>{request.message}</p>
          <div className="dialog-actions">
            <button type="button" className="btn" autoFocus onClick={onClose}>
              Cancel
            </button>
            {extra && (
              <button type="button" className="btn" onClick={extra.onClick}>
                {extra.label}
              </button>
            )}
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                request.onConfirm()
                onClose()
              }}
            >
              {request.confirmLabel}
            </button>
          </div>
        </>
      )}
    </dialog>
  )
}
