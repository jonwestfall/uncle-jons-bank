import { useEffect, useMemo, useState } from 'react'
import ConfirmModal from '../components/ConfirmModal'
import ChildCdOffersPanel from '../components/childDashboard/ChildCdOffersPanel'
import ChildLedgerSection from '../components/childDashboard/ChildLedgerSection'
import ChildRecurringPanel from '../components/childDashboard/ChildRecurringPanel'
import ChildWithdrawalsPanel from '../components/childDashboard/ChildWithdrawalsPanel'
import { useToast } from '../components/ToastProvider'
import { createApiClient } from '../api/client'
import { useChildCds } from '../hooks/childDashboard/useChildCds'
import { useChildLedger } from '../hooks/childDashboard/useChildLedger'
import { useChildProfile } from '../hooks/childDashboard/useChildProfile'
import { useChildRecurring } from '../hooks/childDashboard/useChildRecurring'
import { useChildWithdrawals } from '../hooks/childDashboard/useChildWithdrawals'
import type { CdOffer, WithdrawalRequest } from '../types/domain'

interface Props {
  token: string
  childId: number
  apiUrl: string
  onLogout: () => void
  currencySymbol: string
}

export default function ChildDashboard({ token, childId, apiUrl, onLogout, currencySymbol }: Props) {
  const [tableWidth, setTableWidth] = useState<number>()
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void | Promise<void> } | null>(null)
  const { showToast } = useToast()
  const client = useMemo(
    () => createApiClient({ baseUrl: apiUrl, getToken: () => token }),
    [apiUrl, token],
  )

  const { ledger, loadingLedger, fetchLedger } = useChildLedger({ client, childId, showToast })
  const { childName, fetchChildName } = useChildProfile({ client, childId, showToast })
  const { withdrawals, fetchWithdrawals, requestWithdrawal, cancelRequest } = useChildWithdrawals({ client, showToast })
  const { charges, fetchCharges } = useChildRecurring({ client, showToast })
  const { cds, fetchCds, accept, reject, redeemEarly } = useChildCds({ client, showToast })

  useEffect(() => {
    fetchLedger()
    fetchWithdrawals()
    fetchChildName()
    fetchCds()
    fetchCharges()
  }, [fetchLedger, fetchWithdrawals, fetchChildName, fetchCds, fetchCharges])

  const onAcceptCd = async (cd: CdOffer) => {
    const success = await accept(cd.id)
    if (success) {
      await fetchLedger()
    }
  }

  const onRejectCd = async (cd: CdOffer) => {
    await reject(cd.id)
  }

  const onRedeemEarly = (cd: CdOffer) => {
    setConfirmAction({
      message: 'Take out this CD early? A 10% fee will be taken.',
      onConfirm: async () => {
        const success = await redeemEarly(cd.id)
        if (success) {
          await fetchLedger()
        }
      },
    })
  }

  return (
    <div className="container" style={{ width: tableWidth ? `${tableWidth}px` : undefined }}>
      <ChildLedgerSection
        childName={childName}
        ledger={ledger}
        loading={loadingLedger}
        currencySymbol={currencySymbol}
        tableWidth={tableWidth}
        onWidth={setTableWidth}
      />

      <ChildRecurringPanel charges={charges} currencySymbol={currencySymbol} />

      <ChildCdOffersPanel
        cds={cds}
        currencySymbol={currencySymbol}
        onRedeemEarly={onRedeemEarly}
        onAccept={(cd) => {
          void onAcceptCd(cd)
        }}
        onReject={(cd) => {
          void onRejectCd(cd)
        }}
      />

      <ChildWithdrawalsPanel
        withdrawals={withdrawals}
        currencySymbol={currencySymbol}
        onSubmitRequest={requestWithdrawal}
        onCancelRequest={(withdrawal: WithdrawalRequest) => {
          setConfirmAction({
            message: 'Cancel this request?',
            onConfirm: async () => {
              await cancelRequest(withdrawal.id)
            },
          })
        }}
      />

      <button onClick={onLogout}>Logout</button>

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
    </div>
  )
}
