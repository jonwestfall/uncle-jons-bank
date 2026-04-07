import { Link } from 'react-router-dom'
import LedgerTable from '../LedgerTable'
import { formatCurrency } from '../../utils/currency'
import type { LedgerResponse } from '../../types/domain'

interface ChildLedgerSectionProps {
  childName: string
  ledger: LedgerResponse | null
  loading: boolean
  currencySymbol: string
  tableWidth?: number
  onWidth: (width: number) => void
}

export default function ChildLedgerSection({
  childName,
  ledger,
  loading,
  currencySymbol,
  tableWidth,
  onWidth,
}: ChildLedgerSectionProps) {
  return (
    <>
      <h2>{childName ? `${childName}'s Account` : 'Your Ledger'}</h2>
      {loading ? (
        <p>Loading...</p>
      ) : (
        ledger && (
          <>
            <p>Balance: {formatCurrency(ledger.balance, currencySymbol)}</p>
            <p className="help-text">
              This is how much money you have right now. Money you add makes it go up. Money you spend makes it go down.
            </p>
            <LedgerTable
              transactions={ledger.transactions}
              onWidth={(width) => !tableWidth && onWidth(width)}
              currencySymbol={currencySymbol}
            />
          </>
        )
      )}
      <div>
        <h4>Borrowing Money (Loans)</h4>
        <p className="help-text">
          Need to buy something but don't have enough saved? You can ask your grown-up for a loan. A loan lets you
          borrow money now and pay it back later, sometimes with a little extra called interest. Visit the{' '}
          <Link to="/child/loans">Loans</Link> page to request one or see what you owe.
        </p>
      </div>
    </>
  )
}
