import { formatCurrency } from '../../utils/currency'
import type { CdOffer } from '../../types/domain'

interface ChildCdOffersPanelProps {
  cds: CdOffer[]
  currencySymbol: string
  onRedeemEarly: (cd: CdOffer) => void
  onAccept: (cd: CdOffer) => void
  onReject: (cd: CdOffer) => void
}

export default function ChildCdOffersPanel({
  cds,
  currencySymbol,
  onRedeemEarly,
  onAccept,
  onReject,
}: ChildCdOffersPanelProps) {
  if (cds.length === 0) {
    return null
  }

  return (
    <div>
      <h4>Special Savings Offers (CDs)</h4>
      <p className="help-text">
        A CD (Certificate of Deposit) is like a special piggy bank. You agree to leave your money in for a set time
        and earn extra money called interest.
      </p>
      <ul className="list">
        {cds.map((cd) => {
          const daysLeft = cd.matures_at ? Math.ceil((new Date(cd.matures_at).getTime() - Date.now()) / 86400000) : null
          return (
            <li key={cd.id}>
              {formatCurrency(cd.amount, currencySymbol)} for {cd.term_days} days at {(cd.interest_rate * 100).toFixed(2)}% - {cd.status}
              {cd.status === 'accepted' && daysLeft !== null && <span> (redeems in {daysLeft} days)</span>}
              {cd.status === 'accepted' && daysLeft !== null && daysLeft > 0 && (
                <button onClick={() => onRedeemEarly(cd)} className="ml-05">
                  Take Money Early
                </button>
              )}
              {cd.status === 'offered' && (
                <>
                  <button onClick={() => onAccept(cd)} className="ml-1">
                    Yes, Save It
                  </button>
                  <button onClick={() => onReject(cd)} className="ml-05">
                    No Thanks
                  </button>
                </>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
