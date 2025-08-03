import { useCallback, useEffect, useState } from 'react'
import { formatCurrency } from '../utils/currency'

interface Child {
  id: number
  first_name: string
}

interface Loan {
  id: number
  amount: number
  purpose?: string | null
  interest_rate: number
  status: string
  principal_remaining: number
  terms?: string | null
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

  const fetchChildren = useCallback(async () => {
    const resp = await fetch(`${apiUrl}/children/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) setChildren(await resp.json())
  }, [apiUrl, token])

  const fetchLoans = useCallback(
    async (cid: number) => {
      const resp = await fetch(`${apiUrl}/loans/child/${cid}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (resp.ok) setLoans(await resp.json())
    },
    [apiUrl, token],
  )

  useEffect(() => {
    fetchChildren()
  }, [fetchChildren])

  useEffect(() => {
    if (selectedChild) fetchLoans(selectedChild)
  }, [selectedChild, fetchLoans])

  const approveLoan = async (loanId: number) => {
    const body = {
      interest_rate: parseFloat(approveRate[loanId] || '0'),
      terms: approveTerms[loanId] || undefined,
    }
    await fetch(`${apiUrl}/loans/${loanId}/approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    fetchLoans(selectedChild!)
  }

  const denyLoan = async (loanId: number) => {
    await fetch(`${apiUrl}/loans/${loanId}/deny`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    fetchLoans(selectedChild!)
  }

  const recordPayment = async (loanId: number) => {
    await fetch(`${apiUrl}/loans/${loanId}/payment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount: parseFloat(paymentAmount[loanId] || '0') }),
    })
    setPaymentAmount({ ...paymentAmount, [loanId]: '' })
    fetchLoans(selectedChild!)
  }

  const closeLoan = async (loanId: number) => {
    await fetch(`${apiUrl}/loans/${loanId}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    fetchLoans(selectedChild!)
  }

  return (
    <div className="container">
      <h2>Manage Loans</h2>
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
              {l.status === 'requested' && (
                <div>
                  <input
                    placeholder="Interest rate"
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

