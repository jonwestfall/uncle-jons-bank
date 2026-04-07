import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import ConfirmModal from '../components/ConfirmModal'
import LedgerTable from '../components/LedgerTable'
import { formatCurrency } from '../utils/currency'
import { useToast } from '../components/ToastProvider'
import { createApiClient } from '../api/client'
import { getChildLedger, type LedgerResponse } from '../api/transactions'
import {
  cancelWithdrawal as cancelWithdrawalRequest,
  createWithdrawal,
  listMyWithdrawals,
  type WithdrawalRequest,
} from '../api/withdrawals'
import { listMyRecurring, type RecurringCharge } from '../api/recurring'
import { acceptCd, listChildCds, redeemCdEarly, rejectCd, type CdOffer } from '../api/cds'
import { getChild } from '../api/children'
import { toastApiError } from '../utils/apiError'

interface Props {
  token: string
  childId: number
  apiUrl: string
  onLogout: () => void
  currencySymbol: string
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
  const client = useMemo(
    () => createApiClient({ baseUrl: apiUrl, getToken: () => token }),
    [apiUrl, token],
  )

  const fetchLedger = useCallback(async () => {
    setLoadingLedger(true)
    try {
      setLedger(await getChildLedger(client, childId))
    } catch (error) {
      toastApiError(showToast, error, 'Failed to load ledger')
    } finally {
      setLoadingLedger(false)
    }
  }, [childId, client, showToast])

  const fetchMyWithdrawals = useCallback(async () => {
    try {
      setWithdrawals(await listMyWithdrawals(client))
    } catch (error) {
      toastApiError(showToast, error, 'Failed to load withdrawals')
    }
  }, [client, showToast])

  const cancelWithdrawal = async (id: number) => {
    try {
      await cancelWithdrawalRequest(client, id)
      showToast('Withdrawal cancelled')
      fetchMyWithdrawals()
    } catch (error) {
      toastApiError(showToast, error, 'Failed to cancel')
    }
  }

  const fetchCds = useCallback(async () => {
    try {
      setCds(await listChildCds(client))
    } catch (error) {
      toastApiError(showToast, error, 'Failed to load CD offers')
    }
  }, [client, showToast])

  const fetchChildName = useCallback(async () => {
    try {
      const data = await getChild(client, childId)
      setChildName(data.first_name)
    } catch (error) {
      toastApiError(showToast, error, 'Failed to load child profile')
    }
  }, [childId, client, showToast])

  const fetchCharges = useCallback(async () => {
    try {
      setCharges(await listMyRecurring(client))
    } catch (error) {
      toastApiError(showToast, error, 'Failed to load recurring charges')
    }
  }, [client, showToast])

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
                            try {
                              await redeemCdEarly(client, cd.id)
                              fetchCds()
                              fetchLedger()
                            } catch (error) {
                              toastApiError(showToast, error, 'Failed to redeem CD early')
                            }
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
                          try {
                            await acceptCd(client, cd.id)
                            fetchCds()
                            fetchLedger()
                          } catch (error) {
                            toastApiError(showToast, error, 'Failed to accept CD')
                          }
                        }}
                        className="ml-1"
                      >
                        Yes, Save It
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await rejectCd(client, cd.id)
                            fetchCds()
                          } catch (error) {
                            toastApiError(showToast, error, 'Failed to reject CD')
                          }
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
          try {
            await createWithdrawal(client, { amount: Number(withdrawAmount), memo: withdrawMemo || null })
            showToast('Withdrawal requested')
            setWithdrawAmount('')
            setWithdrawMemo('')
            fetchMyWithdrawals()
          } catch (error) {
            toastApiError(showToast, error, 'Failed to send request')
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
