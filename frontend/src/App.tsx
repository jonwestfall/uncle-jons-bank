import { useState, useEffect, useCallback } from 'react'
import LoginPage from './LoginPage'
import AdminPanel from './AdminPanel'
import './App.css'

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

interface ChildApi {
  id: number
  first_name: string
  account_frozen?: boolean
  frozen?: boolean
  interest_rate?: number
  total_interest_earned?: number
}

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [isChildAccount, setIsChildAccount] = useState<boolean>(() => localStorage.getItem('isChild') === 'true')
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [childId, setChildId] = useState<number | null>(() => {
    const stored = localStorage.getItem('childId')
    return stored ? Number(stored) : null
  })
  const path = window.location.pathname
  const [children, setChildren] = useState<Array<{id:number, first_name:string, frozen:boolean, interest_rate?:number, total_interest_earned?:number}>>([])
  const [firstName, setFirstName] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [ledger, setLedger] = useState<LedgerResponse | null>(null)
  const [selectedChild, setSelectedChild] = useState<number | null>(null)
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [pendingWithdrawals, setPendingWithdrawals] = useState<WithdrawalRequest[]>([])
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawMemo, setWithdrawMemo] = useState('')
  const [txType, setTxType] = useState('credit')
  const [txAmount, setTxAmount] = useState('')
  const [txMemo, setTxMemo] = useState('')

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

  const fetchMe = useCallback(async () => {
    if (!token) return
    const resp = await fetch(`${apiUrl}/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (resp.ok) {
      const data = await resp.json()
      setIsAdmin(data.role === 'admin')
    }
  }, [token, apiUrl])

  const fetchChildren = useCallback(async () => {
    if (!token) return
    const resp = await fetch(`${apiUrl}/children`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (resp.ok) {
      const data: ChildApi[] = await resp.json()
      setChildren(
        data.map(c => ({
          id: c.id,
          first_name: c.first_name,
          frozen: c.frozen ?? c.account_frozen ?? false,
          interest_rate: c.interest_rate,
          total_interest_earned: c.total_interest_earned
        }))
      )
    }
  }, [token, apiUrl])

  const fetchLedger = useCallback(async (cid: number) => {
    if (!token) return
    const resp = await fetch(`${apiUrl}/transactions/child/${cid}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (resp.ok) {
      setLedger(await resp.json())
      setSelectedChild(cid)
    }
  }, [token, apiUrl])

  const fetchMyWithdrawals = useCallback(async () => {
    if (!token) return
    const resp = await fetch(`${apiUrl}/withdrawals/mine`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (resp.ok) {
      setWithdrawals(await resp.json())
    }
  }, [token, apiUrl])

  const fetchPendingWithdrawals = useCallback(async () => {
    if (!token) return
    const resp = await fetch(`${apiUrl}/withdrawals`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (resp.ok) {
      setPendingWithdrawals(await resp.json())
    }
  }, [token, apiUrl])

  const toggleFreeze = async (childId: number, frozen: boolean) => {
    if (!token) return
    const endpoint = frozen ? 'unfreeze' : 'freeze'
    await fetch(`${apiUrl}/children/${childId}/${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    fetchChildren()
  }

  const handleLogin = (tok: string, child: boolean) => {
    setToken(tok)
    setIsChildAccount(child)
    localStorage.setItem('token', tok)
    localStorage.setItem('isChild', String(child))
    setIsAdmin(false)
    if (child) {
      const payload = JSON.parse(atob(tok.split('.')[1]))
      const cid = parseInt(payload.sub.split(':')[1])
      setChildId(cid)
      localStorage.setItem('childId', String(cid))
      fetchLedger(cid)
      fetchMyWithdrawals()
    } else {
      fetchChildren()
      fetchPendingWithdrawals()
      fetchMe()
    }
  }

  const handleLogout = () => {
    setToken(null)
    setIsChildAccount(false)
    setChildId(null)
    setLedger(null)
    setSelectedChild(null)
    setWithdrawals([])
    setPendingWithdrawals([])
    setWithdrawAmount('')
    setWithdrawMemo('')
    setTxType('credit')
    setTxAmount('')
    setTxMemo('')
    localStorage.removeItem('token')
    localStorage.removeItem('isChild')
    localStorage.removeItem('childId')
  }

  useEffect(() => {
    if (!token) return
    fetchMe()
    if (isChildAccount && childId !== null) {
      fetchLedger(childId)
      fetchMyWithdrawals()
    } else if (!isChildAccount) {
      fetchChildren()
      fetchPendingWithdrawals()
    }
  }, [token, isChildAccount, childId, fetchChildren, fetchLedger, fetchMyWithdrawals, fetchPendingWithdrawals, fetchMe])

  if (!token) {
    return <LoginPage onLogin={handleLogin} />
  }

  if (path === '/admin') {
    if (!isAdmin) {
      return <div className="container">Access denied.</div>
    }
    return <AdminPanel token={token} apiUrl={apiUrl} onLogout={handleLogout} />
  }

  if (isChildAccount && childId !== null) {
    return (
      <div id="app" className="container">
        <img src="/uncle-jon-trans.png" alt="Uncle Jon's Bank Logo" className="logo" />
        <h1>Uncle Jon's Bank</h1>
        <h3>Your Ledger</h3>
        {ledger && (
          <div>
            <p>Balance: {ledger.balance.toFixed(2)}</p>
            <ul className="list">
              {ledger.transactions.map(tx => (
                <li key={tx.id}>
                  {new Date(tx.timestamp).toLocaleString()} - {tx.type} {tx.amount}
                  {tx.memo ? ` (${tx.memo})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
        <form onSubmit={async e => {
          e.preventDefault()
          if (!withdrawAmount) return
          await fetch(`${apiUrl}/withdrawals/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ amount: Number(withdrawAmount), memo: withdrawMemo || null })
          })
          setWithdrawAmount('')
          setWithdrawMemo('')
          fetchMyWithdrawals()
        }} className="form">
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
        <button onClick={handleLogout}>Logout</button>
      </div>
    )
  }

  return (
    <div id="app" className="container">
      <img src="/uncle-jon-trans.png" alt="Uncle Jon's Bank Logo" className="logo" />
      <h1>Uncle Jon's Bank</h1>
      <p>You are logged in.</p>
      <div>
        <h3>Your Children</h3>
        <ul className="list">
          {children.map(c => (
            <li key={c.id}>
              {c.first_name} {c.frozen && '(Frozen)'}
              <button onClick={() => toggleFreeze(c.id, c.frozen)} className="ml-1">
                {c.frozen ? 'Unfreeze' : 'Freeze'}
              </button>
              <button onClick={() => fetchLedger(c.id)} className="ml-1">
                View Ledger
              </button>
            </li>
          ))}
        </ul>
        {ledger && selectedChild !== null && (
          <div>
            <h4>Ledger for child #{selectedChild}</h4>
            <p>Balance: {ledger.balance.toFixed(2)}</p>
            {children.find(c => c.id === selectedChild) && (
              <>
                <p>
                  Interest Rate:{' '}
                  {(
                    children.find(c => c.id === selectedChild)?.interest_rate ??
                    0
                  ).toFixed(4)}
                </p>
                <p>
                  Total Interest Earned:{' '}
                  {(
                    children.find(c => c.id === selectedChild)?.total_interest_earned ??
                    0
                  ).toFixed(2)}
                </p>
                <form
                  onSubmit={async e => {
                    e.preventDefault()
                    const rate = window.prompt('New daily interest rate (e.g. 0.01 for 1%)')
                    if (!rate) return
                    await fetch(`${apiUrl}/children/${selectedChild}/interest-rate`, {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                      },
                      body: JSON.stringify({ interest_rate: Number(rate) })
                    })
                    fetchChildren()
                  }}
                >
                  <button type="submit" className="mb-1">Set Interest Rate</button>
                </form>
              </>
            )}
            <ul className="list">
              {ledger.transactions.map(tx => (
                <li key={tx.id}>
                  {new Date(tx.timestamp).toLocaleString()} - {tx.type} {tx.amount}
                  {tx.memo ? ` (${tx.memo})` : ''}
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
                          Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({
                          amount: Number(amount),
                          memo: memo || null,
                          type: type || tx.type
                        })
                      })
                      fetchLedger(selectedChild)
                    }}
                    className="ml-1"
                  >
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm('Delete transaction?')) return
                      await fetch(`${apiUrl}/transactions/${tx.id}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` }
                      })
                      fetchLedger(selectedChild)
                    }}
                    className="ml-05"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
            <form
              onSubmit={async e => {
                e.preventDefault()
                if (!selectedChild) return
                await fetch(`${apiUrl}/transactions/`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    child_id: selectedChild,
                    type: txType,
                    amount: Number(txAmount),
                    memo: txMemo || null,
                    initiated_by: 'parent',
                    initiator_id: 0
                  })
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
              <input
                placeholder="Memo"
                value={txMemo}
                onChange={e => setTxMemo(e.target.value)}
              />
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
                  <button onClick={async () => {
                    await fetch(`${apiUrl}/withdrawals/${w.id}/approve`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` }
                    })
                    fetchPendingWithdrawals()
                    if (selectedChild === w.child_id) fetchLedger(w.child_id)
                  }} className="ml-1">Approve</button>
                  <button onClick={async () => {
                    const reason = window.prompt('Reason for denial?') || ''
                    await fetch(`${apiUrl}/withdrawals/${w.id}/deny`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ reason })
                    })
                    fetchPendingWithdrawals()
                  }} className="ml-05">Deny</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <form onSubmit={async e => {
          e.preventDefault()
          setErrorMessage(null)
          try {
            const resp = await fetch(`${apiUrl}/children`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ first_name: firstName, access_code: accessCode })
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
        }} className="form">
          <h4>Add Child</h4>
          {errorMessage && <p className="error">{errorMessage}</p>}
          <input placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)} required />
          <input placeholder="Access code" value={accessCode} onChange={e => setAccessCode(e.target.value)} required />
          <button type="submit">Add</button>
        </form>
      </div>
      <button onClick={handleLogout}>Logout</button>
    </div>
  )
}

export default App
