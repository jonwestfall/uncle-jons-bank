import { useEffect, useState } from 'react'
import ConfirmModal from '../components/ConfirmModal'
import EditSiteSettingsModal from '../components/EditSiteSettingsModal'
import EditTransactionModal from '../components/EditTransactionModal'
import LedgerTable, { type Transaction } from '../components/LedgerTable'
import RunPromotionModal from '../components/RunPromotionModal'
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
  access_code?: string
  interest_rate?: number
  total_interest_earned?: number
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
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [selectedChild, setSelectedChild] = useState<Child | null>(null)
  const [childName, setChildName] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [childFrozen, setChildFrozen] = useState(false)
  const [childFilter, setChildFilter] = useState('')
  const [parentFilter, setParentFilter] = useState('')
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    setUserName(selectedUser?.name || '')
    setUserRole(selectedUser?.role || '')
  }, [selectedUser])

  useEffect(() => {
    setChildName(selectedChild?.first_name || '')
    setAccessCode(selectedChild?.access_code || '')
    setChildFrozen(selectedChild?.account_frozen || false)
  }, [selectedChild])

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
          <p>Default Interest Rate: {(settings.default_interest_rate * 100).toFixed(2)}%</p>
          <p>Penalty Interest Rate: {(settings.default_penalty_interest_rate * 100).toFixed(2)}%</p>
          <p>CD Penalty Rate: {(settings.default_cd_penalty_rate * 100).toFixed(2)}%</p>
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
      <table className="ledger-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr
              key={u.id}
              onClick={() => setSelectedUser(u)}
              className={selectedUser?.id === u.id ? 'selected' : ''}
            >
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {selectedUser && (
        <div className="detail-panel">
          <h3>User Details</h3>
          <p>User ID: {selectedUser.id}</p>
          <label>
            Name
            <input value={userName} onChange={e => setUserName(e.target.value)} />
          </label>
          <p>Email: {selectedUser.email}</p>
          <label>
            Role
            <select value={userRole} onChange={e => setUserRole(e.target.value)}>
              <option value="parent">parent</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <div className="modal-actions">
            <button
              onClick={async () => {
                await fetch(`${apiUrl}/admin/users/${selectedUser.id}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ name: userName, role: userRole }),
                })
                setSelectedUser(null)
                fetchData()
              }}
            >
              Save
            </button>
            <button className="ml-05" onClick={() => setSelectedUser(null)}>
              Cancel
            </button>
            <button
              className="ml-05"
              onClick={() =>
                setConfirm({
                  message: 'Delete user?',
                  onConfirm: async () => {
                    await fetch(`${apiUrl}/admin/users/${selectedUser.id}`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${token}` },
                    })
                    fetchData()
                  },
                })
              }
            >
              Delete
            </button>
          </div>
        </div>
      )}
      <h2>Children</h2>
      <table className="ledger-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {children.map(c => (
            <tr
              key={c.id}
              onClick={() => setSelectedChild(c)}
              className={selectedChild?.id === c.id ? 'selected' : ''}
            >
              <td>{c.first_name}</td>
              <td>{c.account_frozen ? 'Frozen' : 'Active'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {selectedChild && (
        <div className="detail-panel">
          <h3>Child Details</h3>
          <p>Child ID: {selectedChild.id}</p>
          <label>
            Name
            <input value={childName} onChange={e => setChildName(e.target.value)} />
          </label>
          <label>
            Access Code
            <input value={accessCode} onChange={e => setAccessCode(e.target.value)} />
          </label>
          <label>
            Frozen
            <input
              type="checkbox"
              checked={childFrozen}
              onChange={e => setChildFrozen(e.target.checked)}
            />
          </label>
          <div className="modal-actions">
            <button
              onClick={async () => {
                const body: Record<string, unknown> = {
                  first_name: childName,
                  frozen: childFrozen,
                }
                if (accessCode) body.access_code = accessCode
                await fetch(`${apiUrl}/admin/children/${selectedChild.id}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify(body),
                })
                setSelectedChild(null)
                fetchData()
              }}
            >
              Save
            </button>
            <button className="ml-05" onClick={() => setSelectedChild(null)}>
              Cancel
            </button>
            <button
              className="ml-05"
              onClick={() =>
                setConfirm({
                  message: 'Delete child?',
                  onConfirm: async () => {
                    await fetch(`${apiUrl}/admin/children/${selectedChild.id}`, {
                      method: 'DELETE',
                      headers: { Authorization: `Bearer ${token}` },
                    })
                    fetchData()
                  },
                })
              }
            >
              Delete
            </button>
          </div>
        </div>
      )}
      <h2>Transactions</h2>
      <div className="filter-row">
        <label>
          Child ID
          <input
            value={childFilter}
            onChange={e => setChildFilter(e.target.value)}
          />
        </label>
        <label style={{ marginLeft: '1rem' }}>
          Parent ID
          <input
            value={parentFilter}
            onChange={e => setParentFilter(e.target.value)}
          />
        </label>
      </div>
      <LedgerTable
        transactions={transactions.filter(
          t =>
            (!childFilter || t.child_id === Number(childFilter)) &&
            (!parentFilter || (t.initiated_by === 'parent' && t.initiator_id === Number(parentFilter))),
        )}
        renderActions={t => (
          <>
            <button onClick={() => setEditingTx(t)}>Edit</button>
            <button
              className="ml-05"
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
            >
              X
            </button>
          </>
        )}
        allowDownload
        currencySymbol={currencySymbol}
      />
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
      {editingTx && (
        <EditTransactionModal
          transaction={editingTx}
          token={token}
          apiUrl={apiUrl}
          onClose={() => setEditingTx(null)}
          onSuccess={fetchData}
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
