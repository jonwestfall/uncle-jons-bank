import { useState, type FormEvent } from 'react'

interface Props {
  title: string
  label: string
  defaultValue?: string
  onSubmit: (value: string) => void
  onCancel: () => void
}

export default function TextPromptModal({ title, label, defaultValue = '', onSubmit, onCancel }: Props) {
  const [value, setValue] = useState(defaultValue)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(value)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h4>{title}</h4>
        <form onSubmit={handleSubmit} className="form">
          <label>
            {label}
            <input value={value} onChange={e => setValue(e.target.value)} />
          </label>
          <div className="modal-actions">
            <button type="submit">OK</button>
            <button type="button" className="ml-1" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
