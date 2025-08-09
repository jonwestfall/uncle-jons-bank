import { useEffect, useState } from 'react'
import { formatCurrency } from '../utils/currency'
import { useToast } from '../components/ToastProvider'

interface Chore {
  id: number
  description: string
  amount: number
  status: string
}

interface Props {
  token: string
  apiUrl: string
  currencySymbol: string
}

export default function ChildChores({ token, apiUrl, currencySymbol }: Props) {
  const [chores, setChores] = useState<Chore[]>([])
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const { showToast } = useToast()

  const fetchChores = async () => {
    const resp = await fetch(`${apiUrl}/chores/mine`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) setChores(await resp.json())
  }

  useEffect(() => {
    fetchChores()
  }, [])

  const markDone = async (id: number) => {
    const resp = await fetch(`${apiUrl}/chores/${id}/complete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) {
      showToast('Chore marked complete')
      fetchChores()
    } else showToast('Failed to mark complete', 'error')
  }

  const propose = async () => {
    const resp = await fetch(`${apiUrl}/chores/propose`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ description: desc, amount: parseFloat(amount) }),
    })
    if (resp.ok) {
      showToast('Chore proposed')
      setDesc('')
      setAmount('')
      fetchChores()
    } else showToast('Failed to propose', 'error')
  }

  return (
    <div className="container">
      <h2>Your Chores</h2>
      {chores.length === 0 ? (
        <p>No chores yet.</p>
      ) : (
        <ul className="list">
          {chores.map(c => (
            <li key={c.id}>
              {c.description} - {formatCurrency(c.amount, currencySymbol)} - {c.status}
              {c.status === 'pending' && (
                <button onClick={() => markDone(c.id)} style={{ marginLeft: '0.5rem' }}>
                  Mark Done
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <h3>Propose a Chore</h3>
      <div>
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Chore description"
        />
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Amount"
        />
        <button onClick={propose} disabled={!desc || !amount} style={{ marginLeft: '0.5rem' }}>
          Submit
        </button>
      </div>
    </div>
  )
}
