interface Props {
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({ message, onConfirm, onCancel }: Props) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <p>{message}</p>
        <div className="modal-actions">
          <button onClick={onConfirm}>Yes</button>
          <button type="button" className="ml-1" onClick={onCancel}>
            No
          </button>
        </div>
      </div>
    </div>
  )
}
