import { useEffect, useState } from 'react'
import { formatCurrency } from '../utils/currency'

interface Props {
  token: string
  apiUrl: string
  currencySymbol: string
}

interface ChildProfileData {
  interest_rate: number
  penalty_interest_rate: number
  cd_penalty_rate: number
}

interface WithdrawalRequest {
  id: number
  child_id: number
  amount: number
  memo?: string | null
  status: string
  denial_reason?: string | null
}

interface Badge {
  id: number
  name: string
  module_id?: number | null
}

export default function ChildProfile({ token, apiUrl, currencySymbol }: Props) {
  const [data, setData] = useState<ChildProfileData | null>(null)
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [badges, setBadges] = useState<Badge[]>([])

  useEffect(() => {
    const fetchData = async () => {
      const resp = await fetch(`${apiUrl}/children/me`, { headers: { Authorization: `Bearer ${token}` } })
      if (resp.ok) setData((await resp.json()) as ChildProfileData)
    }
    const fetchWithdrawals = async () => {
      const resp = await fetch(`${apiUrl}/withdrawals/mine`, { headers: { Authorization: `Bearer ${token}` } })
      if (resp.ok) setWithdrawals(await resp.json())
    }
    const fetchBadges = async () => {
      const resp = await fetch(`${apiUrl}/education/badges/me`, { headers: { Authorization: `Bearer ${token}` } })
      if (resp.ok) setBadges(await resp.json())
    }
    fetchData()
    fetchWithdrawals()
    fetchBadges()
  }, [token, apiUrl])

  if (!data) return <p>Loading...</p>

  return (
    <div className="container">
      <h2>Your Profile</h2>
      <p>
        Interest rate: {(data.interest_rate * 100).toFixed(2)}% - This is how much extra money you earn for saving.
      </p>
      <p>
        Penalty rate: {(data.penalty_interest_rate * 100).toFixed(2)}% - If your balance goes below zero, you owe this extra.
      </p>
      <p>
        CD penalty rate: {(data.cd_penalty_rate * 100).toFixed(2)}% - Taking money out of a CD early costs this much.
      </p>
      {withdrawals.length > 0 && (
        <div>
          <h3>Your Money Requests</h3>
          <ul className="list">
            {withdrawals.map(w => (
              <li key={w.id}>
                {formatCurrency(w.amount, currencySymbol)}{w.memo ? ` (${w.memo})` : ''} - {w.status}
                {w.denial_reason ? ` (Reason: ${w.denial_reason})` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      {badges.length > 0 && (
        <div>
          <h3>Your Badges</h3>
          <ul className="list">
            {badges.map(b => (
              <li key={b.id}>{b.name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
