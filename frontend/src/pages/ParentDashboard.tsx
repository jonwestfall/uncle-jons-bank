import { useCallback, useEffect, useMemo, useState } from 'react'
import EditRatesModal from '../components/EditRatesModal'
import ConfirmModal from '../components/ConfirmModal'
import EditRecurringModal from '../components/EditRecurringModal'
import EditTransactionModal from '../components/EditTransactionModal'
import TextPromptModal from '../components/TextPromptModal'
import ChildList from '../components/parentDashboard/ChildList'
import LedgerPanel from '../components/parentDashboard/LedgerPanel'
import ShareAccessManagement from '../components/parentDashboard/ShareAccessManagement'
import WithdrawalsPanel from '../components/parentDashboard/WithdrawalsPanel'
import { useToast } from '../components/ToastProvider'
import { createApiClient } from '../api/client'
import { createCdOffer } from '../api/cds'
import { toastApiError } from '../utils/apiError'
import { useChildren } from '../hooks/parentDashboard/useChildren'
import { useLedger } from '../hooks/parentDashboard/useLedger'
import { useRecurring } from '../hooks/parentDashboard/useRecurring'
import { useShareAccess } from '../hooks/parentDashboard/useShareAccess'
import { useWithdrawals } from '../hooks/parentDashboard/useWithdrawals'
import type { ChildAccount, RecurringCharge, Transaction, WithdrawalRequest } from '../types/domain'

interface Props {
  token: string
  apiUrl: string
  permissions: string[]
  onLogout: () => void
  currencySymbol: string
}

