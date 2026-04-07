import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '../utils/currency'
import { useToast } from '../components/ToastProvider'
import { createApiClient } from '../api/client'
import { listChildren } from '../api/children'
import {
  approveChore,
  createChildChore,
  deleteChore,
  listChildChores,
  rejectChore,
  type Chore,
} from '../api/chores'
import { toastApiError } from '../utils/apiError'

interface Child {
  id: number
  first_name: string
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
  const client = useMemo(
    () => createApiClient({ baseUrl: apiUrl, getToken: () => token }),
    [apiUrl, token],
  )

  const fetchChildren = useCallback(async () => {
    try {
      setChildren(await listChildren(client))
    } catch (error) {
      toastApiError(showToast, error, 'Failed to load children')
    }
  }, [client, showToast])

  const fetchChores = useCallback(async (cid: number) => {
    try {
      setChores(await listChildChores(client, cid))
    } catch (error) {
      toastApiError(showToast, error, 'Failed to load chores')
    }
  }, [client, showToast])

  useEffect(() => {
    fetchChildren()
  }, [fetchChildren])

  useEffect(() => {
    if (selected !== null) fetchChores(selected)
  }, [fetchChores, selected])

  const addChore = async () => {
    if (selected === null) return
    try {
      await createChildChore(client, selected, {
        description: desc,
        amount: parseFloat(amount),
        interval_days: interval ? parseInt(interval) : null,
      })
      showToast('Chore added')
      setDesc('')
      setAmount('')
      setInterval('')
      fetchChores(selected)
    } catch (error) {
      toastApiError(showToast, error, 'Failed to add chore')
    }
  }

  const approve = async (id: number) => {
    try {
      await approveChore(client, id)
      showToast('Chore approved')
      if (selected !== null) fetchChores(selected)
    } catch (error) {
      toastApiError(showToast, error, 'Failed to approve chore')
    }
  }

  const reject = async (id: number) => {
    try {
      await rejectChore(client, id)
      showToast('Chore updated')
      if (selected !== null) fetchChores(selected)
    } catch (error) {
      toastApiError(showToast, error, 'Failed to reject chore')
    }
  }

  const remove = async (id: number) => {
    try {
      await deleteChore(client, id)
      if (selected !== null) fetchChores(selected)
    } catch (error) {
      toastApiError(showToast, error, 'Failed to delete chore')
    }
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
