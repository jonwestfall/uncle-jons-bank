import { useCallback, useEffect, useMemo, useState } from 'react'
import ConfirmModal from '../components/ConfirmModal'
import EditSiteSettingsModal from '../components/EditSiteSettingsModal'
import EditTransactionModal from '../components/EditTransactionModal'
import LedgerTable, { type Transaction } from '../components/LedgerTable'
import RunPromotionModal from '../components/RunPromotionModal'
import AddParentModal from '../components/AddParentModal'
import { formatCurrency } from '../utils/currency'
import { useToast } from '../components/ToastProvider'
import { createApiClient } from '../api/client'
import {
  approveAdminUser,
  createParentUser,
  deleteAdminChild,
  deleteAdminTransaction,
  deleteAdminUser,
  listAdminChildren,
  listAdminTransactions,
  listAdminUsers,
  updateAdminChild,
  updateAdminUser,
  type AdminChild,
  type AdminUser,
} from '../api/admin'
import { getSettings, type SiteSettings } from '../api/settings'
import { toastApiError } from '../utils/apiError'

interface Props {
  token: string
  apiUrl: string
  onLogout: () => void
  siteName: string
  currencySymbol: string
  onSettingsChange?: () => void
}

export default function AdminPanel({ token, apiUrl, onLogout, siteName, currencySymbol, onSettingsChange }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [children, setChildren] = useState<AdminChild[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showPromoModal, setShowPromoModal] = useState(false)
  const [showAddParent, setShowAddParent] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [selectedChild, setSelectedChild] = useState<AdminChild | null>(null)
  const [childName, setChildName] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [childFrozen, setChildFrozen] = useState(false)
  const [childFilter, setChildFilter] = useState('')
  const [parentFilter, setParentFilter] = useState('')
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const { showToast } = useToast()
  const client = useMemo(
    () => createApiClient({ baseUrl: apiUrl, getToken: () => token }),
    [apiUrl, token],
  )

  const fetchData = useCallback(async () => {
    try {
      const [usersData, childrenData, transactionsData, settingsData] = await Promise.all([
        listAdminUsers(client),
        listAdminChildren(client),
        listAdminTransactions(client),
        getSettings(client),
      ])
      setUsers(usersData)
      setChildren(childrenData)
      setTransactions(transactionsData)
      const data = settingsData as SiteSettings
      setSettings(data)
      if (onSettingsChange) onSettingsChange()
    } catch (error) {
      toastApiError(showToast, error, 'Failed to load admin data')
    }
  }, [client, onSettingsChange, showToast])

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
          <p>Site URL: {settings.site_url}</p>
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
          <p>Public Registration: {settings.public_registration_disabled ? 'Disabled' : 'Enabled'}</p>
          <button onClick={() => setShowSettingsModal(true)}>Edit</button>
        </div>
      )}
      <h2>Promotions</h2>
      <button onClick={() => setShowPromoModal(true)}>Run Promotion</button>
      <h2>Users</h2>
      <button onClick={() => setShowAddParent(true)}>Add Parent</button>
      <table className="ledger-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
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
              <td>{u.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {selectedUser && (
        <div className="detail-panel">
          <h3>User Details</h3>
          <p>User ID: {selectedUser.id}</p>
          <p>Status: {selectedUser.status}</p>
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
            {selectedUser.status === 'pending' && (
              <button
                onClick={async () => {
                  try {
                    await approveAdminUser(client, selectedUser.id)
                    showToast('User approved')
                    setSelectedUser(null)
                    fetchData()
                  } catch (error) {
                    toastApiError(showToast, error, 'Failed to approve user')
                  }
                }}
              >
                Approve
              </button>
            )}
            <button
              onClick={async () => {
                try {
                  await updateAdminUser(client, selectedUser.id, { name: userName, role: userRole })
                  showToast('User updated')
                  setSelectedUser(null)
                  fetchData()
                } catch (error) {
                  toastApiError(showToast, error, 'Failed to update user')
                }
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
                    try {
                      await deleteAdminUser(client, selectedUser.id)
                      showToast('User deleted')
                      fetchData()
                    } catch (error) {
                      toastApiError(showToast, error, 'Failed to delete user')
                    }
                  },
                })
              }
            >
              Delete
            </button>
          </div>
        </div>
      )}
      {showAddParent && (
        <AddParentModal
          onSubmit={async (name, email, password) => {
            try {
              await createParentUser(client, { name, email, password })
              showToast('Parent added')
              setShowAddParent(false)
              fetchData()
            } catch (error) {
              toastApiError(showToast, error, 'Failed to add parent')
            }
          }}
          onCancel={() => setShowAddParent(false)}
        />
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
                try {
                  await updateAdminChild(client, selectedChild.id, body as { first_name: string; frozen: boolean; access_code?: string })
                  showToast('Child updated')
                  setSelectedChild(null)
                  fetchData()
                } catch (error) {
                  toastApiError(showToast, error, 'Failed to update child')
                }
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
                    try {
                      await deleteAdminChild(client, selectedChild.id)
                      showToast('Child deleted')
                      fetchData()
                    } catch (error) {
                      toastApiError(showToast, error, 'Failed to delete child')
                    }
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
                    try {
                      await deleteAdminTransaction(client, t.id)
                      showToast('Transaction deleted')
                      fetchData()
                    } catch (error) {
                      toastApiError(showToast, error, 'Failed to delete transaction')
                    }
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
