import { useEffect, useState, FormEvent } from 'react'

interface Props {
  token: string
  apiUrl: string
}

interface UserData {
  name: string
  email: string
  permissions: string[]
}

export default function ParentProfile({ token, apiUrl }: Props) {
  const [data, setData] = useState<UserData | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const resp = await fetch(`${apiUrl}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (resp.ok) setData(await resp.json())
    }
    fetchData()
  }, [token, apiUrl])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match')
      setError(true)
      return
    }
    const resp = await fetch(`${apiUrl}/users/me/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ password: newPassword }),
    })
    if (resp.ok) {
      setMessage('Password updated successfully.')
      setError(false)
      setNewPassword('')
      setConfirmPassword('')
    } else {
      setMessage('Failed to update password.')
      setError(true)
    }
  }

  if (!data) return <p>Loading...</p>

  return (
    <div className="container">
      <h2>Your Profile</h2>
      <p>Email: {data.email}</p>
      <p>Permissions:</p>
      <ul>
        {data.permissions.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <form onSubmit={handleSubmit} className="form">
        <h4>Change Password</h4>
        {message && <p className={error ? 'error' : 'success'}>{message}</p>}
        <label>
          New Password
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </label>
        <label>
          Confirm Password
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit">Update Password</button>
      </form>
    </div>
  )
}

