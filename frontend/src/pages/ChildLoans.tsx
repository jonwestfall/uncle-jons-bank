import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '../utils/currency'
import { useToast } from '../components/ToastProvider'
import { createApiClient } from '../api/client'
import {
  acceptLoan as acceptLoanRequest,
  applyForLoan,
  declineLoan as declineLoanRequest,
  listMyLoans,
  type Loan,
} from '../api/loans'
import { toastApiError } from '../utils/apiError'

interface Props {
  token: string
  childId: number
  apiUrl: string
  currencySymbol: string
}

export default function ChildLoans({ token, childId, apiUrl, currencySymbol }: Props) {
  const [loans, setLoans] = useState<Loan[]>([])
  const [amount, setAmount] = useState('')
  const [purpose, setPurpose] = useState('')
  const { showToast } = useToast()
  const client = useMemo(
    () => createApiClient({ baseUrl: apiUrl, getToken: () => token }),
    [apiUrl, token],
  )

  const fetchLoans = useCallback(async () => {
    try {
      setLoans(await listMyLoans(client))
    } catch (error) {
      toastApiError(showToast, error, 'Failed to load loans')
    }
  }, [client, showToast])

  useEffect(() => {
    fetchLoans()
  }, [fetchLoans])

  const applyLoan = async () => {
    try {
      await applyForLoan(client, { child_id: childId, amount: parseFloat(amount), purpose })
      setAmount('')
      setPurpose('')
      fetchLoans()
    } catch (error) {
      toastApiError(showToast, error, 'Failed to apply for loan')
    }
  }

  const acceptLoan = async (id: number) => {
    try {
      await acceptLoanRequest(client, id)
      fetchLoans()
    } catch (error) {
      toastApiError(showToast, error, 'Failed to accept loan')
    }
  }

  const declineLoan = async (id: number) => {
    try {
      await declineLoanRequest(client, id)
      fetchLoans()
    } catch (error) {
      toastApiError(showToast, error, 'Failed to decline loan')
    }
  }

  return (
    <div className="container">
      <h2>Your Loans</h2>
      <div>
                <h4>Request a Loan</h4>
                <p className="help-text">
                  Need to buy something but don't have enough saved? You can ask your grown-up for a loan.
                  A loan lets you borrow money now and pay it back later, sometimes with a little extra called interest.
                  In the boxes below, enter the amount of money you need and what you want it for. You can then apply for the loan and your grown-up can make you an offer with terms (like how long you have to pay it back and if there is any interest).
                  If they approve it, you can accept the loan and start using the money!
                </p>
        
        <input
          placeholder="Amount"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
        <input
          placeholder="Purpose"
          value={purpose}
          onChange={e => setPurpose(e.target.value)}
        />
        <button onClick={applyLoan} disabled={!amount}>Apply</button>
      </div>
      <ul className="list">
        {loans.map(l => (
          <li key={l.id}>
            {formatCurrency(l.amount, currencySymbol)} for {l.purpose || 'n/a'} - {l.status}
            {l.terms && <span> (Terms: {l.terms})</span>}
            {l.status === 'approved' && (
              <>
                {' '}
                <button onClick={() => acceptLoan(l.id)}>Accept</button>
                <button onClick={() => declineLoan(l.id)}>Decline</button>
              </>
            )}
            {l.status === 'active' && (
              <span>
                {' '}- Remaining: {formatCurrency(l.principal_remaining, currencySymbol)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
