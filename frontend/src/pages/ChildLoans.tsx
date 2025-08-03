import { useCallback, useEffect, useState } from 'react'
import { formatCurrency } from '../utils/currency'

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
  childId: number
  apiUrl: string
  currencySymbol: string
}

export default function ChildLoans({ token, childId, apiUrl, currencySymbol }: Props) {
  const [loans, setLoans] = useState<Loan[]>([])
  const [amount, setAmount] = useState('')
  const [purpose, setPurpose] = useState('')

  const fetchLoans = useCallback(async () => {
    const resp = await fetch(`${apiUrl}/loans/child`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) setLoans(await resp.json())
  }, [apiUrl, token])

  useEffect(() => {
    fetchLoans()
  }, [fetchLoans])

  const applyLoan = async () => {
    const resp = await fetch(`${apiUrl}/loans/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ child_id: childId, amount: parseFloat(amount), purpose }),
    })
    if (resp.ok) {
      setAmount('')
      setPurpose('')
      fetchLoans()
    }
  }

  const acceptLoan = async (id: number) => {
    await fetch(`${apiUrl}/loans/${id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    fetchLoans()
  }

  const declineLoan = async (id: number) => {
    await fetch(`${apiUrl}/loans/${id}/decline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    fetchLoans()
  }

  return (
    <div className="container">
      <h2>Your Loans</h2>
      <div>
        <h4>Request a Loan</h4>
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

