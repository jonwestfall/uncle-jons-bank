import { useState, useEffect, useCallback } from 'react'
import LedgerTable from '../components/LedgerTable'
import type { Transaction } from '../components/LedgerTable'

interface Child {
  id: number
  first_name: string
  frozen: boolean
  interest_rate?: number
  penalty_interest_rate?: number
  total_interest_earned?: number
}

interface ChildApi {
  id: number
  first_name: string
  account_frozen?: boolean
  frozen?: boolean
  interest_rate?: number
  penalty_interest_rate?: number
  total_interest_earned?: number
}

interface LedgerResponse {
  balance: number
  transactions: Transaction[]
}

interface WithdrawalRequest {
  id: number
  child_id: number
  amount: number
  memo?: string | null
  status: string
  requested_at: string
  responded_at?: string | null
  denial_reason?: string | null
}

interface Props {
  token: string
  apiUrl: string
  permissions: string[]
  onLogout: () => void
}

export default function ParentDashboard({ token, apiUrl, permissions, onLogout }: Props) {
  const [children, setChildren] = useState<Child[]>([])
  const [ledger, setLedger] = useState<LedgerResponse | null>(null)
  const [selectedChild, setSelectedChild] = useState<number | null>(null)
  const [pendingWithdrawals, setPendingWithdrawals] = useState<WithdrawalRequest[]>([])
  const [txType, setTxType] = useState('credit')
  const [txAmount, setTxAmount] = useState('')
  const [txMemo, setTxMemo] = useState('')
  const [firstName, setFirstName] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [tableWidth, setTableWidth] = useState<number>()

  const fetchChildren = useCallback(async () => {
    const resp = await fetch(`${apiUrl}/children`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) {
      const data: ChildApi[] = await resp.json()
      setChildren(
        data.map(c => ({
          id: c.id,
          first_name: c.first_name,
          frozen: c.frozen ?? c.account_frozen ?? false,
          interest_rate: c.interest_rate,
          penalty_interest_rate: c.penalty_interest_rate,
          total_interest_earned: c.total_interest_earned,
        }))
      )
    }
  }, [apiUrl, token])

  const fetchLedger = useCallback(async (cid: number) => {
    const resp = await fetch(`${apiUrl}/transactions/child/${cid}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) setLedger(await resp.json())
  }, [apiUrl, token])

  const fetchPendingWithdrawals = useCallback(async () => {
    const resp = await fetch(`${apiUrl}/withdrawals`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) setPendingWithdrawals(await resp.json())
  }, [apiUrl, token])

  useEffect(() => {
    fetchChildren()
    fetchPendingWithdrawals()
  }, [fetchChildren, fetchPendingWithdrawals])

  const toggleFreeze = async (childId: number, frozen: boolean) => {
    const endpoint = frozen ? 'unfreeze' : 'freeze'
    await fetch(`${apiUrl}/children/${childId}/${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    fetchChildren()
  }

  return (
    <div className="container" style={{ width: tableWidth ? `${tableWidth}px` : undefined }}>
      <h2>Your Children</h2>
      <ul className="list">
        {children.map(c => (
          <li key={c.id} className="child-row">
            <span>
              {c.first_name} {c.frozen && '(Frozen)'}
            </span>
            <span>
              <button onClick={() => toggleFreeze(c.id, c.frozen)} className="ml-1">
                {c.frozen ? 'Unfreeze' : 'Freeze'}
              </button>
              <button onClick={() => { fetchLedger(c.id); setSelectedChild(c.id) }} className="ml-1">
                View Ledger
              </button>
            </span>
          </li>
        ))}
      </ul>
      {ledger && selectedChild !== null && (
        <div>
          <h4>Ledger for child #{selectedChild}</h4>
          <p>Balance: {ledger.balance.toFixed(2)}</p>
          <LedgerTable
            transactions={ledger.transactions}
            onWidth={w => !tableWidth && setTableWidth(w)}
            renderActions={tx => (
              <>
                {permissions.includes('edit_transaction') && (
                  <button
                    onClick={async () => {
                      const amount = window.prompt('Amount', String(tx.amount))
                      if (amount === null) return
                      const memo = window.prompt('Memo', tx.memo || '')
                      const type = window.prompt('Type (credit/debit)', tx.type)
                      await fetch(`${apiUrl}/transactions/${tx.id}`, {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                          amount: Number(amount),
                          memo: memo || null,
                          type: type || tx.type,
                        }),
                      })
                      fetchLedger(selectedChild)
                    }}
                    className="ml-1"
                  >
                    Edit
                  </button>
                )}
                {permissions.includes('delete_transaction') && (
                  <button
                    aria-label="Delete transaction"
                    onClick={async () => {
                      if (!confirm('Delete transaction?')) return
                      await fetch(`${apiUrl}/transactions/${tx.id}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` },
                      })
                      fetchLedger(selectedChild)
                    }}
                    className="ml-05"
                  >
                    &times;
                  </button>
                )}
              </>
            )}
          />
          <form
            onSubmit={async e => {
              e.preventDefault()
              await fetch(`${apiUrl}/transactions/`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  child_id: selectedChild,
                  type: txType,
                  amount: Number(txAmount),
                  memo: txMemo || null,
                  initiated_by: 'parent',
                  initiator_id: 0,
                }),
              })
              setTxAmount('')
              setTxMemo('')
              setTxType('credit')
              fetchLedger(selectedChild)
            }}
            className="form"
          >
            <h4>Add Transaction</h4>
            <select value={txType} onChange={e => setTxType(e.target.value)}>
              <option value="credit">Credit</option>
              <option value="debit">Debit</option>
            </select>
            <input
              type="number"
              step="0.01"
              value={txAmount}
              onChange={e => setTxAmount(e.target.value)}
              required
            />
            <input placeholder="Memo" value={txMemo} onChange={e => setTxMemo(e.target.value)} />
            <button type="submit">Add</button>
          </form>
        </div>
      )}
      {pendingWithdrawals.length > 0 && (
        <div>
          <h4>Pending Withdrawal Requests</h4>
          <ul className="list">
            {pendingWithdrawals.map(w => (
              <li key={w.id}>
                Child {w.child_id}: {w.amount} {w.memo ? `(${w.memo})` : ''}
                <button
                  onClick={async () => {
                    await fetch(`${apiUrl}/withdrawals/${w.id}/approve`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                    })
                    fetchPendingWithdrawals()
                    if (selectedChild === w.child_id) fetchLedger(w.child_id)
                  }}
                  className="ml-1"
                >
                  Approve
                </button>
                <button
                  onClick={async () => {
                    const reason = window.prompt('Reason for denial?') || ''
                    await fetch(`${apiUrl}/withdrawals/${w.id}/deny`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ reason }),
                    })
                    fetchPendingWithdrawals()
                  }}
                  className="ml-05"
                >
                  Deny
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <form
        onSubmit={async e => {
          e.preventDefault()
          setErrorMessage(null)
          try {
            const resp = await fetch(`${apiUrl}/children`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ first_name: firstName, access_code: accessCode }),
            })
            if (resp.ok) {
              setFirstName('')
              setAccessCode('')
              fetchChildren()
            } else {
              const errorData = await resp.json()
              setErrorMessage(errorData.message || 'Failed to add child. Please try again.')
            }
          } catch (error) {
            console.error(error)
            setErrorMessage('An unexpected error occurred. Please try again.')
          }
        }}
        className="form"
      >
        <h4>Add Child</h4>
        {errorMessage && <p className="error">{errorMessage}</p>}
        <input placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)} required />
        <input placeholder="Access code" value={accessCode} onChange={e => setAccessCode(e.target.value)} required />
        <button type="submit">Add</button>
      </form>
      <button onClick={onLogout}>Logout</button>
    </div>
  )
}
