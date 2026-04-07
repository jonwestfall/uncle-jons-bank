import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '../utils/currency'
import { useToast } from '../components/ToastProvider'
import { createApiClient } from '../api/client'
import { listChildren } from '../api/children'
import {
  approveLoan as approveLoanRequest,
  closeLoan as closeLoanRequest,
  denyLoan as denyLoanRequest,
  listLoansForChild,
  recordLoanPayment,
  updateLoanInterest,
  type Loan,
} from '../api/loans'
import { toastApiError } from '../utils/apiError'

interface Child {
  id: number
  first_name: string
}

interface Props {
  token: string
  apiUrl: string
  currencySymbol: string
}

export default function ParentLoans({ token, apiUrl, currencySymbol }: Props) {
  const [children, setChildren] = useState<Child[]>([])
  const [selectedChild, setSelectedChild] = useState<number | null>(null)
  const [loans, setLoans] = useState<Loan[]>([])
  const [approveRate, setApproveRate] = useState<Record<number, string>>({})
  const [approveTerms, setApproveTerms] = useState<Record<number, string>>({})
  const [paymentAmount, setPaymentAmount] = useState<Record<number, string>>({})
  const [newRate, setNewRate] = useState<Record<number, string>>({})
  const { showToast } = useToast()
  const client = useMemo(
    () => createApiClient({ baseUrl: apiUrl, getToken: () => token }),
    [apiUrl, token],
  )

  const fetchChildren = useCallback(async () => {
    try {
      setChildren(await listChildren(client))
    } catch (error) {
      toastApiError(showToast, error, 'Failed to load children')
    }
  }, [client, showToast])

  const fetchLoans = useCallback(
    async (cid: number) => {
      try {
        setLoans(await listLoansForChild(client, cid))
      } catch (error) {
        toastApiError(showToast, error, 'Failed to load loans')
      }
    },
    [client, showToast],
  )

  useEffect(() => {
    fetchChildren()
  }, [fetchChildren])

  useEffect(() => {
    if (selectedChild) fetchLoans(selectedChild)
  }, [selectedChild, fetchLoans])

  const approveLoan = async (loanId: number) => {
    try {
      await approveLoanRequest(client, loanId, {
        interest_rate: parseFloat(approveRate[loanId] || '0') / 100,
        terms: approveTerms[loanId] || undefined,
      })
      fetchLoans(selectedChild!)
    } catch (error) {
      toastApiError(showToast, error, 'Failed to approve loan')
    }
  }

  const denyLoan = async (loanId: number) => {
    try {
      await denyLoanRequest(client, loanId)
      fetchLoans(selectedChild!)
    } catch (error) {
      toastApiError(showToast, error, 'Failed to deny loan')
    }
  }

  const recordPayment = async (loanId: number) => {
    try {
      await recordLoanPayment(client, loanId, parseFloat(paymentAmount[loanId] || '0'))
      setPaymentAmount({ ...paymentAmount, [loanId]: '' })
      fetchLoans(selectedChild!)
    } catch (error) {
      toastApiError(showToast, error, 'Failed to record payment')
    }
  }

  const changeRate = async (loanId: number) => {
    try {
      await updateLoanInterest(client, loanId, parseFloat(newRate[loanId] || '0') / 100)
      setNewRate({ ...newRate, [loanId]: '' })
      fetchLoans(selectedChild!)
    } catch (error) {
      toastApiError(showToast, error, 'Failed to update interest rate')
    }
  }

  const closeLoan = async (loanId: number) => {
    try {
      await closeLoanRequest(client, loanId)
      fetchLoans(selectedChild!)
    } catch (error) {
      toastApiError(showToast, error, 'Failed to close loan')
    }
  }

  return (
    <div className="container">
      <h2>Manage Loans</h2>
      Loans are useful when your child wants to borrow money for something special, like a new game or a bike. You can approve or deny their requests, and help them learn about interest rates and payments.
      <p>Once a loan is approved, you'll see a credit in your child's account for the full loan amount. You should then deduct whatever they bought with the loan out as a new transaction (e.g., "New Phone"). </p>

      <p>Note that the system doesn't automatically parse your "terms", so if you say "0% for the first month, then 5%", you'll need to come back here after 30 days and change the interest rate to 5% from 0. </p>
      <div>
        <label>
          Child:
          <select
            value={selectedChild ?? ''}
            onChange={e => setSelectedChild(Number(e.target.value))}
          >
            <option value="" disabled>
              Select...
            </option>
            {children.map(c => (
              <option key={c.id} value={c.id}>
                {c.first_name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loans.length > 0 && (
        <ul className="list">
          {loans.map(l => (
            <li key={l.id}>
              {formatCurrency(l.amount, currencySymbol)} for {l.purpose || 'n/a'} - {l.status}
              {['approved', 'active'].includes(l.status) && (
                <div>
                  Rate: {(l.interest_rate * 100).toFixed(2)}%
                  <input
                    placeholder="New rate (%)"
                    value={newRate[l.id] || ''}
                    onChange={e =>
                      setNewRate({ ...newRate, [l.id]: e.target.value })
                    }
                  />
                  <button onClick={() => changeRate(l.id)}>Update Rate</button>
                </div>
              )}
              {l.status === 'requested' && (
                <div>
                  <input
                    placeholder="Interest rate (%)"
                    value={approveRate[l.id] || ''}
                    onChange={e =>
                      setApproveRate({ ...approveRate, [l.id]: e.target.value })
                    }
                  />
                  <input
                    placeholder="Terms"
                    value={approveTerms[l.id] || ''}
                    onChange={e =>
                      setApproveTerms({ ...approveTerms, [l.id]: e.target.value })
                    }
                  />
                  <button onClick={() => approveLoan(l.id)}>Approve</button>
                  <button onClick={() => denyLoan(l.id)}>Deny</button>
                </div>
              )}
              {l.status === 'active' && (
                <div>
                  Remaining: {formatCurrency(l.principal_remaining, currencySymbol)}
                  <input
                    placeholder="Payment amount"
                    value={paymentAmount[l.id] || ''}
                    onChange={e =>
                      setPaymentAmount({ ...paymentAmount, [l.id]: e.target.value })
                    }
                  />
                  <button onClick={() => recordPayment(l.id)}>Record Payment</button>
                  <button onClick={() => closeLoan(l.id)}>Close</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
