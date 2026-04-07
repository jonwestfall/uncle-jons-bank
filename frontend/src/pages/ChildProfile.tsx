import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '../utils/currency'
import { createApiClient } from '../api/client'
import { listMyBadges, type Badge } from '../api/education'
import { listMyWithdrawals, type WithdrawalRequest } from '../api/withdrawals'
import { mapApiErrorMessage } from '../utils/apiError'

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

export default function ChildProfile({ token, apiUrl, currencySymbol }: Props) {
  const [data, setData] = useState<ChildProfileData | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [badges, setBadges] = useState<Badge[]>([])
  const client = useMemo(
    () => createApiClient({ baseUrl: apiUrl, getToken: () => token }),
    [apiUrl, token],
  )

  const fetchData = useCallback(async () => {
    try {
      const profile = await client.get<ChildProfileData>('/children/me')
      setData(profile)
      setProfileError(null)
    } catch (error) {
      setProfileError(mapApiErrorMessage(error, 'Failed to load profile.'))
    }
  }, [client])

  const fetchWithdrawals = useCallback(async () => {
    try {
      setWithdrawals(await listMyWithdrawals(client))
    } catch {
      // keep page usable even if secondary data fails
    }
  }, [client])

  const fetchBadges = useCallback(async () => {
    try {
      setBadges(await listMyBadges(client))
    } catch {
      // keep page usable even if secondary data fails
    }
  }, [client])

  useEffect(() => {
    fetchData()
    fetchWithdrawals()
    fetchBadges()
  }, [fetchBadges, fetchData, fetchWithdrawals])

  if (!data) return <p>{profileError ?? 'Loading...'}</p>

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
