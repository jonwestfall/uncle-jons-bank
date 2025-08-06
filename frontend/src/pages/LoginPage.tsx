import { useState, useEffect } from 'react'

import { Link } from 'react-router-dom'
import CreateAdminModal from '../components/CreateAdminModal'

interface Props {
  onLogin: (token: string, isChild: boolean) => void
  siteName: string
  allowRegister?: boolean
}

export default function LoginPage({ onLogin, siteName, allowRegister = false }: Props) {
  const [isChild, setIsChild] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [error, setError] = useState('')
  const [needsAdmin, setNeedsAdmin] = useState(false)
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

  useEffect(() => {
    const check = async () => {
      try {
        const resp = await fetch(`${apiUrl}/needs-admin`)
        if (resp.ok) {
          const data = await resp.json()
          if (data.needs_admin) setNeedsAdmin(true)
        }
      } catch {
        /* ignore */
      }
    }
    check()
  }, [apiUrl])

  const handleCreateAdmin = async (name: string, email: string, password: string) => {
    setError('')
    try {
      const resp = await fetch(`${apiUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      })
      if (!resp.ok) {
        throw new Error('Admin creation failed')
      }
      const loginResp = await fetch(`${apiUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      if (!loginResp.ok) {
        throw new Error('Login failed')
      }
      const data = await loginResp.json()
      onLogin(data.access_token, false)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Admin setup failed')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const url = apiUrl + (isChild ? '/children/login' : '/login')
      const body = isChild ? { access_code: accessCode } : { email, password }
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!resp.ok) {
        if (resp.status === 403) {
          throw new Error('Account frozen')
        }
        throw new Error('Login failed')
      }
      const data = await resp.json()
      onLogin(data.access_token, isChild)
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Invalid credentials')
      }
    }
  }

  return (
    <div className="container">
      {needsAdmin && <CreateAdminModal onSubmit={handleCreateAdmin} />}
      <div className="logo-wrapper">
        <img src="/unclejon.jpg" alt={siteName + ' Logo'} className="logo" />
      </div>
      <h1>{siteName}</h1>
      Welcome to your bank! We're glad to have you here. Your grown-up should have given you a special access code to use to log in. Keep it secret - it's your key to your financial future!
      <h2>Login</h2>
     
      <form onSubmit={handleSubmit} className="form">
        {isChild ? (
          <div className="form-group">
            <label>Access Code:</label>
            <input value={accessCode} onChange={e => setAccessCode(e.target.value)} required />
          </div>
        ) : (
          <>
            <div className="form-group">
              <label>Email:</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Password:</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
          </>
        )}
        <button type="submit">Login</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {allowRegister && (
        <p>
          <Link to="/register">Request a parent account</Link>
        </p>
      )}
       <button onClick={() => setIsChild(!isChild)} className="mb-1">
        {isChild ? 'Parent Login' : 'Account Holder (Child) Login'}
      </button>
    </div>
  )
}
