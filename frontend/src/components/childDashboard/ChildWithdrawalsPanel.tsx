import { useState } from 'react'
import { formatCurrency } from '../../utils/currency'
import type { WithdrawalRequest } from '../../types/domain'

interface ChildWithdrawalsPanelProps {
  withdrawals: WithdrawalRequest[]
  currencySymbol: string
  onSubmitRequest: (amount: number, memo?: string | null) => Promise<boolean>
  onCancelRequest: (withdrawal: WithdrawalRequest) => void
}

export default function ChildWithdrawalsPanel({
  withdrawals,
  currencySymbol,
  onSubmitRequest,
  onCancelRequest,
}: ChildWithdrawalsPanelProps) {
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawMemo, setWithdrawMemo] = useState('')

  return (
    <>
      <form
        onSubmit={async (event) => {
          event.preventDefault()
          if (!withdrawAmount) {
            return
          }
          const success = await onSubmitRequest(Number(withdrawAmount), withdrawMemo || null)
          if (!success) {
            return
          }
          setWithdrawAmount('')
          setWithdrawMemo('')
        }}
        className="form"
      >
        <h4>Ask to Take Out Money</h4>
        <p className="help-text">
          A withdrawal is asking your grown-up to send money to you. They have to say yes before you get it.
        </p>
        <label>
          How much?
          ${currencySymbol}
          <input type="number" step="0.01" value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} required />
        </label>
        <label>
          Note for your grown-up
          <input placeholder="Optional note" value={withdrawMemo} onChange={(event) => setWithdrawMemo(event.target.value)} />
        </label>
        <button type="submit">Send Request</button>
      </form>

      {withdrawals.length > 0 && (
        <div>
          <h4>Your Money Requests</h4>
          <p className="help-text">Pending means waiting for a grown-up to decide.</p>
          <ul className="list">
            {withdrawals.map((withdrawal) => (
              <li key={withdrawal.id}>
                {formatCurrency(withdrawal.amount, currencySymbol)}
                {withdrawal.memo ? ` (${withdrawal.memo})` : ''} - {withdrawal.status}
                {withdrawal.status === 'pending' && (
                  <button className="ml-05" onClick={() => onCancelRequest(withdrawal)}>
                    Cancel
                  </button>
                )}
                {withdrawal.denial_reason ? ` (Reason: ${withdrawal.denial_reason})` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
