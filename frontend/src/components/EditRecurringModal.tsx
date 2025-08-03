import { useState } from "react";

interface RecurringCharge {
  id: number;
  child_id: number;
  amount: number;
  type: string;
  memo?: string | null;
  interval_days: number;
  next_run: string;
  active: boolean;
}

interface Props {
  charge: RecurringCharge;
  token: string;
  apiUrl: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditRecurringModal({
  charge,
  token,
  apiUrl,
  onClose,
  onSaved,
}: Props) {
  const [amount, setAmount] = useState(String(charge.amount));
  const [type, setType] = useState(charge.type);
  const [memo, setMemo] = useState(charge.memo || "");
  const [interval, setInterval] = useState(String(charge.interval_days));
  const [next, setNext] = useState(charge.next_run.slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amt = Number(amount);
    const intDays = Number(interval);
    if (isNaN(amt) || amt <= 0) {
      setError("Amount must be positive");
      return;
    }
    if (isNaN(intDays) || intDays <= 0) {
      setError("Interval must be positive");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`${apiUrl}/recurring/${charge.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amt,
          interval_days: intDays,
          memo: memo || null,
          next_run: next,
          type,
        }),
      });
      if (resp.ok) {
        onSaved();
        onClose();
      } else {
        const data = await resp.json().catch(() => null);
        setError(data?.message || "Failed to update charge");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to update charge");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h4>Edit Recurring Charge</h4>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit} className="form">
          <label>
            Amount
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
          <label>
            Type
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
          </label>
          <label>
            Memo
            <input value={memo} onChange={(e) => setMemo(e.target.value)} />
          </label>
          <label>
            Interval days
            <input
              type="number"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              required
            />
          </label>
          <label>
            Next run
            <input
              type="date"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
          </label>
          <div className="modal-actions">
            <button type="submit" disabled={loading}>
              Save
            </button>
            <button
              type="button"
              className="ml-05"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
