import { useState } from 'react'
import LedgerTable from '../LedgerTable'
import RecurringChargesPanel from './RecurringChargesPanel'
import { formatCurrency } from '../../utils/currency'
import type { LedgerResponse, RecurringCharge, Transaction } from '../../types/domain'

interface LedgerPanelProps {
  ledger: LedgerResponse | null
  selectedChild: number | null
  charges: RecurringCharge[]
  currencySymbol: string
  canEdit: boolean
  canDelete: boolean
  canAddRecurring: boolean
  canEditRecurring: boolean
  canDeleteRecurring: boolean
  onCloseLedger: () => void
  onEditTransaction: (transaction: Transaction) => void
  onDeleteTransaction: (transaction: Transaction) => void
  onEditCharge: (charge: RecurringCharge) => void
  onDeleteCharge: (charge: RecurringCharge) => void
  onAddTransaction: (input: { childId: number; type: string; amount: number; memo?: string | null }) => Promise<boolean>
  onAddCharge: (input: {
    childId: number
    amount: number
    memo?: string | null
    interval_days: number
    next_run: string
    type: string
  }) => Promise<boolean>
  onOfferCd: (input: { child_id: number; amount: number; interest_rate: number; term_days: number }) => Promise<void>
  showError: (message: string) => void
}

export default function LedgerPanel({
  ledger,
  selectedChild,
  charges,
  currencySymbol,
  canEdit,
  canDelete,
  canAddRecurring,
  canEditRecurring,
  canDeleteRecurring,
  onCloseLedger,
  onEditTransaction,
  onDeleteTransaction,
  onEditCharge,
  onDeleteCharge,
  onAddTransaction,
  onAddCharge,
  onOfferCd,
  showError,
}: LedgerPanelProps) {
  const [txType, setTxType] = useState('credit')
  const [txAmount, setTxAmount] = useState('')
  const [txMemo, setTxMemo] = useState('')

  const [rcAmount, setRcAmount] = useState('')
  const [rcType, setRcType] = useState('debit')
  const [rcMemo, setRcMemo] = useState('')
  const [rcInterval, setRcInterval] = useState('')
  const [rcNext, setRcNext] = useState('')

  const [cdAmount, setCdAmount] = useState('')
  const [cdRate, setCdRate] = useState('')
  const [cdDays, setCdDays] = useState('')

  if (!ledger || selectedChild === null) {
    return null
  }

  return (
    <div className="ledger-area">
      <div className="ledger-header">
        <h4>Ledger for child #{selectedChild}</h4>
        <button onClick={onCloseLedger}>Close Ledger</button>
      </div>
      <p>Balance: {formatCurrency(ledger.balance, currencySymbol)}</p>
      <div className="ledger-scroll">
        <LedgerTable
          transactions={ledger.transactions}
          allowDownload
          currencySymbol={currencySymbol}
          renderActions={(transaction) => (
            <>
              {canEdit && transaction.initiated_by !== 'system' && (
                <button onClick={() => onEditTransaction(transaction)} className="ml-1">
                  Edit
                </button>
              )}
              {canDelete && transaction.initiated_by !== 'system' && (
                <button aria-label="Delete transaction" onClick={() => onDeleteTransaction(transaction)} className="ml-05">
                  &times;
                </button>
              )}
            </>
          )}
        />
      </div>

      <RecurringChargesPanel
        charges={charges}
        currencySymbol={currencySymbol}
        canEditRecurring={canEditRecurring}
        canDeleteRecurring={canDeleteRecurring}
        onEditCharge={onEditCharge}
        onDeleteCharge={onDeleteCharge}
      />

      {canAddRecurring && (
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            const nextDate = new Date(`${rcNext}T00:00:00`)
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            if (nextDate < today) {
              showError('Next run cannot be in the past')
              return
            }

            const success = await onAddCharge({
              childId: selectedChild,
              amount: Number(rcAmount),
              memo: rcMemo || null,
              interval_days: Number(rcInterval),
              next_run: rcNext,
              type: rcType,
            })
            if (!success) {
              return
            }
            setRcAmount('')
            setRcType('debit')
            setRcMemo('')
            setRcInterval('')
            setRcNext('')
          }}
          className="form"
        >
          <h4>Add Recurring Transaction</h4>
          These may be useful for direct deposits (like weekly allowance) or for services your child wants (e.g., a
          gaming subscription or cell phone)
          <label>
            Type
            <select value={rcType} onChange={(event) => setRcType(event.target.value)}>
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
          </label>
          <label>
            Amount
            <input type="number" step="0.01" value={rcAmount} onChange={(event) => setRcAmount(event.target.value)} required />
          </label>
          <label>
            Memo
            <input value={rcMemo} onChange={(event) => setRcMemo(event.target.value)} />
          </label>
          <label>
            Interval days
            <input type="number" value={rcInterval} onChange={(event) => setRcInterval(event.target.value)} required />
          </label>
          <label>
            Next run
            <input type="date" value={rcNext} onChange={(event) => setRcNext(event.target.value)} required />
          </label>
          <button type="submit">Add</button>
        </form>
      )}

      <form
        onSubmit={async (event) => {
          event.preventDefault()
          const success = await onAddTransaction({
            childId: selectedChild,
            type: txType,
            amount: Number(txAmount),
            memo: txMemo || null,
          })
          if (!success) {
            return
          }
          setTxAmount('')
          setTxMemo('')
          setTxType('credit')
        }}
        className="form"
      >
        <h4>Add Transaction</h4>
        <label>
          Type
          <select value={txType} onChange={(event) => setTxType(event.target.value)}>
            <option value="credit">Credit</option>
            <option value="debit">Debit</option>
          </select>
        </label>
        <label>
          Amount
          <input type="number" step="0.01" value={txAmount} onChange={(event) => setTxAmount(event.target.value)} required />
        </label>
        <label>
          Memo
          <input value={txMemo} onChange={(event) => setTxMemo(event.target.value)} />
        </label>
        <button type="submit">Add</button>
      </form>

      <form
        onSubmit={async (event) => {
          event.preventDefault()
          await onOfferCd({
            child_id: selectedChild,
            amount: Number(cdAmount),
            interest_rate: Number(cdRate),
            term_days: Number(cdDays),
          })
          setCdAmount('')
          setCdRate('')
          setCdDays('')
        }}
        className="form"
      >
        <h4>Offer CD</h4>
        <label>
          Amount To Invest in CD
          <input type="number" step="0.01" value={cdAmount} onChange={(event) => setCdAmount(event.target.value)} required />
        </label>
        <label>
          Rate in Decimal (0.05 for 5%)
          <input type="number" step="0.0001" value={cdRate} onChange={(event) => setCdRate(event.target.value)} required />
        </label>
        <label>
          Days until Maturity
          <input type="number" value={cdDays} onChange={(event) => setCdDays(event.target.value)} required />
        </label>
        <button type="submit">Send Offer</button>
      </form>
    </div>
  )
}
