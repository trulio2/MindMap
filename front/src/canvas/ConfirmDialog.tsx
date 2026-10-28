import Modal from './Modal'

export type ConfirmRequest = {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
}

type Props = {
  request: ConfirmRequest | null
  onClose: () => void
  extra?: { label: string; onClick: () => void }
}

export default function ConfirmDialog({ request, onClose, extra }: Props) {
  return (
    <Modal open={!!request} onClose={onClose} labelledBy="confirm-title">
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
    </Modal>
  )
}
