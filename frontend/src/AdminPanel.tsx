import { useEffect, useState } from 'react'

interface Props {
  token: string
  apiUrl: string
  onLogout: () => void
}

interface User {
  id: number
  name: string
  email: string
  role: string
}

interface Child {
  id: number
  first_name: string
  account_frozen: boolean
  interest_rate?: number
  total_interest_earned?: number
}

interface Transaction {
  id: number
  child_id: number
  type: string
  amount: number
  memo?: string | null
  initiated_by: string
  initiator_id: number
  timestamp: string
}

export default function AdminPanel({ token, apiUrl, onLogout }: Props) {
  const [users, setUsers] = useState<User[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])

  const fetchData = async () => {
    const uh = { Authorization: `Bearer ${token}` }
    const u = await fetch(`${apiUrl}/admin/users`, { headers: uh })
    if (u.ok) setUsers(await u.json())
    const c = await fetch(`${apiUrl}/admin/children`, { headers: uh })
    if (c.ok) setChildren(await c.json())
    const t = await fetch(`${apiUrl}/admin/transactions`, { headers: uh })
    if (t.ok) setTransactions(await t.json())
  }

  useEffect(() => {
    fetchData()
  }, [token])

  return (
    <div className="container">
      <center><img src="/unclejon.jpg" alt="Uncle Jon's Bank Logo" className="logo" /></center>
      <h1>Admin Panel</h1>
      <h2>Users</h2>
      <ul className="list">
        {users.map(u => (
          <li key={u.id}>
            {u.name} ({u.email}) [{u.role}]
            <button
              onClick={async () => {
                const name = window.prompt('Name', u.name)
                if (name === null) return
                await fetch(`${apiUrl}/admin/users/${u.id}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                  },
                  body: JSON.stringify({ name })
                })
                fetchData()
              }}
              className="ml-1"
            >
              Edit
            </button>
            <button
              onClick={async () => {
                if (!confirm('Delete user?')) return
                await fetch(`${apiUrl}/admin/users/${u.id}`, {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${token}` }
                })
                fetchData()
              }}
              className="ml-05"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      <h2>Children</h2>
      <ul className="list">
        {children.map(c => (
          <li key={c.id}>
            {c.first_name} {c.account_frozen && '(Frozen)'}
            <button
              onClick={async () => {
                const name = window.prompt('Name', c.first_name)
                if (name === null) return
                await fetch(`${apiUrl}/admin/children/${c.id}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                  },
                  body: JSON.stringify({ first_name: name })
                })
                fetchData()
              }}
              className="ml-1"
            >
              Edit
            </button>
            <button
              onClick={async () => {
                if (!confirm('Delete child?')) return
                await fetch(`${apiUrl}/admin/children/${c.id}`, {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${token}` }
                })
                fetchData()
              }}
              className="ml-05"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      <h2>Transactions</h2>
      <ul className="list">
        {transactions.map(t => (
          <li key={t.id}>
            #{t.id} Child {t.child_id} {t.type} {t.amount}
            {t.memo ? ` (${t.memo})` : ''}
            <button
              onClick={async () => {
                if (!confirm('Delete transaction?')) return
                await fetch(`${apiUrl}/admin/transactions/${t.id}`, {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${token}` }
                })
                fetchData()
              }}
              className="ml-05"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      <button onClick={onLogout}>Logout</button>
    </div>
  )
}
