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
  message: Message
  isInbox: boolean
  getName: (userId?: number, childId?: number) => string
  onArchive: (id: number) => void
  onReply: (msg: Message) => void
}

export default function MessageDetail({ message, isInbox, getName, onArchive, onReply }: Props) {
  const name = isInbox
    ? getName(message.sender_user_id, message.sender_child_id)
    : getName(message.recipient_user_id, message.recipient_child_id)
  const label = isInbox ? 'From' : 'To'

  return (
    <div className="detail-panel">
      <h3>{message.subject}</h3>
      <p>
        {`${label} ${name} ${new Date(message.created_at).toLocaleString()}`}
      </p>
      <div dangerouslySetInnerHTML={{ __html: message.body }} />
      <div className="actions">
        <button onClick={() => onReply(message)}>Reply</button>
        <button onClick={() => onArchive(message.id)}>Archive</button>
      </div>
    </div>
  )
}
