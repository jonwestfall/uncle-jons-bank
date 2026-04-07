import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '../utils/currency'
import { useToast } from '../components/ToastProvider'
import { createApiClient } from '../api/client'
import { completeChore, listMyChores, proposeChore, type Chore } from '../api/chores'
import { toastApiError } from '../utils/apiError'

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
  const client = useMemo(
    () => createApiClient({ baseUrl: apiUrl, getToken: () => token }),
    [apiUrl, token],
  )

  const fetchChores = useCallback(async () => {
    try {
      setChores(await listMyChores(client))
    } catch (error) {
      toastApiError(showToast, error, 'Failed to load chores')
    }
  }, [client, showToast])

  useEffect(() => {
    fetchChores()
  }, [fetchChores])

  const markDone = async (id: number) => {
    try {
      await completeChore(client, id)
      showToast('Chore marked complete')
      fetchChores()
    } catch (error) {
      toastApiError(showToast, error, 'Failed to mark complete')
    }
  }

  const propose = async () => {
    try {
      await proposeChore(client, { description: desc, amount: parseFloat(amount) })
      showToast('Chore proposed')
      setDesc('')
      setAmount('')
      fetchChores()
    } catch (error) {
      toastApiError(showToast, error, 'Failed to propose')
    }
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
