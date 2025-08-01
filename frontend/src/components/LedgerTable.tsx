import React from 'react'

export interface Transaction {
  id: number
  child_id: number
  type: string
  amount: number
  memo?: string | null
  initiated_by: string
  initiator_id: number
  timestamp: string
}

export default function LedgerTable({
  transactions,
  renderActions,
}: {
  transactions: Transaction[]
  renderActions?: (tx: Transaction) => React.ReactNode
}) {
  let runningBalance = 0
  return (
    <table className="ledger-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Description / Payee</th>
          <th>Payment (-)</th>
          <th>Deposit (+)</th>
          <th>Balance</th>
          {renderActions && <th>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {transactions.map(tx => {
          if (tx.type === 'credit') {
            runningBalance += tx.amount
          } else {
            runningBalance -= tx.amount
          }
          return (
            <tr key={tx.id}>
              <td>{new Date(tx.timestamp).toLocaleDateString()}</td>
              <td>{tx.type}</td>
              <td>{tx.memo || ''}</td>
              <td>{tx.type === 'debit' ? tx.amount.toFixed(2) : ''}</td>
              <td>{tx.type === 'credit' ? tx.amount.toFixed(2) : ''}</td>
              <td>{runningBalance.toFixed(2)}</td>
              {renderActions && <td>{renderActions(tx)}</td>}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
