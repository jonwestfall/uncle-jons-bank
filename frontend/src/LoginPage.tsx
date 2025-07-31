import { useState } from 'react'

interface Props {
  onLogin: (token: string, isChild: boolean) => void
}

export default function LoginPage({ onLogin }: Props) {
  const [isChild, setIsChild] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}` + (isChild ? '/children/login' : '/login')
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
      <h2>Login</h2>
      <button onClick={() => setIsChild(!isChild)} className="mb-1">
        {isChild ? 'Switch to Parent Login' : 'Switch to Child Login'}
      </button>
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
    </div>
  )
}
