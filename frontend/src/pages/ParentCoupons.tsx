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
  const [qrVisible, setQrVisible] = useState<Record<number, boolean>>({});
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

  async function fetchCoupons(showId?: number) {
    const resp = await fetch(`${apiUrl}/coupons`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok) {
      const data: Coupon[] = await resp.json();
      setCoupons(data);
      const vis: Record<number, boolean> = {};
      for (const c of data) {
        vis[c.id] = c.id === showId;
      }
      setQrVisible(vis);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    const maxUses = parseInt(uses);
    if (!amt || amt <= 0) {
      showToast("Enter a valid amount");
      return;
    }
    if (!maxUses || maxUses <= 0) {
      showToast("Uses must be at least 1");
      return;
    }
    if (expiration && new Date(expiration) < new Date()) {
      showToast("Expiration must be in the future");
      return;
    }
    let scope = "my_children";
    const body: Record<string, unknown> = {
      amount: amt,
      memo: memo || undefined,
      max_uses: maxUses,
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
      const newCoupon: Coupon = await resp.json();
      showToast("Coupon created");
      setAmount("");
      setMemo("");
      setExpiration("");
      setUses("1");
      setChildId("");
      setTarget("all");
      fetchCoupons(newCoupon.id);
    } else {
      showToast("Failed to create coupon");
    }
  };

  function targetLabel(c: Coupon): string {
    if (c.scope === "all_children") return "All Child Accounts";
    if (c.scope === "my_children") return "All My Children";
    const child = children.find((ch) => ch.id === c.child_id);
    return child ? child.first_name : "-";
  }

  async function handleDelete(id: number) {
    const resp = await fetch(`${apiUrl}/coupons/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok) {
      showToast("Coupon removed");
      fetchCoupons();
    } else {
      showToast("Failed to remove coupon");
    }
  }

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
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
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
            <th>Target</th>
            <th>Amount</th>
            <th>Uses</th>
            <th>Expires</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {coupons.map((c) => (
            <tr key={c.id} className={c.uses_remaining === 0 ? "opacity-50" : ""}>
              <td>
                {c.code}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(c.code);
                    showToast("Code copied");
                  }}
                >
                  Copy
                </button>
                {c.qr_code && (
                  <div>
                    <button
                      onClick={() =>
                        setQrVisible((prev) => ({
                          ...prev,
                          [c.id]: !prev[c.id],
                        }))
                      }
                    >
                      {qrVisible[c.id] ? "Hide QR" : "Show QR"}
                    </button>
                    {qrVisible[c.id] && (
                      <img
                        src={`data:image/png;base64,${c.qr_code}`}
                        alt="QR"
                      />
                    )}
                  </div>
                )}
              </td>
              <td>{targetLabel(c)}</td>
              <td>
                {currencySymbol}
                {c.amount.toFixed(2)}
              </td>
              <td>
                <div className="flex items-center space-x-1">
                  <progress
                    value={c.max_uses - c.uses_remaining}
                    max={c.max_uses}
                  />
                  <span>{c.uses_remaining} left</span>
                </div>
              </td>
              <td>
                {c.expiration
                  ? new Date(c.expiration).toLocaleDateString()
                  : "-"}
              </td>
              <td>
                <button onClick={() => handleDelete(c.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
