import { useState, useEffect, useCallback } from 'react'
import LoginPage from './LoginPage'
import './App.css'

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [children, setChildren] = useState<Array<{id:number, first_name:string}>>([])
  const [firstName, setFirstName] = useState('')
  const [accessCode, setAccessCode] = useState('')

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

  const handleLogin = (tok: string) => {
    setToken(tok)
  }

  const handleLogout = () => {
    setToken(null)
    localStorage.removeItem('token')
  }

  useEffect(() => {
    fetchChildren()
  }, [token, fetchChildren])

  if (!token) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <div id="app">
      <h1>Uncle Jon's Bank</h1>
      <p>You are logged in.</p>
      <div>
        <h3>Your Children</h3>
        <ul>
          {children.map(c => (
            <li key={c.id}>{c.first_name}</li>
          ))}
        </ul>
        <form onSubmit={async e => {
          e.preventDefault()
          setErrorMessage(null) // Clear any previous error message
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
