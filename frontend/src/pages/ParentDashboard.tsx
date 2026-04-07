import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useToast } from "../components/ToastProvider";
import { createApiClient } from "../api/client";
import {
  createChild,
  createChildShareCode,
  freezeChild,
  getChildParents,
  listChildren,
  redeemShareCode,
  removeChildParentAccess,
  unfreezeChild,
  updateChildAccessCode,
  type ChildApi,
  type ChildParentInfo,
} from "../api/children";
import {
  createTransaction,
  deleteTransaction,
  getChildLedger,
  type LedgerResponse,
} from "../api/transactions";
import {
  createRecurringForChild,
  deleteRecurring,
  listChildRecurring,
  type RecurringCharge,
} from "../api/recurring";
import {
  approveWithdrawal,
  denyWithdrawal,
  listPendingWithdrawals,
  type WithdrawalRequest,
} from "../api/withdrawals";
import { createCdOffer } from "../api/cds";
import { toastApiError, mapApiErrorMessage } from "../utils/apiError";

interface Child {
  id: number;
  first_name: string;
  frozen: boolean;
  interest_rate?: number;
  penalty_interest_rate?: number;
  cd_penalty_rate?: number;
  total_interest_earned?: number;
  balance?: number;
  last_activity?: string;
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
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);
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
  const [accessParents, setAccessParents] = useState<ChildParentInfo[]>([]);
  const [actionChild, setActionChild] = useState<Child | null>(null);
  const [editingCharge, setEditingCharge] = useState<RecurringCharge | null>(null);
  const [actionTab, setActionTab] = useState<'account' | 'share' | 'ledger'>('account');
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
  const { showToast } = useToast();
  const client = useMemo(
    () => createApiClient({ baseUrl: apiUrl, getToken: () => token }),
    [apiUrl, token],
  );

  const getChildName = useCallback(
    (id: number) => children.find((c) => c.id === id)?.first_name || `Child ${id}`,
    [children],
  );

  const closeLedger = () => {
    setLedger(null);
    setSelectedChild(null);
    setCharges([]);
  };

  const fetchChildren = useCallback(async () => {
    setLoadingChildren(true);
    try {
      const data = await listChildren(client);
      const enriched = await Promise.all(
        data.map(async (c: ChildApi) => {
          let balance: number | undefined;
          let last_activity: string | undefined;
          try {
            const lr = await getChildLedger(client, c.id);
            balance = lr.balance;
            last_activity = lr.transactions[0]?.timestamp;
          } catch {
            /* ignore */
          }
          return {
            id: c.id,
            first_name: c.first_name,
            frozen: c.frozen ?? c.account_frozen ?? false,
            interest_rate: c.interest_rate,
            penalty_interest_rate: c.penalty_interest_rate,
            cd_penalty_rate: c.cd_penalty_rate,
            total_interest_earned: c.total_interest_earned,
            balance,
            last_activity,
          } as Child;
        }),
      );
      setChildren(enriched);
    } catch (error) {
      toastApiError(showToast, error, "Failed to load children");
    } finally {
      setLoadingChildren(false);
    }
  }, [client, showToast]);

  const fetchLedger = useCallback(
    async (cid: number) => {
      try {
        setLedger(await getChildLedger(client, cid));
      } catch (error) {
        toastApiError(showToast, error, "Failed to load ledger");
      }
    },
    [client, showToast],
  );

  const fetchCharges = useCallback(
    async (cid: number) => {
      try {
        setCharges(await listChildRecurring(client, cid));
      } catch {
        setCharges([]);
      }
    },
    [client],
  );

  const fetchPendingWithdrawals = useCallback(async () => {
    setLoadingWithdrawals(true);
    try {
      setPendingWithdrawals(await listPendingWithdrawals(client));
    } catch (error) {
      toastApiError(showToast, error, "Failed to load withdrawals");
    } finally {
      setLoadingWithdrawals(false);
    }
  }, [client, showToast]);

  useEffect(() => {
    fetchChildren();
    fetchPendingWithdrawals();
  }, [fetchChildren, fetchPendingWithdrawals]);


  const toggleFreeze = async (childId: number, frozen: boolean) => {
    try {
      if (frozen) {
        await unfreezeChild(client, childId);
      } else {
        await freezeChild(client, childId);
      }
      await fetchChildren();
    } catch (error) {
      toastApiError(showToast, error, "Action failed");
    }
  };

  const openAccess = async (child: Child) => {
    try {
      setAccessParents(await getChildParents(client, child.id));
      setAccessChild(child);
    } catch (error) {
      toastApiError(showToast, error, "Failed to load access");
    }
  };

  return (
    <div className="container">
      {loadingWithdrawals ? (
        <p>Loading withdrawals...</p>
      ) : (
        pendingWithdrawals.length > 0 && (
          <div>
            <h4>Pending Withdrawal Requests</h4>
            <ul className="list">
              {pendingWithdrawals.map((w) => (
                <li key={w.id}>
                  {getChildName(w.child_id)} requested {formatCurrency(w.amount, currencySymbol)}
                  {w.memo ? ` (${w.memo})` : ""} on {new Date(w.requested_at).toLocaleDateString()}
                  <button
                    onClick={async () => {
                      try {
                        await approveWithdrawal(client, w.id);
                        await fetchPendingWithdrawals();
                        if (selectedChild === w.child_id) {
                          await fetchLedger(w.child_id);
                        }
                      } catch (error) {
                        toastApiError(showToast, error, "Failed to approve withdrawal");
                      }
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
        )
      )}
      <h2>Your Children</h2>
      {loadingChildren ? (
        <p>Loading children...</p>
      ) : (
        <ul className="list">
          {children.map((c) => (
            <li key={c.id}>
              <div className="child-card">
                <div>
                  {c.first_name} {c.frozen && "(Frozen)"} -
                  {c.balance !== undefined
                    ? ` ${formatCurrency(c.balance, currencySymbol)}`
                    : ""}
                  {c.last_activity
                    ? ` (Last: ${new Date(c.last_activity).toLocaleDateString()})`
                    : ""}
                </div>
                <div className="child-actions">
                  <button
                    onClick={() => {
                      closeLedger();
                      fetchLedger(c.id);
                      fetchCharges(c.id);
                      setSelectedChild(c.id);
                    }}
                  >
                    View Ledger
                  </button>
                  <button
                    onClick={() => {
                      closeLedger();
                      setActionChild(c);
                      setActionTab('account');
                    }}
                  >
                    Actions
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button onClick={() => setRedeemOpen(true)}>Redeem Share Code</button>
      {actionChild && (
        <div
          className="modal-overlay"
          onClick={() => setActionChild(null)}
        >
          <div
            className="modal actions-modal"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <h3>Actions for {actionChild.first_name}</h3>
            <div className="tabs">
              <button
                onClick={() => setActionTab('account')}
                className={actionTab === 'account' ? 'selected' : ''}
              >
                💼 Account
              </button>
              <button
                onClick={() => setActionTab('share')}
                className={actionTab === 'share' ? 'selected' : ''}
              >
                👥 Share
              </button>
              <button
                onClick={() => setActionTab('ledger')}
                className={actionTab === 'ledger' ? 'selected' : ''}
              >
                📄 Ledger
              </button>
            </div>
            <div className="child-actions">
              {actionTab === 'account' && (
                <>
                  <button
                    onClick={() => {
                      closeLedger();
                      setEditingChild(actionChild);
                      setActionChild(null);
                    }}
                  >
                    💱 Rates
                  </button>
                  <button
                    onClick={() => {
                      closeLedger();
                      toggleFreeze(actionChild.id, actionChild.frozen);
                      setActionChild(null);
                    }}
                  >
                    {actionChild.frozen ? '🔓 Unfreeze' : '🔒 Freeze'}
                  </button>
                  <button
                    onClick={() => {
                      closeLedger();
                      setCodeChild(actionChild);
                      setActionChild(null);
                    }}
                  >
                    🔑 Change Code
                  </button>
                </>
              )}
              {actionTab === 'share' && (
                <>
                  <button
                    onClick={() => {
                      closeLedger();
                      setSharingChild(actionChild);
                      setActionChild(null);
                    }}
                  >
                    📤 Share
                  </button>
                  <button
                    onClick={() => {
                      closeLedger();
                      openAccess(actionChild);
                      setActionChild(null);
                    }}
                  >
                    👥 Manage Access
                  </button>
                </>
              )}
              {actionTab === 'ledger' && (
                <button
                  onClick={() => {
                    closeLedger();
                    fetchLedger(actionChild.id);
                    fetchCharges(actionChild.id);
                    setSelectedChild(actionChild.id);
                    setActionChild(null);
                  }}
                >
                  📊 View Ledger
                </button>
              )}
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
                          try {
                            await deleteTransaction(client, tx.id);
                            if (selectedChild !== null) {
                              await fetchLedger(selectedChild);
                            }
                          } catch (error) {
                            toastApiError(showToast, error, "Failed to delete transaction");
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
                          try {
                            await deleteRecurring(client, c.id);
                            fetchCharges(selectedChild);
                          } catch (error) {
                            toastApiError(showToast, error, "Failed to delete charge");
                          }
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
          showToast("Next run cannot be in the past", "error");
                  return;
                }
                try {
                  await createRecurringForChild(client, selectedChild, {
                    amount: Number(rcAmount),
                    memo: rcMemo || null,
                    interval_days: Number(rcInterval),
                    next_run: rcNext,
                    type: rcType,
                  });
                } catch (error) {
                  toastApiError(showToast, error, "Action failed");
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
              try {
                await createTransaction(client, {
                  child_id: selectedChild,
                  type: txType,
                  amount: Number(txAmount),
                  memo: txMemo || null,
                  initiated_by: "parent",
                  initiator_id: 0,
                });
              } catch (error) {
                toastApiError(showToast, error, "Action failed");
                return;
              }
              setTxAmount("");
              setTxMemo("");
              setTxType("credit");
              if (selectedChild !== null) {
                await fetchLedger(selectedChild);
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
            try {
              await createCdOffer(client, {
                child_id: selectedChild,
                amount: Number(cdAmount),
                interest_rate: Number(cdRate),
                term_days: Number(cdDays),
              });
              showToast("CD offer sent!");
            } catch (error) {
              toastApiError(showToast, error, "Failed to send CD offer");
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
            await createChild(client, {
              first_name: firstName,
              access_code: accessCode,
            });
            setFirstName("");
            setAccessCode("");
            fetchChildren();
          } catch (error) {
            setErrorMessage(mapApiErrorMessage(error, "Failed to add child. Please try again."));
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
            showToast(msg);
            fetchChildren();
          }}
          onError={(msg) => {
            showToast(msg, "error");
          }}
        />
      )}
      {sharingChild && (
        <ShareChildModal
          onSubmit={async (perms) => {
            try {
              const data = await createChildShareCode(client, sharingChild.id, perms);
              showToast(`Share code: ${data.code}`);
            } catch (error) {
              toastApiError(showToast, error, "Failed to generate code");
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
            try {
              await removeChildParentAccess(client, accessChild.id, pid);
              openAccess(accessChild);
            } catch (error) {
              toastApiError(showToast, error, "Failed to remove access");
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
            try {
              await redeemShareCode(client, value);
              showToast("Child linked");
              fetchChildren();
            } catch (error) {
              toastApiError(showToast, error, "Invalid code");
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
            try {
              await updateChildAccessCode(client, codeChild.id, value);
              showToast("Access code updated");
            } catch (error) {
              toastApiError(showToast, error, "Failed to update access code");
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
            try {
              await denyWithdrawal(client, denyRequest.id, reason);
              await fetchPendingWithdrawals();
            } catch (error) {
              toastApiError(showToast, error, "Failed to deny withdrawal");
            }
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
