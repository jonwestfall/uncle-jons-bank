import { useEffect, useState } from "react";
import { useToast } from "../components/ToastProvider";

interface CouponInfo {
  id: number;
  redeemed_at: string;
  coupon: {
    code: string;
    amount: number;
    memo?: string | null;
  };
}

interface Props {
  token: string;
  childId: number;
  apiUrl: string;
  currencySymbol: string;
}

export default function ChildCoupons({ token, childId, apiUrl, currencySymbol }: Props) {
  const [code, setCode] = useState("");
  const [history, setHistory] = useState<CouponInfo[]>([]);
  const { showToast } = useToast();

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    const resp = await fetch(`${apiUrl}/coupons/redemptions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok) {
      setHistory(await resp.json());
    }
  }

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    const resp = await fetch(`${apiUrl}/coupons/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ code }),
    });
    if (resp.ok) {
      showToast("Coupon redeemed");
      setCode("");
      fetchHistory();
    } else {
      showToast("Invalid coupon");
    }
  };

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h2>Redeem Coupon</h2>
      <form onSubmit={handleRedeem} className="space-x-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code"
        />
        <button type="submit">Redeem</button>
      </form>
      <h3 className="mt-6">Redeemed Coupons</h3>
      <table className="table-auto w-full">
        <thead>
          <tr>
            <th>Code</th>
            <th>Amount</th>
            <th>Memo</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {history.map((h) => (
            <tr key={h.id}>
              <td>{h.coupon.code}</td>
              <td>
                {currencySymbol}
                {h.coupon.amount.toFixed(2)}
              </td>
              <td>{h.coupon.memo}</td>
              <td>{new Date(h.redeemed_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
