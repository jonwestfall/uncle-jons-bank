import { useState, useEffect, useCallback } from 'react'
import LedgerTable from '../components/LedgerTable'

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
  childId: number
  apiUrl: string
  onLogout: () => void
}

export default function ChildDashboard({ token, childId, apiUrl, onLogout }: Props) {
  const [ledger, setLedger] = useState<LedgerResponse | null>(null)
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawMemo, setWithdrawMemo] = useState('')
  const [childName, setChildName] = useState('')
  const [tableWidth, setTableWidth] = useState<number>()

  const fetchLedger = useCallback(async () => {
    const resp = await fetch(`${apiUrl}/transactions/child/${childId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) setLedger(await resp.json())
  }, [apiUrl, childId, token])

  const fetchMyWithdrawals = useCallback(async () => {
    const resp = await fetch(`${apiUrl}/withdrawals/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) setWithdrawals(await resp.json())
  }, [apiUrl, token])

  const fetchChildName = useCallback(async () => {
    const resp = await fetch(`${apiUrl}/children/${childId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) {
      const data = await resp.json()
      setChildName(data.first_name)
    }
  }, [apiUrl, childId, token])

  useEffect(() => {
    fetchLedger()
    fetchMyWithdrawals()
    fetchChildName()
  }, [fetchLedger, fetchMyWithdrawals, fetchChildName])

  return (
    <div className="container" style={{ width: tableWidth ? `${tableWidth}px` : undefined }}>
      <h2>{childName ? `${childName}'s Account` : 'Your Ledger'}</h2>
      {ledger && (
        <>
          <p>Balance: {ledger.balance.toFixed(2)}</p>
          <LedgerTable transactions={ledger.transactions} onWidth={w => !tableWidth && setTableWidth(w)} />
        </>
      )}
      <form
        onSubmit={async e => {
          e.preventDefault()
          if (!withdrawAmount) return
          await fetch(`${apiUrl}/withdrawals/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ amount: Number(withdrawAmount), memo: withdrawMemo || null }),
          })
          setWithdrawAmount('')
          setWithdrawMemo('')
          fetchMyWithdrawals()
        }}
        className="form"
      >
        <h4>Request Withdrawal</h4>
        <input type="number" step="0.01" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} required />
        <input placeholder="Memo" value={withdrawMemo} onChange={e => setWithdrawMemo(e.target.value)} />
        <button type="submit">Submit</button>
      </form>
      {withdrawals.length > 0 && (
        <div>
          <h4>Your Requests</h4>
          <ul className="list">
            {withdrawals.map(w => (
              <li key={w.id}>
                {w.amount} - {w.status}
                {w.denial_reason ? ` (Reason: ${w.denial_reason})` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      <button onClick={onLogout}>Logout</button>
    </div>
  )
}
