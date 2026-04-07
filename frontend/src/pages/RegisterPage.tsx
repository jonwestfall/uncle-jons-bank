import { useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createApiClient } from '../api/client'
import { registerParent } from '../api/auth'
import { mapApiErrorMessage } from '../utils/apiError'

interface Props {
  apiUrl: string
  siteName: string
}

export default function RegisterPage({ apiUrl, siteName }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()
  const client = useMemo(() => createApiClient({ baseUrl: apiUrl }), [apiUrl])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    try {
      await registerParent(client, { name, email, password })
      setMessage('Registration submitted. Await admin approval.')
      setName('')
      setEmail('')
      setPassword('')
    } catch (error) {
      setMessage(mapApiErrorMessage(error, 'Registration failed'))
    }
  }

  return (
    <div className="container">
      <div className="logo-wrapper">
        <img src="/unclejon.jpg" alt={siteName + ' Logo'} className="logo" />
      </div>
      <h1>Parent Registration</h1>
      <form onSubmit={handleSubmit} className="form">
        <label>
          Name
          <input value={name} onChange={e => setName(e.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </label>
        <button type="submit">Register</button>
      </form>
      {message && <p>{message}</p>}
      <p>
        <Link to="/login" onClick={() => navigate('/login')}>Back to login</Link>
      </p>
    </div>
  )
}
