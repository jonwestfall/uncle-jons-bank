import { useEffect, useState } from 'react'

interface Message {
  id: number
  subject: string
  body: string
  created_at: string
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
  const [target, setTarget] = useState<'all' | 'parents' | 'children'>('all')

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }

  const fetchMessages = async () => {
    const resp = await fetch(`${apiUrl}/messages/${tab}`, { headers })
    if (resp.ok) {
      setMessages(await resp.json())
    }
  }

  useEffect(() => {
    fetchMessages()
  }, [tab])

  const send = async () => {
    if (isAdmin) {
      await fetch(`${apiUrl}/messages/broadcast`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ subject, body, target })
      })
    } else {
      const payload: any = { subject, body }
      if (isChild) {
        payload.recipient_user_id = Number(recipient)
      } else {
        payload.recipient_child_id = Number(recipient)
      }
      await fetch(`${apiUrl}/messages/`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })
    }
    setSubject('')
    setBody('')
    setRecipient('')
    fetchMessages()
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
        {messages.map(m => (
          <li key={m.id}>
            <strong>{m.subject}</strong>
          </li>
        ))}
      </ul>
      <h3>Compose</h3>
      {isAdmin ? (
        <select value={target} onChange={e => setTarget(e.target.value as any)}>
          <option value="all">All</option>
          <option value="parents">Parents</option>
          <option value="children">Children</option>
        </select>
      ) : (
        <input
          placeholder={isChild ? 'Parent ID' : 'Child ID'}
          value={recipient}
          onChange={e => setRecipient(e.target.value)}
        />
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
