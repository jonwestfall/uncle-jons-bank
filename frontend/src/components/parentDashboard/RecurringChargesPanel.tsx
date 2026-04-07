import type { RecurringCharge } from '../../types/domain'
import { formatCurrency } from '../../utils/currency'

interface RecurringChargesPanelProps {
  charges: RecurringCharge[]
  currencySymbol: string
  canEditRecurring: boolean
  canDeleteRecurring: boolean
  onEditCharge: (charge: RecurringCharge) => void
  onDeleteCharge: (charge: RecurringCharge) => void
}

export default function RecurringChargesPanel({
  charges,
  currencySymbol,
  canEditRecurring,
  canDeleteRecurring,
  onEditCharge,
  onDeleteCharge,
}: RecurringChargesPanelProps) {
  return (
    <>
      <h4>Recurring Transactions</h4>
      <ul className="list">
        {charges.map((charge) => (
          <li key={charge.id}>
            {charge.type} {formatCurrency(charge.amount, currencySymbol)} every {charge.interval_days} days next on{' '}
            {new Date(`${charge.next_run}T00:00:00`).toLocaleDateString()} {charge.memo ? `(${charge.memo})` : ''}
            {canEditRecurring && (
              <button onClick={() => onEditCharge(charge)} className="ml-1">
                Edit
              </button>
            )}
            {canDeleteRecurring && (
              <button onClick={() => onDeleteCharge(charge)} className="ml-05">
                &times;
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
