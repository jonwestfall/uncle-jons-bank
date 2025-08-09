import { useEffect, useRef } from 'react'

interface Props {
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({ message, onConfirm, onCancel }: Props) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmButtonRef.current?.focus()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div className="modal-overlay">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-describedby="confirm-modal-message"
        tabIndex={-1}
      >
        <p id="confirm-modal-message">{message}</p>
        <div className="modal-actions">
          <button onClick={onConfirm} ref={confirmButtonRef}>
            Confirm
          </button>
          <button type="button" className="ml-1" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
