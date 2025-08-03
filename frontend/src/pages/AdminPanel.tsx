import { useEffect, useState } from 'react'
import EditSiteSettingsModal from '../components/EditSiteSettingsModal'
import RunPromotionModal from '../components/RunPromotionModal'
import TextPromptModal from '../components/TextPromptModal'
import ConfirmModal from '../components/ConfirmModal'
import { formatCurrency } from '../utils/currency'

interface Props {
  token: string
  apiUrl: string
  onLogout: () => void
  siteName: string
  currencySymbol: string
  onSettingsChange?: () => void
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

interface SiteSettings {
  site_name: string
  default_interest_rate: number
  default_penalty_interest_rate: number
  default_cd_penalty_rate: number
  service_fee_amount: number
  service_fee_is_percentage: boolean
  overdraft_fee_amount: number
  overdraft_fee_is_percentage: boolean
  overdraft_fee_daily: boolean
  currency_symbol: string
}

export default function AdminPanel({ token, apiUrl, onLogout, siteName, currencySymbol, onSettingsChange }: Props) {
  const [users, setUsers] = useState<User[]>([])
  const [children, setChildren] = useState<Child[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showPromoModal, setShowPromoModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editingChild, setEditingChild] = useState<Child | null>(null)
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)

  const fetchData = async () => {
    const uh = { Authorization: `Bearer ${token}` }
    const u = await fetch(`${apiUrl}/admin/users`, { headers: uh })
    if (u.ok) setUsers(await u.json())
    const c = await fetch(`${apiUrl}/admin/children`, { headers: uh })
    if (c.ok) setChildren(await c.json())
    const t = await fetch(`${apiUrl}/admin/transactions`, { headers: uh })
    if (t.ok) setTransactions(await t.json())
    const s = await fetch(`${apiUrl}/settings/`)
      if (s.ok) {
        const data = (await s.json()) as SiteSettings
        setSettings(data)
        if (onSettingsChange) onSettingsChange()
      }
  }

  useEffect(() => {
    fetchData()
  }, [token])

  return (
    <div className="container">
      <div className="logo-wrapper">
        <img src="/unclejon.jpg" alt={`${siteName} Logo`} className="logo" />
      </div>
      <h1>Admin Panel</h1>
      {settings && (
        <div>
          <h2>Site Settings</h2>
          <p>Name: {settings.site_name}</p>
          <p>Default Interest Rate: {settings.default_interest_rate}</p>
          <p>Penalty Interest Rate: {settings.default_penalty_interest_rate}</p>
          <p>CD Penalty Rate: {settings.default_cd_penalty_rate}</p>
          <p>Currency Symbol: {settings.currency_symbol}</p>
          <p>
            Service Fee: {settings.service_fee_is_percentage ? `${settings.service_fee_amount}%` : formatCurrency(settings.service_fee_amount, currencySymbol)}
          </p>
          <p>
            Overdraft Fee: {settings.overdraft_fee_is_percentage ? `${settings.overdraft_fee_amount}%` : formatCurrency(settings.overdraft_fee_amount, currencySymbol)}
            {settings.overdraft_fee_daily ? ' (daily)' : ' (once)'}
          </p>
          <button onClick={() => setShowSettingsModal(true)}>Edit</button>
        </div>
      )}
      <h2>Promotions</h2>
      <button onClick={() => setShowPromoModal(true)}>Run Promotion</button>
      <h2>Users</h2>
      <ul className="list">
        {users.map(u => (
          <li key={u.id}>
            {u.name} ({u.email}) [{u.role}]
            <button
              onClick={() => setEditingUser(u)}
              className="ml-1"
            >
              Edit
            </button>
            <button
              onClick={() =>
                setConfirm({
                  message: 'Delete user?',
                  onConfirm: async () => {
                    await fetch(`${apiUrl}/admin/users/${u.id}`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${token}` },
                    })
                    fetchData()
                  },
                })
              }
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
              onClick={() => setEditingChild(c)}
              className="ml-1"
            >
              Edit
            </button>
            <button
              onClick={() =>
                setConfirm({
                  message: 'Delete child?',
                  onConfirm: async () => {
                    await fetch(`${apiUrl}/admin/children/${c.id}`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${token}` },
                    })
                    fetchData()
                  },
                })
              }
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
            #{t.id} Child {t.child_id} {t.type} {formatCurrency(t.amount, currencySymbol)}
            {t.memo ? ` (${t.memo})` : ''}
            <button
              onClick={() =>
                setConfirm({
                  message: 'Delete transaction?',
                  onConfirm: async () => {
                    await fetch(`${apiUrl}/admin/transactions/${t.id}`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${token}` },
                    })
                    fetchData()
                  },
                })
              }
              className="ml-05"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      <button onClick={onLogout}>Logout</button>

      {showSettingsModal && settings && (
        <EditSiteSettingsModal
          settings={settings}
          token={token}
          apiUrl={apiUrl}
          onClose={() => setShowSettingsModal(false)}
          onSaved={fetchData}
        />
      )}
      {showPromoModal && (
        <RunPromotionModal
          token={token}
          apiUrl={apiUrl}
          onClose={() => setShowPromoModal(false)}
          onSaved={fetchData}
        />
      )}
      {editingUser && (
        <TextPromptModal
          title="Edit User"
          label="Name"
          defaultValue={editingUser.name}
          onCancel={() => setEditingUser(null)}
          onSubmit={async (value) => {
            await fetch(`${apiUrl}/admin/users/${editingUser.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ name: value }),
            })
            setEditingUser(null)
            fetchData()
          }}
        />
      )}
      {editingChild && (
        <TextPromptModal
          title="Edit Child"
          label="Name"
          defaultValue={editingChild.first_name}
          onCancel={() => setEditingChild(null)}
          onSubmit={async (value) => {
            await fetch(`${apiUrl}/admin/children/${editingChild.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ first_name: value }),
            })
            setEditingChild(null)
            fetchData()
          }}
        />
      )}
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={() => {
            confirm.onConfirm()
            setConfirm(null)
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
