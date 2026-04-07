import { formatCurrency } from '../../utils/currency'
import type { ChildAccount } from '../../types/domain'

interface ChildListProps {
  children: ChildAccount[]
  loading: boolean
  currencySymbol: string
  onViewLedger: (child: ChildAccount) => void
  onOpenActions: (child: ChildAccount) => void
}

export default function ChildList({
  children,
  loading,
  currencySymbol,
  onViewLedger,
  onOpenActions,
}: ChildListProps) {
  return (
    <>
      <h2>Your Children</h2>
      {loading ? (
        <p>Loading children...</p>
      ) : (
        <ul className="list">
          {children.map((child) => (
            <li key={child.id}>
              <div className="child-card">
                <div>
                  {child.first_name} {child.frozen && '(Frozen)'} -
                  {child.balance !== undefined ? ` ${formatCurrency(child.balance, currencySymbol)}` : ''}
                  {child.last_activity ? ` (Last: ${new Date(child.last_activity).toLocaleDateString()})` : ''}
                </div>
                <div className="child-actions">
                  <button onClick={() => onViewLedger(child)}>View Ledger</button>
                  <button onClick={() => onOpenActions(child)}>Actions</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
