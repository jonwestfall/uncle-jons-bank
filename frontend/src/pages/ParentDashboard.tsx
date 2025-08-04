import { useCallback, useEffect, useState } from "react";
import EditRatesModal from "../components/EditRatesModal";
import type { Transaction } from "../components/LedgerTable";
import LedgerTable from "../components/LedgerTable";
import { formatCurrency } from "../utils/currency";

import ConfirmModal from "../components/ConfirmModal";
import EditRecurringModal from "../components/EditRecurringModal";
import EditTransactionModal from "../components/EditTransactionModal";
import ManageAccessModal from "../components/ManageAccessModal";
import ShareChildModal from "../components/ShareChildModal";
import TextPromptModal from "../components/TextPromptModal";

interface Child {
  id: number;
  first_name: string;
  frozen: boolean;
  interest_rate?: number;
  penalty_interest_rate?: number;
  cd_penalty_rate?: number;
  total_interest_earned?: number;
}

interface ParentInfo {
  user_id: number;
  name: string;
  email: string;
  permissions: string[];
  is_owner: boolean;
}

interface ChildApi {
  id: number;
  first_name: string;
  account_frozen?: boolean;
  frozen?: boolean;
  interest_rate?: number;
  penalty_interest_rate?: number;
  cd_penalty_rate?: number;
  total_interest_earned?: number;
}

interface LedgerResponse {
  balance: number;
  transactions: Transaction[];
}

interface WithdrawalRequest {
  id: number;
  child_id: number;
  amount: number;
  memo?: string | null;
  status: string;
  requested_at: string;
  responded_at?: string | null;
  denial_reason?: string | null;
}

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
  token: string;
  apiUrl: string;
  permissions: string[];
  onLogout: () => void;
  currencySymbol: string;
}

