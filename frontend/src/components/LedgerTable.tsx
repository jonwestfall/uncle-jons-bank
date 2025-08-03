import React, { useLayoutEffect, useRef, useState, useMemo } from 'react'
import { formatCurrency } from '../utils/currency'

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
  onWidth,
  allowDownload,
  currencySymbol,
}: {
  transactions: Transaction[]
  renderActions?: (tx: Transaction) => React.ReactNode
  onWidth?: (width: number) => void
  allowDownload?: boolean
  currencySymbol: string
}) {
  const tableRef = useRef<HTMLTableElement>(null)
  const [pageSize, setPageSize] = useState(15)
  const [currentPage, setCurrentPage] = useState(0)
  const [sortColumn, setSortColumn] = useState<keyof Transaction>('timestamp')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  useLayoutEffect(() => {
    if (tableRef.current && onWidth) {
      onWidth(tableRef.current.scrollWidth)
    }
  }, [transactions, onWidth])

  const sorted = useMemo(() => {
    const arr = [...transactions]
    arr.sort((a, b) => {
      let av: number | string = ''
      let bv: number | string = ''
      switch (sortColumn) {
        case 'timestamp':
          av = new Date(a.timestamp).getTime()
          bv = new Date(b.timestamp).getTime()
          break
        case 'memo':
          av = a.memo || ''
          bv = b.memo || ''
          break
        case 'type':
          av = a.type
          bv = b.type
          break
        case 'amount':
        default:
          av = a.amount
          bv = b.amount
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [transactions, sortColumn, sortDir])

  const pageCount = Math.ceil(sorted.length / pageSize) || 1
  const startIndex = currentPage * pageSize
  const currentItems = sorted.slice(
    startIndex,
    startIndex + pageSize,
  )

  const balanceMap = useMemo(() => {
    const arr = [...transactions]
    arr.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )
    let bal = 0
    const map = new Map<number, number>()
    arr.forEach(tx => {
      bal += tx.type === 'credit' ? tx.amount : -tx.amount
      map.set(tx.id, bal)
    })
    return map
  }, [transactions])

  const displayRows = currentItems.map(tx => (
    <tr key={tx.id}>
      <td>{new Date(tx.timestamp).toLocaleDateString()}</td>
      <td>{tx.type}</td>
      <td>{tx.memo || ''}</td>
      <td>{tx.type === 'debit' ? formatCurrency(tx.amount, currencySymbol) : ''}</td>
      <td>{tx.type === 'credit' ? formatCurrency(tx.amount, currencySymbol) : ''}</td>
      <td>{formatCurrency(balanceMap.get(tx.id) ?? 0, currencySymbol)}</td>
      {renderActions && <td>{renderActions(tx)}</td>}
    </tr>
  ))

  const handleHeaderClick = (col: keyof Transaction | 'amount') => {
    if (sortColumn === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(col as keyof Transaction)
      setSortDir('asc')
    }
  }

  const exportCsv = () => {
    const rows = [
      ['Date', 'Type', 'Description / Payee', 'Payment (-)', 'Deposit (+)', 'Balance'],
    ]
    sorted.forEach(tx => {
      rows.push([
        new Date(tx.timestamp).toLocaleDateString(),
        tx.type,
        tx.memo || '',
        tx.type === 'debit' ? formatCurrency(tx.amount, currencySymbol) : '',
        tx.type === 'credit' ? formatCurrency(tx.amount, currencySymbol) : '',
        formatCurrency(balanceMap.get(tx.id) ?? 0, currencySymbol),
      ])
    })
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ledger.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="table-wrapper">
        <table ref={tableRef} className="ledger-table">
        <thead>
          <tr>
            <th className="sortable" onClick={() => handleHeaderClick('timestamp')}>
              Date {sortColumn === 'timestamp' && (sortDir === 'asc' ? '▲' : '▼')}
            </th>
            <th className="sortable" onClick={() => handleHeaderClick('type')}>
              Type {sortColumn === 'type' && (sortDir === 'asc' ? '▲' : '▼')}
            </th>
            <th className="sortable" onClick={() => handleHeaderClick('memo')}>
              Description / Payee{' '}
              {sortColumn === 'memo' && (sortDir === 'asc' ? '▲' : '▼')}
            </th>
            <th className="sortable" onClick={() => handleHeaderClick('amount')}>
              Payment (-){' '}
              {sortColumn === 'amount' && (sortDir === 'asc' ? '▲' : '▼')}
            </th>
            <th className="sortable" onClick={() => handleHeaderClick('amount')}>
              Deposit (+){' '}
              {sortColumn === 'amount' && (sortDir === 'asc' ? '▲' : '▼')}
            </th>
            <th>Balance</th>
            {renderActions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>{displayRows}</tbody>
        </table>
      </div>
      <div className="table-controls">
        <div>
          <label>
            Show
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value))
                setCurrentPage(0)
              }}
            >
              {[15, 30, 60, 90].map(n => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            entries
          </label>
        </div>
        <div>
          <button
            onClick={() => setCurrentPage(p => Math.max(p - 1, 0))}
            disabled={currentPage === 0}
          >
            Prev
          </button>
          <span className="ml-05">
            Page {currentPage + 1} of {pageCount}
          </span>
          <button
            className="ml-05"
            onClick={() =>
              setCurrentPage(p => (p + 1 < pageCount ? p + 1 : p))
            }
            disabled={currentPage + 1 >= pageCount}
          >
            Next
          </button>
          {allowDownload && (
            <button className="ml-1" onClick={exportCsv}>
              Download CSV
            </button>
          )}
        </div>
      </div>
    </>
  )
}
