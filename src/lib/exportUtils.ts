// =====================================================================
// CSV / Excel Export Utility
// Pure TypeScript — zero external dependencies.
// Generates a proper UTF-8 BOM CSV that Excel opens correctly in Arabic.
// =====================================================================

import type { Transaction } from '@/types'
import { formatCurrency, getActiveWalletSymbol } from './utils'

/**
 * Trigger a file download in the browser.
 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Escape a CSV cell value (wrap in quotes if it contains comma, quote, or newline).
 */
function escapeCsvCell(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Build a CSV string from rows of cells.
 */
function buildCsv(headers: string[], rows: (string | number | undefined | null)[][]): string {
  const lines: string[] = []
  lines.push(headers.map(escapeCsvCell).join(','))
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','))
  }
  return lines.join('\r\n')
}

/**
 * Export an array of transactions to a CSV file that opens correctly in Excel (Arabic).
 * Includes UTF-8 BOM so Excel reads Arabic text correctly.
 */
export function exportTransactionsToCsv(transactions: Transaction[], filename?: string): void {
  const currencySymbol = getActiveWalletSymbol()
  const headers = [
    'الرقم التسلسلي',
    'الجهة / العميل',
    'النوع',
    'النوع الفرعي',
    'اسم الشخص',
    `المبلغ (${currencySymbol})`,
    'طريقة الدفع',
    'الحالة',
    'الملاحظات',
    'التاريخ والوقت',
  ]

  const rows = transactions.map((tx, idx) => [
    idx + 1,
    tx.client_name,
    tx.type === 'DEPOSIT' ? 'إيداع' : 'سحب',
    tx.subtype === 'PERSON' ? 'شخصي' : 'عادي',
    tx.person_name || (tx.person_names?.join(' / ') ?? ''),
    formatCurrency(tx.amount_cents),
    tx.payment_method || 'نقداً',
    tx.status === 'COMPLETED' ? 'مكتمل' : tx.status || 'مكتمل',
    tx.notes || '',
    new Intl.DateTimeFormat('ar-LY', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(tx.created_at)),
  ])

  const csvContent = buildCsv(headers, rows)
  // UTF-8 BOM (\uFEFF) ensures Excel opens Arabic text correctly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })

  const d = new Date()
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  downloadBlob(blob, filename || `MJS_معاملات_${dateStr}.csv`)
}

/**
 * Export entity summary (treasury view) to CSV.
 */
export function exportEntitiesToCsv(
  entities: { name: string; depositedCents: number; withdrawnCents: number; netCents: number; transactionCount: number }[],
  filename?: string
): void {
  const headers = [
    'الجهة',
    'إجمالي الإيداعات',
    'إجمالي السحوبات',
    'صافي الرصيد',
    'عدد المعاملات',
  ]

  const rows = entities.map((e) => [
    e.name,
    formatCurrency(e.depositedCents),
    formatCurrency(e.withdrawnCents),
    formatCurrency(e.netCents),
    e.transactionCount,
  ])

  const csvContent = buildCsv(headers, rows)
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })

  const d = new Date()
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  downloadBlob(blob, filename || `MJS_خزينة_${dateStr}.csv`)
}
