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
  const [userNames, setUserNames] = useState<Record<number, string>>({})
  const [childNames, setChildNames] = useState<Record<number, string>>({})
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
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
    setSelectedMessage(null)
  }, [tab])

  useEffect(() => {
    const loadOptions = async () => {
      if (isAdmin) {
        const [usersResp, childrenResp] = await Promise.all([
          fetch(`${apiUrl}/admin/users`, { headers }),
          fetch(`${apiUrl}/admin/children`, { headers })
        ])
        if (usersResp.ok) {
          const users: { id: number; name: string }[] = await usersResp.json()
          const names: Record<number, string> = {}
          users.forEach(u => {
            names[u.id] = u.name
          })
          setUserNames(names)
        }
        if (childrenResp.ok) {
          const children: { id: number; first_name: string }[] = await childrenResp.json()
          const optionsList = children.map(c => ({
            id: c.id,
            label: c.first_name
          }))
          const cNames: Record<number, string> = {}
          optionsList.forEach(o => {
            cNames[o.id] = o.label
          })
          setChildNames(cNames)
          setOptions(optionsList)
        }
      } else if (isChild) {
        const resp = await fetch(`${apiUrl}/children/me/parents`, { headers })
        if (resp.ok) {
          const data: { user_id: number; name: string }[] = await resp.json()
          const names: Record<number, string> = {}
          const opts = data.map(p => {
            names[p.user_id] = p.name
            return { id: p.user_id, label: p.name }
          })
          setUserNames(names)
          setOptions(opts)
        }
      } else {
        const resp = await fetch(`${apiUrl}/children/`, { headers })
        if (resp.ok) {
          const data: { id: number; first_name: string }[] = await resp.json()
          const names: Record<number, string> = {}
          const opts = data.map(c => {
            names[c.id] = c.first_name
            return { id: c.id, label: c.first_name }
          })
          setChildNames(names)
          setOptions(opts)
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
      if (selectedMessage?.id === id) {
        setSelectedMessage(null)
      }
    }
  }

  const getName = (userId?: number, childId?: number) => {
    if (userId != null) {
      return userNames[userId] ?? (isAdmin ? 'Unknown user' : 'Admin')
    }
    if (childId != null) {
      return childNames[childId] ?? 'Unknown child'
    }
    return 'Unknown'
  }
  const label = tab === 'inbox' ? 'From' : 'To'

  return (
    <div className="messages">
      <h2>Messages</h2>
      <div>
        <button onClick={() => setTab('inbox')}>Inbox</button>
        <button onClick={() => setTab('sent')}>Sent</button>
        <button onClick={() => setTab('archive')}>Archive</button>
      </div>
      <div className="table-wrapper">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>{label}</th>
              <th>Subject</th>
              <th>Preview</th>
              <th>Date</th>
              {tab === 'inbox' && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {messages.map(m => {
              const name =
                tab === 'inbox'
                  ? getName(m.sender_user_id, m.sender_child_id)
                  : getName(m.recipient_user_id, m.recipient_child_id)
              const raw = m.body.replace(/<[^>]+>/g, '')
              const preview = raw.slice(0, 100)
              const isTruncated = raw.length > 100
              return (
                <tr
                  key={m.id}
                  className={`message-row${selectedMessage?.id === m.id ? ' selected' : ''}`}
                  onClick={() => setSelectedMessage(m)}
                >
                  <td>{name}</td>
                  <td>{m.subject}</td>
                  <td>
                    {preview}
                    {isTruncated ? '…' : ''}
                  </td>
                  <td>{new Date(m.created_at).toLocaleString()}</td>
                  {tab === 'inbox' && (
                    <td>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          archive(m.id)
                        }}
                      >
                        Archive
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {selectedMessage && (
        <div className="detail-panel">
          <h3>{selectedMessage.subject}</h3>
          <p>
            {tab === 'inbox'
              ? `From ${getName(
                  selectedMessage.sender_user_id,
                  selectedMessage.sender_child_id
                )}`
              : `To ${getName(
                  selectedMessage.recipient_user_id,
                  selectedMessage.recipient_child_id
                )}`}
            {` ${new Date(selectedMessage.created_at).toLocaleString()}`}
          </p>
          <div dangerouslySetInnerHTML={{ __html: selectedMessage.body }} />
          {tab === 'inbox' && (
            <button onClick={() => archive(selectedMessage.id)}>Archive</button>
          )}
        </div>
      )}
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
