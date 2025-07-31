import { useState, useEffect, useCallback } from 'react'
import LoginPage from './LoginPage'
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

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [isChildAccount, setIsChildAccount] = useState<boolean>(() => localStorage.getItem('isChild') === 'true')
  const [childId, setChildId] = useState<number | null>(() => {
    const stored = localStorage.getItem('childId')
    return stored ? Number(stored) : null
  })
  const [children, setChildren] = useState<Array<{id:number, first_name:string, frozen:boolean}>>([])
  const [firstName, setFirstName] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [ledger, setLedger] = useState<LedgerResponse | null>(null)
  const [selectedChild, setSelectedChild] = useState<number | null>(null)

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

  const fetchChildren = useCallback(async () => {
    if (!token) return
    const resp = await fetch(`${apiUrl}/children`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (resp.ok) {
      setChildren(await resp.json())
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
    if (child) {
      const payload = JSON.parse(atob(tok.split('.')[1]))
      const cid = parseInt(payload.sub.split(':')[1])
      setChildId(cid)
      localStorage.setItem('childId', String(cid))
      fetchLedger(cid)
    } else {
      fetchChildren()
    }
  }

  const handleLogout = () => {
    setToken(null)
    setIsChildAccount(false)
    setChildId(null)
    setLedger(null)
    setSelectedChild(null)
    localStorage.removeItem('token')
    localStorage.removeItem('isChild')
    localStorage.removeItem('childId')
  }

  useEffect(() => {
    if (!token) return
    if (isChildAccount && childId !== null) {
      fetchLedger(childId)
    } else if (!isChildAccount) {
      fetchChildren()
    }
  }, [token, isChildAccount, childId, fetchChildren, fetchLedger])

  if (!token) {
    return <LoginPage onLogin={handleLogin} />
  }

  if (isChildAccount && childId !== null) {
    return (
      <div id="app">
        <h1>Uncle Jon's Bank</h1>
        <h3>Your Ledger</h3>
        {ledger && (
          <div>
            <p>Balance: {ledger.balance.toFixed(2)}</p>
            <ul>
              {ledger.transactions.map(tx => (
                <li key={tx.id}>
                  {new Date(tx.timestamp).toLocaleString()} - {tx.type} {tx.amount}
                  {tx.memo ? ` (${tx.memo})` : ''}
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
    <div id="app">
      <h1>Uncle Jon's Bank</h1>
      <p>You are logged in.</p>
      <div>
        <h3>Your Children</h3>
        <ul>
          {children.map(c => (
            <li key={c.id}>
              {c.first_name} {c.frozen && '(Frozen)'}
              <button onClick={() => toggleFreeze(c.id, c.frozen)} style={{ marginLeft: '1em' }}>
                {c.frozen ? 'Unfreeze' : 'Freeze'}
              </button>
              <button onClick={() => fetchLedger(c.id)} style={{ marginLeft: '1em' }}>
                View Ledger
              </button>
            </li>
          ))}
        </ul>
        {ledger && selectedChild !== null && (
          <div>
            <h4>Ledger for child #{selectedChild}</h4>
            <p>Balance: {ledger.balance.toFixed(2)}</p>
            <ul>
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
        }}>
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
