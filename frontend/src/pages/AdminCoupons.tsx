import { useEffect, useState } from "react";
import { useToast } from "../components/ToastProvider";

interface Coupon {
  id: number
  code: string
  amount: number
  memo?: string | null
  expiration?: string | null
  max_uses: number
  uses_remaining: number
  scope: string
  created_by: number
}

interface Props {
  token: string
  apiUrl: string
  currencySymbol: string
}

export default function AdminCoupons({ token, apiUrl, currencySymbol }: Props) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState("all");
  const { showToast } = useToast();

  const fetchCoupons = async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (scope !== "all") params.set("scope", scope);
    const resp = await fetch(`${apiUrl}/coupons/all?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok) {
      setCoupons(await resp.json());
    }
  };

  useEffect(() => {
    fetchCoupons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, scope]);

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
    <div className="p-4 max-w-3xl mx-auto">
      <h2>All Coupons</h2>
      <div className="space-x-2 mb-2">
        <input
          placeholder="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="all">All Scopes</option>
          <option value="child">Single Child</option>
          <option value="my_children">My Children</option>
          <option value="all_children">All Children</option>
        </select>
        <button onClick={fetchCoupons}>Refresh</button>
      </div>
      <table className="table-auto w-full">
        <thead>
          <tr>
            <th>Code</th>
            <th>Scope</th>
            <th>Amount</th>
            <th>Uses</th>
            <th>Expires</th>
            <th>Creator</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {coupons.map((c) => (
            <tr key={c.id}>
              <td>{c.code}</td>
              <td>{c.scope}</td>
              <td>
                {currencySymbol}
                {c.amount.toFixed(2)}
              </td>
              <td>
                {c.max_uses - c.uses_remaining}/{c.max_uses}
              </td>
              <td>{c.expiration ? new Date(c.expiration).toLocaleDateString() : "-"}</td>
              <td>{c.created_by}</td>
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
