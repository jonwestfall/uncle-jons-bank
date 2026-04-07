import { useCallback, useEffect, useMemo, useState } from 'react'
import MessageDetail from '../components/MessageDetail'
import ComposeMessage from '../components/ComposeMessage'
import { useToast } from '../components/ToastProvider'
import { createApiClient } from '../api/client'
import { archiveMessage, getMessage, listMessages, type Message, type MessageTab } from '../api/messages'
import { listAdminChildren, listAdminUsers } from '../api/admin'
import { getMyParents, listChildren } from '../api/children'
import { toastApiError } from '../utils/apiError'

interface Props {
  token: string
  apiUrl: string
  isChild: boolean
  isAdmin: boolean
}

export default function MessagesPage({ token, apiUrl, isChild, isAdmin }: Props) {
  const [tab, setTab] = useState<MessageTab>('inbox')
  const [messages, setMessages] = useState<Message[]>([])
  const [options, setOptions] = useState<{ id: number; label: string }[]>([])
  const [userNames, setUserNames] = useState<Record<number, string>>({})
  const [childNames, setChildNames] = useState<Record<number, string>>({})
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)
  const [showCompose, setShowCompose] = useState(false)
  const [composeDefaults, setComposeDefaults] = useState<{ subject?: string; recipient?: string; target?: string }>({})
  const { showToast } = useToast()
  const client = useMemo(
    () => createApiClient({ baseUrl: apiUrl, getToken: () => token }),
    [apiUrl, token],
  )

  const fetchMessages = useCallback(async () => {
    try {
      const data = await listMessages(client, tab)
      setMessages(data)
    } catch (error) {
      toastApiError(showToast, error, 'Failed to load messages')
    }
  }, [client, showToast, tab])

  const openMessage = async (m: Message) => {
    try {
      const data = await getMessage(client, m.id)
      setSelectedMessage(data)
      setMessages(prev => prev.map(msg => (msg.id === m.id ? { ...msg, read: true } : msg)))
    } catch (error) {
      toastApiError(showToast, error, 'Failed to open message')
    }
  }

  useEffect(() => {
    fetchMessages()
    setSelectedMessage(null)
  }, [fetchMessages])

  useEffect(() => {
    const loadOptions = async () => {
      try {
        if (isAdmin) {
          const [users, children] = await Promise.all([
            listAdminUsers(client),
            listAdminChildren(client),
          ])
          const names: Record<number, string> = {}
          users.forEach(u => {
            names[u.id] = u.name
          })
          setUserNames(names)

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
        } else if (isChild) {
          const data = await getMyParents(client)
          const names: Record<number, string> = {}
          const opts = data.map(p => {
            names[p.user_id] = p.name
            return { id: p.user_id, label: p.name }
          })
          setUserNames(names)
          setOptions(opts)
        } else {
          const data = await listChildren(client)
          const names: Record<number, string> = {}
          const opts = data.map(c => {
            names[c.id] = c.first_name
            return { id: c.id, label: c.first_name }
          })
          setChildNames(names)
          setOptions(opts)
        }
      } catch (error) {
        toastApiError(showToast, error, 'Failed to load message recipients')
      }
    }
    loadOptions()
  }, [client, isAdmin, isChild, showToast])

  const archive = async (id: number) => {
    try {
      await archiveMessage(client, id)
      fetchMessages()
      if (selectedMessage?.id === id) {
        setSelectedMessage(null)
      }
    } catch (error) {
      toastApiError(showToast, error, 'Failed to archive message')
    }
  }

  const handleReply = (m: Message) => {
    setComposeDefaults({
      subject: m.subject.startsWith('Re: ') ? m.subject : `Re: ${m.subject}`,
      ...(isAdmin
        ? tab !== 'sent'
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
          ? tab !== 'sent'
            ? m.sender_user_id != null
              ? { recipient: String(m.sender_user_id) }
              : {}
            : m.recipient_user_id != null
              ? { recipient: String(m.recipient_user_id) }
              : {}
          : tab !== 'sent'
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
  const label = tab === 'sent' ? 'To' : 'From'

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
                    tab === 'sent'
                      ? getName(m.recipient_user_id, m.recipient_child_id)
                      : getName(m.sender_user_id, m.sender_child_id)
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
              isInbox={tab !== 'sent'}
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
