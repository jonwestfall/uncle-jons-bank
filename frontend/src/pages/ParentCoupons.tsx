import { useEffect, useState } from "react";
import { useToast } from "../components/ToastProvider";

interface Child {
  id: number;
  first_name: string;
}

interface Coupon {
  id: number;
  code: string;
  amount: number;
  memo?: string | null;
  expiration?: string | null;
  max_uses: number;
  uses_remaining: number;
  scope: string;
  child_id?: number | null;
  qr_code?: string | null;
}

interface Props {
  token: string;
  apiUrl: string;
  isAdmin: boolean;
  currencySymbol: string;
}

export default function ParentCoupons({ token, apiUrl, isAdmin, currencySymbol }: Props) {
  const [children, setChildren] = useState<Child[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [target, setTarget] = useState<string>("all");
  const [childId, setChildId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [expiration, setExpiration] = useState("");
  const [uses, setUses] = useState("1");
  const { showToast } = useToast();

  useEffect(() => {
    fetchChildren();
    fetchCoupons();
  }, []);

  async function fetchChildren() {
    const resp = await fetch(`${apiUrl}/children/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok) {
      setChildren(await resp.json());
    }
  }

  async function fetchCoupons() {
    const resp = await fetch(`${apiUrl}/coupons`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok) {
      setCoupons(await resp.json());
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let scope = "my_children";
    const body: any = {
      amount: parseFloat(amount),
      memo: memo || undefined,
      max_uses: parseInt(uses),
    };
    if (expiration) {
      body.expiration = new Date(expiration).toISOString();
    }
    if (target === "system") {
      scope = "all_children";
    } else if (childId) {
      scope = "child";
      body.child_id = Number(childId);
    }
    body.scope = scope;
    const resp = await fetch(`${apiUrl}/coupons`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (resp.ok) {
      showToast("Coupon created");
      setAmount("");
      setMemo("");
      setExpiration("");
      setUses("1");
      setChildId("");
      setTarget("all");
      fetchCoupons();
    } else {
      showToast("Failed to create coupon");
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h2>Create Coupon</h2>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label>Target:</label>
          <select
            value={childId || target}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "system" || v === "all") {
                setChildId("");
                setTarget(v);
              } else {
                setChildId(v);
                setTarget("");
              }
            }}
          >
            <option value="all">All My Children</option>
            {children.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.first_name}
              </option>
            ))}
            {isAdmin && <option value="system">All Child Accounts</option>}
          </select>
        </div>
        <div>
          <label>Amount:</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label>Memo:</label>
          <input value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
        <div>
          <label>Expiration:</label>
          <input
            type="date"
            value={expiration}
            onChange={(e) => setExpiration(e.target.value)}
          />
        </div>
        <div>
          <label>Uses:</label>
          <input
            type="number"
            min="1"
            value={uses}
            onChange={(e) => setUses(e.target.value)}
          />
        </div>
        <button type="submit">Create</button>
      </form>

      <h3 className="mt-6">Existing Coupons</h3>
      <table className="table-auto w-full">
        <thead>
          <tr>
            <th>Code</th>
            <th>Amount</th>
            <th>Uses</th>
            <th>Expires</th>
          </tr>
        </thead>
        <tbody>
          {coupons.map((c) => (
            <tr key={c.id}>
              <td>
                {c.code}
                {c.qr_code && (
                  <div>
                    <img
                      src={`data:image/png;base64,${c.qr_code}`}
                      alt="QR"
                    />
                  </div>
                )}
              </td>
              <td>
                {currencySymbol}
                {c.amount.toFixed(2)}
              </td>
              <td>
                {c.max_uses - c.uses_remaining}/{c.max_uses}
              </td>
              <td>
                {c.expiration
                  ? new Date(c.expiration).toLocaleDateString()
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
