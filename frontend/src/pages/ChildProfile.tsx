import { useEffect, useState } from 'react'

interface Props {
  token: string
  apiUrl: string
}

export default function ChildProfile({ token, apiUrl }: Props) {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    const fetchData = async () => {
      const resp = await fetch(`${apiUrl}/children/me`, { headers: { Authorization: `Bearer ${token}` } })
      if (resp.ok) setData(await resp.json())
    }
    fetchData()
  }, [token, apiUrl])

  if (!data) return <p>Loading...</p>

  return (
    <div className="container">
      <h2>Your Profile</h2>
      <p>Interest rate: {data.interest_rate}</p>
      <p>Penalty rate: {data.penalty_interest_rate}</p>
      <p>CD penalty rate: {data.cd_penalty_rate}</p>
    </div>
  )
}
