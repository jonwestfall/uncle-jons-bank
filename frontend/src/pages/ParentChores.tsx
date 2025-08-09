import { useEffect, useState } from 'react'
import { formatCurrency } from '../utils/currency'
import { useToast } from '../components/ToastProvider'

interface Child {
  id: number
  first_name: string
}

interface Chore {
  id: number
  description: string
  amount: number
  status: string
  interval_days?: number | null
}

interface Props {
  token: string
  apiUrl: string
  currencySymbol: string
}

export default function ParentChores({ token, apiUrl, currencySymbol }: Props) {
  const [children, setChildren] = useState<Child[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [chores, setChores] = useState<Chore[]>([])
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [interval, setInterval] = useState('')
  const { showToast } = useToast()

  const fetchChildren = async () => {
    const resp = await fetch(`${apiUrl}/children/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) setChildren(await resp.json())
  }

  const fetchChores = async (cid: number) => {
    const resp = await fetch(`${apiUrl}/chores/child/${cid}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) setChores(await resp.json())
  }

  useEffect(() => {
    fetchChildren()
  }, [])

  useEffect(() => {
    if (selected !== null) fetchChores(selected)
  }, [selected])

  const addChore = async () => {
    if (selected === null) return
    const resp = await fetch(`${apiUrl}/chores/child/${selected}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ description: desc, amount: parseFloat(amount), interval_days: interval ? parseInt(interval) : null }),
    })
    if (resp.ok) {
      showToast('Chore added')
      setDesc('')
      setAmount('')
      setInterval('')
      fetchChores(selected)
    } else showToast('Failed to add chore', 'error')
  }

  const approve = async (id: number) => {
    const resp = await fetch(`${apiUrl}/chores/${id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) {
      showToast('Chore approved')
      if (selected !== null) fetchChores(selected)
    }
  }

  const reject = async (id: number) => {
    const resp = await fetch(`${apiUrl}/chores/${id}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok) {
      showToast('Chore updated')
      if (selected !== null) fetchChores(selected)
    }
  }

  const remove = async (id: number) => {
    const resp = await fetch(`${apiUrl}/chores/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (resp.ok && selected !== null) fetchChores(selected)
  }

  return (
    <div className="container">
      <h2>Chores</h2>
      <div>
        <select value={selected ?? ''} onChange={e => setSelected(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Select child</option>
          {children.map(c => (
            <option key={c.id} value={c.id}>
              {c.first_name}
            </option>
          ))}
        </select>
      </div>
      {selected !== null && (
        <>
          <ul className="list">
            {chores.map(c => (
              <li key={c.id}>
                {c.description} - {formatCurrency(c.amount, currencySymbol)} - {c.status}
                {c.interval_days ? ` (every ${c.interval_days} days)` : ''}
                {c.status === 'awaiting_approval' && (
                  <>
                    <button onClick={() => approve(c.id)} style={{ marginLeft: '0.5rem' }}>Approve</button>
                    <button onClick={() => reject(c.id)} style={{ marginLeft: '0.5rem' }}>Reject</button>
                  </>
                )}
                {c.status === 'proposed' && (
                  <>
                    <button onClick={() => approve(c.id)} style={{ marginLeft: '0.5rem' }}>Approve</button>
                    <button onClick={() => reject(c.id)} style={{ marginLeft: '0.5rem' }}>Reject</button>
                  </>
                )}
                <button onClick={() => remove(c.id)} style={{ marginLeft: '0.5rem' }}>Delete</button>
              </li>
            ))}
          </ul>
          <h3>Add Chore</h3>
          <div>
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description" />
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" />
            <input type="number" value={interval} onChange={e => setInterval(e.target.value)} placeholder="Interval days (optional)" />
            <button onClick={addChore} disabled={!desc || !amount} style={{ marginLeft: '0.5rem' }}>
              Add
            </button>
          </div>
        </>
      )}
    </div>
  )
}
