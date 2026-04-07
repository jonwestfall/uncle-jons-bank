import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { createApiClient } from '../api/client'
import { getMe, updateMyPassword, type UserData } from '../api/users'
import { mapApiErrorMessage } from '../utils/apiError'

interface Props {
  token: string
  apiUrl: string
}

export default function ParentProfile({ token, apiUrl }: Props) {
  const [data, setData] = useState<UserData | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const client = useMemo(
    () => createApiClient({ baseUrl: apiUrl, getToken: () => token }),
    [apiUrl, token],
  )

  useEffect(() => {
    const fetchData = async () => {
      try {
        setData(await getMe(client))
      } catch {
        setError(true)
        setMessage('Failed to load profile.')
      }
    }
    fetchData()
  }, [client])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match')
      setError(true)
      return
    }
    try {
      await updateMyPassword(client, newPassword)
      setMessage('Password updated successfully.')
      setError(false)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setMessage(mapApiErrorMessage(err, 'Failed to update password.'))
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
