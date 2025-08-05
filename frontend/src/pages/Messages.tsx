import { useEffect, useState } from 'react'
import { useToast } from '../components/ToastProvider'

interface Message {
  id: number
  subject: string
  body: string
  created_at: string
  sender_user_id?: number
  sender_child_id?: number
  recipient_user_id?: number
  recipient_child_id?: number
}

interface Props {
  token: string
  apiUrl: string
  isChild: boolean
  isAdmin: boolean
}

export default function MessagesPage({ token, apiUrl, isChild, isAdmin }: Props) {
  const [tab, setTab] = useState<'inbox' | 'sent' | 'archive'>('inbox')
  const [messages, setMessages] = useState<Message[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [recipient, setRecipient] = useState('')
  const [target, setTarget] = useState('all')
  const [options, setOptions] = useState<{ id: number; label: string }[]>([])
  const { showToast } = useToast()

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }

  const fetchMessages = async () => {
    const resp = await fetch(`${apiUrl}/messages/${tab}`, { headers })
    if (resp.ok) {
      const data: Message[] = await resp.json()
      setMessages(data)
    }
  }

  useEffect(() => {
    fetchMessages()
  }, [tab])

  useEffect(() => {
    const loadOptions = async () => {
      if (isChild) {
        const resp = await fetch(`${apiUrl}/children/me/parents`, { headers })
        if (resp.ok) {
          const data = await resp.json()
          setOptions(data.map((p: any) => ({ id: p.user_id, label: p.name })))
        }
      } else {
        const resp = await fetch(`${apiUrl}/children/`, { headers })
        if (resp.ok) {
          const data = await resp.json()
          setOptions(data.map((c: any) => ({ id: c.id, label: c.first_name })))
        }
      }
    }
    loadOptions()
  }, [])

  const send = async () => {
    let resp: Response | undefined
    if (isAdmin) {
      if (target.startsWith('child:')) {
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
      const payload: any = { subject, body }
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
      setSubject('')
      setBody('')
      setRecipient('')
      setTarget('all')
      fetchMessages()
    }
  }

  const archive = async (id: number) => {
    const resp = await fetch(`${apiUrl}/messages/${id}/archive`, {
      method: 'POST',
      headers
    })
    if (resp.ok) {
      fetchMessages()
    }
  }

  return (
    <div className="messages">
      <h2>Messages</h2>
      <div>
        <button onClick={() => setTab('inbox')}>Inbox</button>
        <button onClick={() => setTab('sent')}>Sent</button>
        <button onClick={() => setTab('archive')}>Archive</button>
      </div>
      <ul>
        {messages.map(m => {
          const id =
            tab === 'inbox'
              ? m.sender_user_id ?? m.sender_child_id
              : m.recipient_user_id ?? m.recipient_child_id
          const label = tab === 'inbox' ? 'From' : 'To'
          return (
            <li key={m.id}>
              <div>
                <strong>{m.subject}</strong>
                <span>
                  {` ${label} ${id ?? 'Unknown'}`}
                </span>
                <span> {new Date(m.created_at).toLocaleString()}</span>
              </div>
              {tab === 'inbox' && (
                <button onClick={() => archive(m.id)}>Archive</button>
              )}
            </li>
          )
        })}
      </ul>
      <h3>Compose</h3>
      {isAdmin ? (
        <select value={target} onChange={e => setTarget(e.target.value)}>
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
      <div
        className="editor"
        contentEditable
        onInput={e => setBody((e.target as HTMLDivElement).innerHTML)}
      />
      <button onClick={send}>Send</button>
    </div>
  )
}
