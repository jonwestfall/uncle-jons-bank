import { formatCurrency } from '../../utils/currency'
import type { RecurringCharge } from '../../types/domain'

interface ChildRecurringPanelProps {
  charges: RecurringCharge[]
  currencySymbol: string
}

export default function ChildRecurringPanel({ charges, currencySymbol }: ChildRecurringPanelProps) {
  if (charges.length === 0) {
    return null
  }

  return (
    <div>
      <h4>Automatic Money Moves</h4>
      <p className="help-text">These happen on their own, like getting allowance every week.</p>
      <ul className="list">
        {charges.map((charge) => (
          <li key={charge.id}>
            A {charge.type} of {formatCurrency(charge.amount, currencySymbol)} every {charge.interval_days} day(s),
            next on {new Date(`${charge.next_run}T00:00:00`).toLocaleDateString()} {charge.memo ? `(Memo: ${charge.memo})` : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}