export default function ParentDashboard({ token, apiUrl, permissions, onLogout, currencySymbol }: Props) {
  const [firstName, setFirstName] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [editingChild, setEditingChild] = useState<ChildAccount | null>(null)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [editingCharge, setEditingCharge] = useState<RecurringCharge | null>(null)
  const [denyRequest, setDenyRequest] = useState<WithdrawalRequest | null>(null)
  const [actionChild, setActionChild] = useState<ChildAccount | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    message: string
    onConfirm: () => void | Promise<void>
  } | null>(null)

  const canEdit = permissions.includes('edit_transaction')
  const canDelete = permissions.includes('delete_transaction')
  const canAddRecurring = permissions.includes('add_recurring_charge')
  const canEditRecurring = permissions.includes('edit_recurring_charge')
  const canDeleteRecurring = permissions.includes('delete_recurring_charge')

  const { showToast } = useToast()
  const client = useMemo(
    () => createApiClient({ baseUrl: apiUrl, getToken: () => token }),
    [apiUrl, token],
  )

  const { children, loadingChildren, addChildError, fetchChildren, addChild, toggleFreeze, getChildName } = useChildren({
    client,
    showToast,
  })
  const { ledger, selectedChild, fetchLedger, openLedger, closeLedger, addTransaction, removeTransaction } = useLedger({
    client,
    showToast,
  })
  const { charges, fetchCharges, addCharge, removeCharge, clearCharges } = useRecurring({
    client,
    showToast,
  })
  const { pendingWithdrawals, loadingWithdrawals, fetchPendingWithdrawals, approve, deny } = useWithdrawals({
    client,
    showToast,
  })
  const {
    codeChild,
    setCodeChild,
    sharingChild,
    setSharingChild,
    redeemOpen,
    setRedeemOpen,
    accessChild,
    setAccessChild,
    accessParents,
    openAccess,
    removeAccess,
    createShareCode,
    redeemCode,
    updateCode,
  } = useShareAccess({
    client,
    showToast,
  })

  useEffect(() => {
    fetchChildren()
    fetchPendingWithdrawals()
  }, [fetchChildren, fetchPendingWithdrawals])

  const handleCloseLedger = useCallback(() => {
    closeLedger()
    clearCharges()
  }, [clearCharges, closeLedger])

  const handleViewLedger = useCallback(
    async (child: ChildAccount) => {
      handleCloseLedger()
      await Promise.all([openLedger(child.id), fetchCharges(child.id)])
    },
    [fetchCharges, handleCloseLedger, openLedger],
  )

  const handleApproveWithdrawal = useCallback(
    async (withdrawal: WithdrawalRequest) => {
      const success = await approve(withdrawal.id)
      if (!success || selectedChild !== withdrawal.child_id) {
        return
      }
      await fetchLedger(withdrawal.child_id)
    },
    [approve, fetchLedger, selectedChild],
  )

  const handleOfferCd = useCallback(
    async (input: { child_id: number; amount: number; interest_rate: number; term_days: number }) => {
      try {
        await createCdOffer(client, input)
        showToast('CD offer sent!')
      } catch (error) {
        toastApiError(showToast, error, 'Failed to send CD offer')
      }
    },
    [client, showToast],
  )

  return (
    <div className="container">
      <WithdrawalsPanel
        loading={loadingWithdrawals}
        withdrawals={pendingWithdrawals}
        currencySymbol={currencySymbol}
        getChildName={getChildName}
        onApprove={handleApproveWithdrawal}
        onDeny={setDenyRequest}
      />

      <ChildList
        children={children}
        loading={loadingChildren}
        currencySymbol={currencySymbol}
        onViewLedger={handleViewLedger}
        onOpenActions={(child) => {
          handleCloseLedger()
          setActionChild(child)
        }}
      />

      <button onClick={() => setRedeemOpen(true)}>Redeem Share Code</button>

      <ShareAccessManagement
        actionChild={actionChild}
        onCloseActions={() => setActionChild(null)}
        onRequestRatesEdit={setEditingChild}
        onToggleFreeze={(child) => {
          void toggleFreeze(child.id, child.frozen)
        }}
        onRequestCodeUpdate={setCodeChild}
        onRequestShare={setSharingChild}
        onRequestAccess={(child) => {
          void openAccess(child)
        }}
        onViewLedger={(child) => {
          void handleViewLedger(child)
        }}
        sharingChild={sharingChild}
        onCreateShareCode={async (sharePermissions) => {
          await createShareCode(sharePermissions)
        }}
        onCloseShare={() => setSharingChild(null)}
        accessChild={accessChild}
        accessParents={accessParents}
        onRemoveAccess={async (parentId) => {
          await removeAccess(parentId)
        }}
        onCloseAccess={() => setAccessChild(null)}
        redeemOpen={redeemOpen}
        onRedeemCode={async (value) => {
          const success = await redeemCode(value)
          if (success) {
            await fetchChildren()
          }
        }}
        onCloseRedeem={() => setRedeemOpen(false)}
        codeChild={codeChild}
        onUpdateCode={async (child, value) => {
          await updateCode(child, value)
          await fetchChildren()
        }}
        onCloseCodePrompt={() => setCodeChild(null)}
      />

      <LedgerPanel
        ledger={ledger}
        selectedChild={selectedChild}
        charges={charges}
        currencySymbol={currencySymbol}
        canEdit={canEdit}
        canDelete={canDelete}
        canAddRecurring={canAddRecurring}
        canEditRecurring={canEditRecurring}
        canDeleteRecurring={canDeleteRecurring}
        onCloseLedger={handleCloseLedger}
        onEditTransaction={setEditingTx}
        onDeleteTransaction={(transaction) => {
          if (selectedChild === null) {
            return
          }
          setConfirmAction({
            message: 'Delete transaction?',
            onConfirm: async () => {
              await removeTransaction(transaction.id, selectedChild)
            },
          })
        }}
        onEditCharge={setEditingCharge}
        onDeleteCharge={(charge) => {
          if (selectedChild === null) {
            return
          }
          setConfirmAction({
            message: 'Delete charge?',
            onConfirm: async () => {
              await removeCharge(charge.id, selectedChild)
            },
          })
        }}
        onAddTransaction={addTransaction}
        onAddCharge={addCharge}
        onOfferCd={handleOfferCd}
        showError={(message) => showToast(message, 'error')}
      />

      <form
        onSubmit={async (event) => {
          event.preventDefault()
          const success = await addChild(firstName, accessCode)
          if (!success) {
            return
          }
          setFirstName('')
          setAccessCode('')
        }}
        className="form"
      >
        <h4>Add Child</h4>
        {addChildError && <p className="error">{addChildError}</p>}
        <label>
          First name
          <input value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
        </label>
        <label>
          Access code
          <input value={accessCode} onChange={(event) => setAccessCode(event.target.value)} required />
        </label>
        <button type="submit">Add</button>
      </form>

      {editingChild && (
        <EditRatesModal
          child={editingChild}
          token={token}
          apiUrl={apiUrl}
          onClose={() => setEditingChild(null)}
          onSuccess={(message) => {
            showToast(message)
            void fetchChildren()
          }}
          onError={(message) => {
            showToast(message, 'error')
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
            await fetchLedger(selectedChild)
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
            await fetchCharges(selectedChild)
          }}
        />
      )}

      {denyRequest && (
        <TextPromptModal
          title="Deny Withdrawal"
          label="Reason"
          onCancel={() => setDenyRequest(null)}
          onSubmit={async (reason) => {
            await deny(denyRequest.id, reason)
            setDenyRequest(null)
          }}
        />
      )}

      {confirmAction && (
        <ConfirmModal
          message={confirmAction.message}
          onConfirm={() => {
            void confirmAction.onConfirm()
            setConfirmAction(null)
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      <button onClick={onLogout}>Logout</button>
    </div>
  )
}
