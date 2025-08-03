import { useState, type FormEvent } from 'react'

interface Props {
  token: string
  apiUrl: string
  onClose: () => void
  onSaved: () => void
}

export default function RunPromotionModal({ token, apiUrl, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState('0')
  const [isPct, setIsPct] = useState(false)
  const [credit, setCredit] = useState(true)
  const [memo, setMemo] = useState('Promotion')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await fetch(`${apiUrl}/admin/promotions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        amount: isPct ? Number(amount) / 100 : Number(amount),
        is_percentage: isPct,
        credit,
        memo,
      }),
    })
    onSaved()
    onClose()
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Run Promotion</h3>
        <form onSubmit={handleSubmit} className="form">
          <label>
            Amount or Percentage {isPct ? '(%)' : ''}
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />{isPct && '%'}
          </label>
          <label>
            <input type="checkbox" checked={isPct} onChange={e => setIsPct(e.target.checked)} /> Percentage?
          </label>
          <label>
            <input type="checkbox" checked={credit} onChange={e => setCredit(e.target.checked)} /> Credit accounts? (uncheck to charge)
          </label>
          <label>
            Memo
            <input value={memo} onChange={e => setMemo(e.target.value)} />
          </label>
          <div className="modal-actions">
            <button type="submit">Run</button>
            <button type="button" className="ml-1" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
