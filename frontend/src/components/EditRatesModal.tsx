import { useState, type FormEvent } from "react";

interface ChildRates {
  id: number;
  first_name: string;
  interest_rate?: number;
  penalty_interest_rate?: number;
  cd_penalty_rate?: number;
}

interface Props {
  child: ChildRates;
  token: string;
  apiUrl: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function EditRatesModal({
  child,
  token,
  apiUrl,
  onClose,
  onSuccess,
  onError,
}: Props) {
  const [interest, setInterest] = useState(
    child.interest_rate?.toString() ?? "",
  );
  const [penalty, setPenalty] = useState(
    child.penalty_interest_rate?.toString() ?? "",
  );
  const [cdPenalty, setCdPenalty] = useState(
    child.cd_penalty_rate?.toString() ?? "",
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const i = Number(interest);
    const p = Number(penalty);
    const cdr = Number(cdPenalty);
    if (Number.isNaN(i) || Number.isNaN(p) || Number.isNaN(cdr)) {
      onError("Please enter valid numbers for all rates.");
      return;
    }
    try {
      const resp1 = await fetch(`${apiUrl}/children/${child.id}/interest-rate`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ interest_rate: i }),
      });
      const resp2 = await fetch(
        `${apiUrl}/children/${child.id}/penalty-interest-rate`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ penalty_interest_rate: p }),
        },
      );
      const resp3 = await fetch(
        `${apiUrl}/children/${child.id}/cd-penalty-rate`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cd_penalty_rate: cdr }),
        },
      );
      if (resp1.ok && resp2.ok && resp3.ok) {
        onSuccess("Rates updated successfully.");
        onClose();
      } else {
        onError("Failed to update rates.");
      }
    } catch (err) {
      console.error(err);
      onError("Failed to update rates.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Edit Rates for {child.first_name}</h3>
        <form onSubmit={handleSubmit} className="form">
          <input
            type="number"
            step="0.0001"
            placeholder="Interest rate"
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            required
          />
          <input
            type="number"
            step="0.0001"
            placeholder="Penalty interest rate"
            value={penalty}
            onChange={(e) => setPenalty(e.target.value)}
            required
          />
          <input
            type="number"
            step="0.0001"
            placeholder="CD penalty rate"
            value={cdPenalty}
            onChange={(e) => setCdPenalty(e.target.value)}
            required
          />
          <div className="modal-actions">
            <button type="submit">Save</button>
            <button type="button" className="ml-1" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

