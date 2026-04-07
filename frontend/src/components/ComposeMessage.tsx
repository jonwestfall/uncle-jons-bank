import { useMemo, useState } from 'react'
import { useToast } from './ToastProvider'
import { createApiClient } from '../api/client'
import { sendBroadcastMessage, sendDirectMessage } from '../api/messages'
import { toastApiError } from '../utils/apiError'

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
  const client = useMemo(
    () => createApiClient({ baseUrl: apiUrl, getToken: () => token }),
    [apiUrl, token],
  )

  const send = async () => {
    try {
      if (isAdmin) {
        if (recipient) {
          await sendDirectMessage(client, { subject, body, recipient_user_id: Number(recipient) })
        } else if (target.startsWith('child:')) {
          const childId = Number(target.split(':')[1])
          await sendDirectMessage(client, { subject, body, recipient_child_id: childId })
        } else {
          await sendBroadcastMessage(client, { subject, body, target })
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
        await sendDirectMessage(client, payload)
      }
      showToast('Message sent')
      onSent()
      onClose()
    } catch (error) {
      toastApiError(showToast, error, 'Failed to send message')
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
