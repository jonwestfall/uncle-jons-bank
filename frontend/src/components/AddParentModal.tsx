import { useState, type FormEvent } from 'react'

interface Props {
  onSubmit: (name: string, email: string, password: string) => void
  onCancel: () => void
}

export default function AddParentModal({ onSubmit, onCancel }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(name, email, password)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h4>Add Parent</h4>
        <form onSubmit={handleSubmit} className="form">
          <label>
            Name
            <input value={name} onChange={e => setName(e.target.value)} required />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </label>
          <div className="modal-actions">
            <button type="submit">Create</button>
            <button type="button" className="ml-1" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
