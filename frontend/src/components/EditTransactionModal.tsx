import { useState } from "react";
import type { Transaction } from "./LedgerTable";

interface Props {
  transaction: Transaction;
  token: string;
  apiUrl: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditTransactionModal({
  transaction,
  token,
  apiUrl,
  onClose,
  onSuccess,
}: Props) {
  const [amount, setAmount] = useState(String(transaction.amount));
  const [memo, setMemo] = useState(transaction.memo || "");
  const [type, setType] = useState(transaction.type);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) {
      setError("Amount must be a positive number");
      return;
    }
    if (type !== "credit" && type !== "debit") {
      setError("Type must be credit or debit");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(`${apiUrl}/transactions/${transaction.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: amt,
          memo: memo || null,
          type,
        }),
      });
      if (resp.ok) {
        onSuccess();
        onClose();
      } else {
        const data = await resp.json().catch(() => null);
        setError(data?.message || "Failed to update transaction");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to update transaction");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h4>Edit Transaction</h4>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleSubmit} className="form">
          <label>
            Amount
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>
          <label>
            Memo
            <input
              placeholder="Memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </label>
          <label>
            Type
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="credit">credit</option>
              <option value="debit">debit</option>
            </select>
          </label>
          <div className="modal-actions">
            <button type="submit" disabled={loading}>
              Save
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-05"
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
