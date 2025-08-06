import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ConfirmModal from '../components/ConfirmModal'
import LedgerTable from '../components/LedgerTable'
import { formatCurrency } from '../utils/currency'
import { useToast } from '../components/ToastProvider'

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

interface RecurringCharge {
  id: number
  child_id: number
  amount: number
  type: string
  memo?: string | null
  interval_days: number
  next_run: string
  active: boolean
}

interface Props {
  token: string
  childId: number
  apiUrl: string
  onLogout: () => void
  currencySymbol: string
}

interface CdOffer {
  id: number
  amount: number
  interest_rate: number
  term_days: number
  status: string
  matures_at?: string | null
}

export default function ChildDashboard({ token, childId, apiUrl, onLogout, currencySymbol }: Props) {
  const [ledger, setLedger] = useState<LedgerResponse | null>(null)
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [cds, setCds] = useState<CdOffer[]>([])
  const [charges, setCharges] = useState<RecurringCharge[]>([])
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawMemo, setWithdrawMemo] = useState('')
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [childName, setChildName] = useState('')
  const [tableWidth, setTableWidth] = useState<number>()
  const { showToast } = useToast()
  const [loadingLedger, setLoadingLedger] = useState(false)

  const fetchLedger = useCallback(async () => {
    setLoadingLedger(true)
    try {
      const resp = await fetch(`${apiUrl}/transactions/child/${childId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (resp.ok) setLedger(await resp.json())
      else showToast('Failed to load ledger', 'error')
    } finally {
      setLoadingLedger(false)
    }
  }, [apiUrl, childId, token, showToast])

  const fetchMyWithdrawals = useCallback(async () => {
    const resp = await fetch(`${apiUrl}/withdrawals/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) setWithdrawals(await resp.json())
  }, [apiUrl, token])

  const cancelWithdrawal = async (id: number) => {
    const resp = await fetch(`${apiUrl}/withdrawals/${id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) {
      showToast('Withdrawal cancelled')
      fetchMyWithdrawals()
    } else {
      showToast('Failed to cancel', 'error')
    }
  }

  const fetchCds = useCallback(async () => {
    const resp = await fetch(`${apiUrl}/cds/child`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) setCds((await resp.json()) as CdOffer[])
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

  const fetchCharges = useCallback(async () => {
    const resp = await fetch(`${apiUrl}/recurring/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) setCharges(await resp.json())
  }, [apiUrl, token])

  useEffect(() => {
    fetchLedger()
    fetchMyWithdrawals()
    fetchChildName()
    fetchCds()
    fetchCharges()
  }, [fetchLedger, fetchMyWithdrawals, fetchChildName, fetchCds, fetchCharges])

  return (
    <div className="container" style={{ width: tableWidth ? `${tableWidth}px` : undefined }}>
      <h2>{childName ? `${childName}'s Account` : 'Your Ledger'}</h2>
      {loadingLedger ? (
        <p>Loading...</p>
      ) : (
        ledger && (
        <>
          <p>Balance: {formatCurrency(ledger.balance, currencySymbol)}</p>
          <p className="help-text">
            This is how much money you have right now. Money you add makes it go up. Money you spend makes it go down.
          </p>
          <LedgerTable
            transactions={ledger.transactions}
            onWidth={w => !tableWidth && setTableWidth(w)}
            currencySymbol={currencySymbol}
          />
        </>
        )
      )}
      <div>
        <h4>Borrowing Money (Loans)</h4>
        <p className="help-text">
          Need to buy something but don't have enough saved? You can ask your grown-up for a loan.
          A loan lets you borrow money now and pay it back later, sometimes with a little extra called interest.
          Visit the <Link to="/child/loans">Loans</Link> page to request one or see what you owe.
        </p>
      </div>
      {charges.length > 0 && (
        <div>
          <h4>Automatic Money Moves</h4>
          <p className="help-text">
            These happen on their own, like getting allowance every week.
          </p>
          <ul className="list">
            {charges.map(c => (
              <li key={c.id}>
                A {c.type} of {formatCurrency(c.amount, currencySymbol)} every {c.interval_days} day(s), next on {new Date(c.next_run + "T00:00:00").toLocaleDateString()} {c.memo ? `(Memo: ${c.memo})` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      {cds.length > 0 && (
        <div>
          <h4>Special Savings Offers (CDs)</h4>
          <p className="help-text">
            A CD (Certificate of Deposit) is like a special piggy bank. You agree to leave your money in for a set time and earn extra money called interest.
          </p>
          <ul className="list">
            {cds.map(cd => {
              const daysLeft = cd.matures_at
                ? Math.ceil((new Date(cd.matures_at).getTime() - Date.now()) / 86400000)
                : null
              return (
                <li key={cd.id}>
                  {formatCurrency(cd.amount, currencySymbol)} for {cd.term_days} days at {(cd.interest_rate * 100).toFixed(2)}% - {cd.status}
                  {cd.status === 'accepted' && daysLeft !== null && (
                    <span> (redeems in {daysLeft} days)</span>
                  )}
                  {cd.status === 'accepted' && daysLeft !== null && daysLeft > 0 && (
                    <button
                      onClick={() =>
                        setConfirmAction({
                          message:
                            'Take out this CD early? A 10% fee will be taken.',
                          onConfirm: async () => {
                            await fetch(`${apiUrl}/cds/${cd.id}/redeem-early`, {
                              method: 'POST',
                              headers: { Authorization: `Bearer ${token}` },
                            })
                            fetchCds()
                            fetchLedger()
                          },
                        })
                      }
                      className="ml-05"
                    >
                      Take Money Early
                    </button>
                  )}
                  {cd.status === 'offered' && (
                    <>
                      <button
                        onClick={async () => {
                          await fetch(`${apiUrl}/cds/${cd.id}/accept`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` },
                          })
                          fetchCds()
                          fetchLedger()
                        }}
                        className="ml-1"
                      >
                        Yes, Save It
                      </button>
                      <button
                        onClick={async () => {
                          await fetch(`${apiUrl}/cds/${cd.id}/reject`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` },
                          })
                          fetchCds()
                        }}
                        className="ml-05"
                      >
                        No Thanks
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <form
        onSubmit={async e => {
          e.preventDefault()
          if (!withdrawAmount) return
          const resp = await fetch(`${apiUrl}/withdrawals/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ amount: Number(withdrawAmount), memo: withdrawMemo || null }),
          })
          if (resp.ok) {
            showToast('Withdrawal requested')
            setWithdrawAmount('')
            setWithdrawMemo('')
            fetchMyWithdrawals()
          } else {
            showToast('Failed to send request', 'error')
          }
        }}
        className="form"
      >
        <h4>Ask to Take Out Money</h4>
        <p className="help-text">
          A withdrawal is asking your grown-up to send money to you. They have to say yes before you get it.
        </p>
        <label>
          How much?
          ${currencySymbol}<input
            type="number"
            step="0.01"
            value={withdrawAmount}
            onChange={e => setWithdrawAmount(e.target.value)}
            required
          />
        </label>
        <label>
          Note for your grown-up
          <input
            placeholder="Optional note"
            value={withdrawMemo}
            onChange={e => setWithdrawMemo(e.target.value)}
          />
        </label>
        <button type="submit">Send Request</button>
      </form>
      {withdrawals.length > 0 && (
        <div>
          <h4>Your Money Requests</h4>
          <p className="help-text">Pending means waiting for a grown-up to decide.</p>
          <ul className="list">
              {withdrawals.map(w => (
                <li key={w.id}>
                  {formatCurrency(w.amount, currencySymbol)}{w.memo ? ` (${w.memo})` : ''} - {w.status}
                  {w.status === 'pending' && (
                    <button
                      className="ml-05"
                      onClick={() =>
                        setConfirmAction({
                          message: 'Cancel this request?',
                          onConfirm: () => cancelWithdrawal(w.id),
                        })
                      }
                    >
                      Cancel
                    </button>
                  )}
                  {w.denial_reason ? ` (Reason: ${w.denial_reason})` : ''}
                </li>
              ))}
          </ul>
        </div>
      )}
      <button onClick={onLogout}>Logout</button>
      {confirmAction && (
        <ConfirmModal
          message={confirmAction.message}
          onConfirm={() => {
            confirmAction.onConfirm()
            setConfirmAction(null)
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  )
}
