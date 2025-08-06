import { useEffect, useState } from 'react'
import MessageDetail from '../components/MessageDetail'
import ComposeMessage from '../components/ComposeMessage'

interface Message {
  id: number
  subject: string
  body: string
  created_at: string
  sender_user_id?: number
  sender_child_id?: number
  recipient_user_id?: number
  recipient_child_id?: number
  read: boolean
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
  const [options, setOptions] = useState<{ id: number; label: string }[]>([])
  const [userNames, setUserNames] = useState<Record<number, string>>({})
  const [childNames, setChildNames] = useState<Record<number, string>>({})
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [showCompose, setShowCompose] = useState(false)
  const [composeDefaults, setComposeDefaults] = useState<{ subject?: string; recipient?: string; target?: string }>({})

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

  const openMessage = async (m: Message) => {
    const resp = await fetch(`${apiUrl}/messages/${m.id}`, { headers })
    if (resp.ok) {
      const data: Message = await resp.json()
      setSelectedMessage(data)
      setMessages(prev => prev.map(msg => (msg.id === m.id ? { ...msg, read: true } : msg)))
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

  const handleReply = (m: Message) => {
    setComposeDefaults({
      subject: m.subject.startsWith('Re: ') ? m.subject : `Re: ${m.subject}`,
      ...(isAdmin
        ? tab === 'inbox'
          ? m.sender_child_id != null
            ? { target: `child:${m.sender_child_id}` }
            : m.sender_user_id != null
              ? { recipient: String(m.sender_user_id), target: 'all' }
              : {}
          : m.recipient_child_id != null
            ? { target: `child:${m.recipient_child_id}` }
            : m.recipient_user_id != null
              ? { recipient: String(m.recipient_user_id), target: 'all' }
              : {}
        : isChild
          ? tab === 'inbox'
            ? m.sender_user_id != null
              ? { recipient: String(m.sender_user_id) }
              : {}
            : m.recipient_user_id != null
              ? { recipient: String(m.recipient_user_id) }
              : {}
          : tab === 'inbox'
            ? m.sender_child_id != null
              ? { recipient: String(m.sender_child_id) }
              : {}
            : m.recipient_child_id != null
              ? { recipient: String(m.recipient_child_id) }
              : {})
    })
    setShowCompose(true)
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
    <>
      <div className="messages-page">
        <div className="messages-sidebar">
          <h2>Messages</h2>
          <button onClick={() => setTab('inbox')}>Inbox</button>
          <button onClick={() => setTab('sent')}>Sent</button>
          <button onClick={() => setTab('archive')}>Archive</button>
          <button onClick={() => { setComposeDefaults({}); setShowCompose(true) }}>Compose</button>
        </div>
        <div className="message-list-pane">
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
                      className={`message-row${selectedMessage?.id === m.id ? ' selected' : ''}${!m.read ? ' unread' : ''}`}
                      onClick={() => openMessage(m)}
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
        </div>
        <div className="message-detail-pane">
          {selectedMessage && (
            <MessageDetail
              message={selectedMessage}
              isInbox={tab === 'inbox'}
              getName={getName}
              onArchive={archive}
              onReply={handleReply}
            />
          )}
        </div>
      </div>
      {showCompose && (
        <ComposeMessage
          token={token}
          apiUrl={apiUrl}
          isChild={isChild}
          isAdmin={isAdmin}
          options={options}
          initialSubject={composeDefaults.subject}
          initialRecipient={composeDefaults.recipient}
          initialTarget={composeDefaults.target}
          onClose={() => setShowCompose(false)}
          onSent={fetchMessages}
        />
      )}
    </>
  )
}
