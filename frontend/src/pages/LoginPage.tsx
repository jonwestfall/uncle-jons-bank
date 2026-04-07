import { useState, useEffect, useMemo } from 'react'

import { Link } from 'react-router-dom'
import CreateAdminModal from '../components/CreateAdminModal'
import { createApiClient } from '../api/client'
import { loginChild, loginParent, needsAdmin as checkNeedsAdmin, registerParent } from '../api/auth'
import { mapApiErrorMessage } from '../utils/apiError'

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
  const client = useMemo(() => createApiClient({ baseUrl: apiUrl }), [apiUrl])

  useEffect(() => {
    const check = async () => {
      try {
        const data = await checkNeedsAdmin(client)
        if (data.needs_admin) setNeedsAdmin(true)
      } catch {
        /* ignore */
      }
    }
    check()
  }, [client])

  const handleCreateAdmin = async (name: string, email: string, password: string) => {
    setError('')
    try {
      await registerParent(client, { name, email, password })
      const data = await loginParent(client, { email, password })
      onLogin(data.access_token, false)
    } catch (err: unknown) {
      setError(mapApiErrorMessage(err, 'Admin setup failed'))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const data = isChild
        ? await loginChild(client, { access_code: accessCode })
        : await loginParent(client, { email, password })
      onLogin(data.access_token, isChild)
    } catch (err: unknown) {
      setError(mapApiErrorMessage(err, 'Invalid credentials'))
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