export default function ParentDashboard({
  token,
  apiUrl,
  permissions,
  onLogout,
  currencySymbol,
}: Props) {
  const [children, setChildren] = useState<Child[]>([]);
  const [ledger, setLedger] = useState<LedgerResponse | null>(null);
  const [selectedChild, setSelectedChild] = useState<number | null>(null);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<
    WithdrawalRequest[]
  >([]);
  const [denyRequest, setDenyRequest] = useState<WithdrawalRequest | null>(
    null,
  );
  const [charges, setCharges] = useState<RecurringCharge[]>([]);
  const [txType, setTxType] = useState("credit");
  const [txAmount, setTxAmount] = useState("");
  const [txMemo, setTxMemo] = useState("");
  const [firstName, setFirstName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [cdAmount, setCdAmount] = useState("");
  const [cdRate, setCdRate] = useState("");
  const [cdDays, setCdDays] = useState("");
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [codeChild, setCodeChild] = useState<Child | null>(null);
  const [sharingChild, setSharingChild] = useState<Child | null>(null);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [accessChild, setAccessChild] = useState<Child | null>(null);
  const [accessParents, setAccessParents] = useState<ParentInfo[]>([]);
  const [actionChild, setActionChild] = useState<Child | null>(null);
  const [editingCharge, setEditingCharge] = useState<RecurringCharge | null>(null);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const canEdit = permissions.includes("edit_transaction");
  const canDelete = permissions.includes("delete_transaction");
  const canAddRecurring = permissions.includes("add_recurring_charge");
  const canEditRecurring = permissions.includes("edit_recurring_charge");
  const canDeleteRecurring = permissions.includes("delete_recurring_charge");
  const [rcAmount, setRcAmount] = useState("");
  const [rcType, setRcType] = useState("debit");
  const [rcMemo, setRcMemo] = useState("");
  const [rcInterval, setRcInterval] = useState("");
  const [rcNext, setRcNext] = useState("");

  const closeLedger = () => {
    setLedger(null);
    setSelectedChild(null);
    setCharges([]);
  };

  const fetchChildren = useCallback(async () => {
    const resp = await fetch(`${apiUrl}/children/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok) {
      const data: ChildApi[] = await resp.json();
      setChildren(
        data.map((c) => ({
          id: c.id,
          first_name: c.first_name,
          frozen: c.frozen ?? c.account_frozen ?? false,
          interest_rate: c.interest_rate,
          penalty_interest_rate: c.penalty_interest_rate,
          cd_penalty_rate: c.cd_penalty_rate,
          total_interest_earned: c.total_interest_earned,
        })),
      );
    }
  }, [apiUrl, token]);

  const fetchLedger = useCallback(
    async (cid: number) => {
      const resp = await fetch(`${apiUrl}/transactions/child/${cid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) setLedger(await resp.json());
    },
    [apiUrl, token],
  );

  const fetchCharges = useCallback(
    async (cid: number) => {
      const resp = await fetch(`${apiUrl}/recurring/child/${cid}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) setCharges(await resp.json());
      else setCharges([]);
    },
    [apiUrl, token],
  );

  const fetchPendingWithdrawals = useCallback(async () => {
    const resp = await fetch(`${apiUrl}/withdrawals/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok) setPendingWithdrawals(await resp.json());
  }, [apiUrl, token]);

  useEffect(() => {
    fetchChildren();
    fetchPendingWithdrawals();
  }, [fetchChildren, fetchPendingWithdrawals]);


  const toggleFreeze = async (childId: number, frozen: boolean) => {
    const endpoint = frozen ? "unfreeze" : "freeze";
    const resp = await fetch(`${apiUrl}/children/${childId}/${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => null);
      setToast({
        message: data?.detail || "Action failed",
        error: true,
      });
    }
    fetchChildren();
  };

  const openAccess = async (child: Child) => {
    const resp = await fetch(`${apiUrl}/children/${child.id}/parents`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.ok) {
      setAccessParents(await resp.json());
      setAccessChild(child);
    } else {
      const data = await resp.json().catch(() => null);
      setToast({ message: data?.detail || "Failed to load access", error: true });
    }
  };

  return (
    <div className="container">
      {pendingWithdrawals.length > 0 && (
        <div>
          <h4>Pending Withdrawal Requests</h4>
          <ul className="list">
            {pendingWithdrawals.map((w) => (
              <li key={w.id}>
                Child {w.child_id}: {formatCurrency(w.amount, currencySymbol)} {w.memo ? `(${w.memo})` : ""}
                <button
                  onClick={async () => {
                    await fetch(`${apiUrl}/withdrawals/${w.id}/approve`, {
                      method: "POST",
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    await fetchPendingWithdrawals();
                    if (selectedChild === w.child_id)
                      await fetchLedger(w.child_id);
                  }}
                  className="ml-1"
                >
                  Approve
                </button>
                <button
                  onClick={() => setDenyRequest(w)}
                  className="ml-05"
                >
                  Deny
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <h2>Your Children</h2>
        {toast && (
          <div className={toast.error ? "error" : "success"}>
            <span>{toast.message}</span>
            <button className="ml-05" onClick={() => setToast(null)}>
              X
            </button>
          </div>
        )}
      <ul className="list">
        {children.map((c) => (
          <li key={c.id}>
            <details className="child-card">
              <summary>
                {c.first_name} {c.frozen && "(Frozen)"}
              </summary>
              <div className="child-actions">
                <button
                  onClick={() => {
                    closeLedger();
                    setActionChild(c);
                  }}
                >
                  Actions
                </button>
              </div>
            </details>
          </li>
        ))}
      </ul>
      <button onClick={() => setRedeemOpen(true)}>Redeem Share Code</button>
      {actionChild && (
        <div
          className="modal-overlay"
          onClick={() => setActionChild(null)}
        >
          <div
            className="modal"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <h3>Actions for {actionChild.first_name}</h3>
            <div className="child-actions">
              <button
                onClick={() => {
                  closeLedger();
                  setEditingChild(actionChild);
                  setActionChild(null);
                }}
              >
                Rates
              </button>
              <button
                onClick={() => {
                  closeLedger();
                  toggleFreeze(actionChild.id, actionChild.frozen);
                  setActionChild(null);
                }}
              >
                {actionChild.frozen ? "Unfreeze" : "Freeze"}
              </button>
              <button
                onClick={() => {
                  closeLedger();
                  setCodeChild(actionChild);
                  setActionChild(null);
                }}
              >
                Change Code
              </button>
              <button
                onClick={() => {
                  closeLedger();
                  setSharingChild(actionChild);
                  setActionChild(null);
                }}
              >
                Share
              </button>
              <button
                onClick={() => {
                  closeLedger();
                  openAccess(actionChild);
                  setActionChild(null);
                }}
              >
                Manage Access
              </button>
              <button
                onClick={() => {
                  closeLedger();
                  fetchLedger(actionChild.id);
                  fetchCharges(actionChild.id);
                  setSelectedChild(actionChild.id);
                  setActionChild(null);
                }}
              >
                View Ledger
              </button>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setActionChild(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {ledger && selectedChild !== null && (
        <div className="ledger-area">
          <div className="ledger-header">
            <h4>Ledger for child #{selectedChild}</h4>
            <button onClick={closeLedger}>Close Ledger</button>
          </div>
          <p>Balance: {formatCurrency(ledger.balance, currencySymbol)}</p>
          <div className="ledger-scroll">
            <LedgerTable
              transactions={ledger.transactions}
              allowDownload
              currencySymbol={currencySymbol}
              renderActions={(tx) => (
              <>
                {canEdit && tx.initiated_by !== "system" && (
                  <button
                    onClick={() => setEditingTx(tx)}
                    className="ml-1"
                  >
                    Edit
                  </button>
                )}
                {canDelete && tx.initiated_by !== "system" && (
                  <button
                    aria-label="Delete transaction"
                    onClick={() =>
                      setConfirmAction({
                        message: "Delete transaction?",
                        onConfirm: async () => {
                          const resp = await fetch(
                            `${apiUrl}/transactions/${tx.id}`,
                            {
                              method: "DELETE",
                              headers: { Authorization: `Bearer ${token}` },
                            },
                          );
                          if (resp.ok && selectedChild !== null) {
                            await fetchLedger(selectedChild);
                          }
                        },
                      })
                    }
                    className="ml-05"
                  >
                    &times;
                  </button>
                )}
              </>
              )}
            />
          </div>
          <h4>Recurring Transactions</h4>
          <ul className="list">
            {charges.map((c) => (
              <li key={c.id}>
                {c.type} {formatCurrency(c.amount, currencySymbol)} every {c.interval_days} days next on {new Date(c.next_run + "T00:00:00").toLocaleDateString()} {c.memo ? `(${c.memo})` : ""}
                {canEditRecurring && (
                  <button
                    onClick={() => setEditingCharge(c)}
                    className="ml-1"
                  >
                    Edit
                  </button>
                )}
                {canDeleteRecurring && (
                  <button
                    onClick={() =>
                      setConfirmAction({
                        message: "Delete charge?",
                        onConfirm: async () => {
                          await fetch(`${apiUrl}/recurring/${c.id}`, {
                            method: "DELETE",
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          fetchCharges(selectedChild);
                        },
                      })
                    }
                    className="ml-05"
                  >
                    &times;
                  </button>
                )}
              </li>
            ))}
          </ul>
          {canAddRecurring && (
            <form
            onSubmit={async (e) => {
              e.preventDefault();
                const nextDate = new Date(rcNext + "T00:00:00");
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (nextDate < today) {
                  setToast({ message: "Next run cannot be in the past", error: true });
                  return;
                }
                const resp = await fetch(`${apiUrl}/recurring/child/${selectedChild}`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    amount: Number(rcAmount),
                    memo: rcMemo || null,
                    interval_days: Number(rcInterval),
                    next_run: rcNext,
                    type: rcType,
                  }),
                });
                if (!resp.ok) {
                  const data = await resp.json().catch(() => null);
                  setToast({
                    message: data?.detail || "Action failed",
                    error: true,
                  });
                  return;
                }
                setRcAmount("");
                setRcType("debit");
                setRcMemo("");
                setRcInterval("");
                setRcNext("");
                fetchCharges(selectedChild);
              }}
              className="form"
            >
              <h4>Add Recurring Transaction</h4>
              These may be useful for direct deposits (like weekly allowance) or for services your child wants (e.g., a gaming subscription or cell phone)
              <label>
                Type
                <select value={rcType} onChange={(e) => setRcType(e.target.value)}>
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                </select>
              </label>
              <label>
                Amount
                <input
                  type="number"
                  step="0.01"
                  value={rcAmount}
                  onChange={(e) => setRcAmount(e.target.value)}
                  required
                />
              </label>
              <label>
                Memo
                <input
                  value={rcMemo}
                  onChange={(e) => setRcMemo(e.target.value)}
                />
              </label>
              <label>
                Interval days
                <input
                  type="number"
                  value={rcInterval}
                  onChange={(e) => setRcInterval(e.target.value)}
                  required
                />
              </label>
              <label>
                Next run
                <input
                  type="date"
                  value={rcNext}
                  onChange={(e) => setRcNext(e.target.value)}
                  required
                />
              </label>
              <button type="submit">Add</button>
            </form>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const resp = await fetch(`${apiUrl}/transactions/`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  child_id: selectedChild,
                  type: txType,
                  amount: Number(txAmount),
                  memo: txMemo || null,
                  initiated_by: "parent",
                  initiator_id: 0,
                }),
              });
              setTxAmount("");
              setTxMemo("");
              setTxType("credit");
              if (resp.ok && selectedChild !== null) {
                await fetchLedger(selectedChild);
              } else if (!resp.ok) {
                const data = await resp.json().catch(() => null);
                setToast({
                  message: data?.detail || "Action failed",
                  error: true,
                });
              }
            }}
            className="form"
          >
            <h4>Add Transaction</h4>
            <label>
              Type
              <select
                value={txType}
                onChange={(e) => setTxType(e.target.value)}
              >
                <option value="credit">Credit</option>
                <option value="debit">Debit</option>
              </select>
            </label>
            <label>
              Amount
              <input
                type="number"
                step="0.01"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                required
              />
            </label>
            <label>
              Memo
              <input
                value={txMemo}
                onChange={(e) => setTxMemo(e.target.value)}
              />
            </label>
          <button type="submit">Add</button>
        </form>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const resp = await fetch(`${apiUrl}/cds/`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                child_id: selectedChild,
                amount: Number(cdAmount),
                interest_rate: Number(cdRate),
                term_days: Number(cdDays),
              }),
            });
            if (resp.ok) {
              alert("CD offer sent!");
            } else {
              let msg = "Failed to send CD offer";
              try {
                const data = await resp.json();
                if (data.detail) msg = data.detail;
              } catch {
                // ignore
              }
              alert(msg);
            }
            setCdAmount("");
            setCdRate("");
            setCdDays("");
          }}
          className="form"
        >
        <h4>Offer CD</h4>
        <label>
          Amount To Invest in CD
          <input
            type="number"
            step="0.01"
            value={cdAmount}
            onChange={(e) => setCdAmount(e.target.value)}
            required
          />
        </label>
        <label>
          Rate in Decimal (0.05 for 5%)
          <input
            type="number"
            step="0.0001"
            value={cdRate}
            onChange={(e) => setCdRate(e.target.value)}
            required
          />
        </label>
        <label>
          Days until Maturity
          <input
            type="number"
            value={cdDays}
            onChange={(e) => setCdDays(e.target.value)}
            required
          />
        </label>
        <button type="submit">Send Offer</button>
      </form>
      </div>
    )}
      
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setErrorMessage(null);
          try {
            const resp = await fetch(`${apiUrl}/children/`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                first_name: firstName,
                access_code: accessCode,
              }),
            });
            if (resp.ok) {
              setFirstName("");
              setAccessCode("");
              fetchChildren();
            } else {
              const errorData = await resp.json();
              setErrorMessage(
                errorData.message || "Failed to add child. Please try again.",
              );
            }
          } catch (error) {
            console.error(error);
            setErrorMessage("An unexpected error occurred. Please try again.");
          }
        }}
        className="form"
      >
        <h4>Add Child</h4>
        {errorMessage && <p className="error">{errorMessage}</p>}
        <label>
          First name
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </label>
        <label>
          Access code
          <input
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            required
          />
        </label>
        <button type="submit">Add</button>
      </form>
      {editingChild && (
        <EditRatesModal
          child={editingChild}
          token={token}
          apiUrl={apiUrl}
          onClose={() => setEditingChild(null)}
          onSuccess={(msg) => {
            setToast({ message: msg });
            fetchChildren();
          }}
          onError={(msg) => {
            setToast({ message: msg, error: true });
          }}
        />
      )}
      {sharingChild && (
        <ShareChildModal
          onSubmit={async (perms) => {
            const resp = await fetch(
              `${apiUrl}/children/${sharingChild.id}/sharecode`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ permissions: perms }),
              },
            );
            if (resp.ok) {
              const data = await resp.json();
              setToast({ message: `Share code: ${data.code}` });
            } else {
              const data = await resp.json().catch(() => null);
              setToast({
                message: data?.detail || "Failed to generate code",
                error: true,
              });
            }
            setSharingChild(null);
          }}
          onCancel={() => setSharingChild(null)}
        />
      )}
      {accessChild && (
        <ManageAccessModal
          parents={accessParents}
          onRemove={async (pid) => {
            const resp = await fetch(
              `${apiUrl}/children/${accessChild.id}/parents/${pid}`,
              {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              },
            );
            if (resp.ok) {
              openAccess(accessChild);
            } else {
              const data = await resp.json().catch(() => null);
              setToast({
                message: data?.detail || "Failed to remove access",
                error: true,
              });
            }
          }}
          onClose={() => setAccessChild(null)}
        />
      )}
      {redeemOpen && (
        <TextPromptModal
          title="Redeem Share Code"
          label="Code"
          onCancel={() => setRedeemOpen(false)}
          onSubmit={async (value) => {
            const resp = await fetch(
              `${apiUrl}/children/sharecode/${value}`,
              {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              },
            );
            if (resp.ok) {
              setToast({ message: "Child linked" });
              fetchChildren();
            } else {
              setToast({ message: "Invalid code", error: true });
            }
            setRedeemOpen(false);
          }}
        />
      )}
      {codeChild && (
        <TextPromptModal
          title={`New access code for ${codeChild.first_name}`}
          label="Access Code"
          onCancel={() => setCodeChild(null)}
          onSubmit={async (value) => {
            const resp = await fetch(
              `${apiUrl}/children/${codeChild.id}/access-code`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ access_code: value }),
              },
            );
            if (!resp.ok) {
              const data = await resp.json().catch(() => null);
              setToast({
                message: data?.message || "Failed to update access code",
                error: true,
              });
            } else {
              setToast({ message: "Access code updated" });
            }
            setCodeChild(null);
            fetchChildren();
          }}
        />
      )}
      <button onClick={onLogout}>Logout</button>
      {denyRequest && (
        <TextPromptModal
          title="Deny Withdrawal"
          label="Reason"
          onCancel={() => setDenyRequest(null)}
          onSubmit={async (reason) => {
            await fetch(`${apiUrl}/withdrawals/${denyRequest.id}/deny`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ reason }),
            });
            await fetchPendingWithdrawals();
            setDenyRequest(null);
          }}
        />
      )}
      {editingTx && selectedChild !== null && (
        <EditTransactionModal
          transaction={editingTx}
          token={token}
          apiUrl={apiUrl}
          onClose={() => setEditingTx(null)}
          onSuccess={async () => {
            await fetchLedger(selectedChild);
          }}
        />
      )}
      {editingCharge && selectedChild !== null && (
        <EditRecurringModal
          charge={editingCharge}
          token={token}
          apiUrl={apiUrl}
          onClose={() => setEditingCharge(null)}
          onSaved={async () => {
            await fetchCharges(selectedChild);
          }}
        />
      )}
      {confirmAction && (
        <ConfirmModal
          message={confirmAction.message}
          onConfirm={() => {
            confirmAction.onConfirm();
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
