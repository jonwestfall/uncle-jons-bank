import { useState } from 'react'
import { useToast } from './ToastProvider'

interface Option {
  id: number
  label: string
}

interface Props {
  token: string
  apiUrl: string
  isChild: boolean
  isAdmin: boolean
  options: Option[]
  onClose: () => void
  onSent: () => void
  initialSubject?: string
  initialRecipient?: string
  initialTarget?: string
}

export default function ComposeMessage({
  token,
  apiUrl,
  isChild,
  isAdmin,
  options,
  onClose,
  onSent,
  initialSubject = '',
  initialRecipient = '',
  initialTarget = 'all'
}: Props) {
  const { showToast } = useToast()
  const [subject, setSubject] = useState(initialSubject)
  const [body, setBody] = useState('')
  const [recipient, setRecipient] = useState(initialRecipient)
  const [target, setTarget] = useState(initialTarget)

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }

  const send = async () => {
    let resp: Response | undefined
    if (isAdmin) {
      if (recipient) {
        resp = await fetch(`${apiUrl}/messages/`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ subject, body, recipient_user_id: Number(recipient) })
        })
      } else if (target.startsWith('child:')) {
        const childId = Number(target.split(':')[1])
        resp = await fetch(`${apiUrl}/messages/`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ subject, body, recipient_child_id: childId })
        })
      } else {
        resp = await fetch(`${apiUrl}/messages/broadcast`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ subject, body, target })
        })
      }
    } else {
      const payload: {
        subject: string
        body: string
        recipient_user_id?: number
        recipient_child_id?: number
      } = { subject, body }
      if (isChild) {
        payload.recipient_user_id = Number(recipient)
      } else {
        payload.recipient_child_id = Number(recipient)
      }
      resp = await fetch(`${apiUrl}/messages/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })
    }
    if (resp?.ok) {
      showToast('Message sent')
      onSent()
      onClose()
    } else {
      showToast('Failed to send message', 'error')
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Compose</h3>
        <form
          className="form"
          onSubmit={e => {
            e.preventDefault()
            send()
          }}
        >
          {isAdmin ? (
            <select
              value={target}
              onChange={e => {
                setRecipient('')
                setTarget(e.target.value)
              }}
            >
              <option value="all">All</option>
              <option value="parents">Parents</option>
              <option value="children">Children</option>
              {options.map(o => (
                <option key={o.id} value={`child:${o.id}`}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <select value={recipient} onChange={e => setRecipient(e.target.value)}>
              <option value="">Select recipient</option>
              {options.map(o => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          <input
            placeholder="Subject"
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
          <textarea
            placeholder="Message"
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={5}
          />
          <div className="modal-actions">
            <button type="submit">Send</button>
            <button type="button" className="ml-1" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

