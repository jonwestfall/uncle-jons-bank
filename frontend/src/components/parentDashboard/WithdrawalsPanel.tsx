import { formatCurrency } from '../../utils/currency'
import type { WithdrawalRequest } from '../../types/domain'

interface WithdrawalsPanelProps {
  loading: boolean
  withdrawals: WithdrawalRequest[]
  currencySymbol: string
  getChildName: (childId: number) => string
  onApprove: (withdrawal: WithdrawalRequest) => void
  onDeny: (withdrawal: WithdrawalRequest) => void
}

export default function WithdrawalsPanel({
  loading,
  withdrawals,
  currencySymbol,
  getChildName,
  onApprove,
  onDeny,
}: WithdrawalsPanelProps) {
  if (loading) {
    return <p>Loading withdrawals...</p>
  }

  if (withdrawals.length === 0) {
    return null
  }

  return (
    <div>
      <h4>Pending Withdrawal Requests</h4>
      <ul className="list">
        {withdrawals.map((withdrawal) => (
          <li key={withdrawal.id}>
            {getChildName(withdrawal.child_id)} requested{' '}
            {formatCurrency(withdrawal.amount, currencySymbol)}
            {withdrawal.memo ? ` (${withdrawal.memo})` : ''} on{' '}
            {new Date(withdrawal.requested_at).toLocaleDateString()}
            <button onClick={() => onApprove(withdrawal)} className="ml-1">
              Approve
            </button>
            <button onClick={() => onDeny(withdrawal)} className="ml-05">
              Deny
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
