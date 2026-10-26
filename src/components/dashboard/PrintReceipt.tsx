import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Transaction } from '@/types'
import logoImg from '@/assets/logo.png'

interface PrintReceiptProps {
  transaction: Transaction | null
  serialNumber?: string
  isPreview?: boolean
}

/** Helper to get or generate monthly auto-incrementing serial number (Format: YYMM-0001) */
export function getReceiptSerial(tx: Transaction): string {
  if (!tx) return '2608-0001'

  const date = new Date(tx.created_at)
  const validDate = isNaN(date.getTime()) ? new Date() : date
  const yy = validDate.getFullYear().toString().slice(-2)
  const mm = String(validDate.getMonth() + 1).padStart(2, '0')
  const yymm = `${yy}${mm}`

  const STORAGE_KEY_MAP = 'receipt_serial_map'
  const STORAGE_KEY_COUNTERS = 'receipt_monthly_counters'

  try {
    const mapStr = localStorage.getItem(STORAGE_KEY_MAP)
    const serialMap: Record<string, string> = mapStr ? JSON.parse(mapStr) : {}

    if (serialMap[tx.id]) {
      return serialMap[tx.id]
    }

    const counterStr = localStorage.getItem(STORAGE_KEY_COUNTERS)
    const countersMap: Record<string, number> = counterStr ? JSON.parse(counterStr) : {}

    const nextSeq = (countersMap[yymm] || 0) + 1
    const seqStr = String(nextSeq).padStart(4, '0')
    const fullSerial = `${yymm}-${seqStr}`

    serialMap[tx.id] = fullSerial
    countersMap[yymm] = nextSeq

    localStorage.setItem(STORAGE_KEY_MAP, JSON.stringify(serialMap))
    localStorage.setItem(STORAGE_KEY_COUNTERS, JSON.stringify(countersMap))

    return fullSerial
  } catch (e) {
    console.error('Failed to manage receipt serial numbers in localStorage', e)
    return `${yymm}-${String(tx.id % 10000).padStart(4, '0')}`
  }
}

export function PrintReceipt({ transaction, serialNumber, isPreview = false }: PrintReceiptProps) {
  const serial = useMemo(() => {
    if (serialNumber) return serialNumber
    if (!transaction) return '2608-0001'
    return getReceiptSerial(transaction)
  }, [transaction, serialNumber])

  if (!transaction) return null

  const isDeposit = transaction.type === 'DEPOSIT'
  const isPersonSubtype = transaction.subtype === 'PERSON'

  let receiptTitle = isDeposit ? 'إيصال قبض نقدي / المصرف' : 'إيصال صرف نقدي / المصرف'
  if (isPersonSubtype) {
    receiptTitle = isDeposit ? 'إيصال قبض (إيداع من شخص)' : 'إيصال صرف (سحب تفصيلي)'
  }

  const renderSingleReceiptCopy = (copyKey: string, isPreviewCopy = false) => (
    <div
      key={copyKey}
      className={`w-full ${
        isPreviewCopy ? 'h-auto min-h-[400px]' : 'h-[127mm] max-h-[127mm]'
      } border-2 border-zinc-900 rounded-xl p-3 bg-white flex flex-col justify-between box-border relative font-arabic text-zinc-950 overflow-hidden`}
      dir="rtl"
    >
      {/* Top Header Row */}
      <div className="relative z-10">
        <div className="flex items-center justify-between pb-1.5 border-b-2 border-zinc-900 gap-2" dir="rtl">
          {/* Far Right: App Logo (Circle Shape) */}
          <div className="flex items-center justify-start shrink-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-zinc-900 bg-white p-0.5 flex items-center justify-center shadow-xs">
              <img
                src={logoImg}
                alt="شعار منظومة إدارة مالية"
                className="w-full h-full object-cover rounded-full"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
              />
            </div>
          </div>

          {/* Center: System Title, Receipt Type & Serial Number */}
          <div className="text-center flex-1 space-y-1">
            <h1 className="font-black text-lg sm:text-xl text-zinc-950 tracking-tight leading-tight">منظومة إدارة مالية</h1>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <div className="inline-block px-3 py-0.5 rounded-md bg-zinc-950 text-white font-black text-xs shadow-xs">
                {receiptTitle}
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded-md border-2 border-zinc-900 bg-zinc-50 font-mono text-xs font-black text-zinc-950 dir-ltr shadow-xs">
                #{serial}
              </div>
            </div>
          </div>

          {/* Far Left Spacer Balancer */}
          <div className="w-14 sm:w-16 shrink-0 hidden sm:block pointer-events-none" />
        </div>

        {/* Data Fields Grid */}
        <div className="grid grid-cols-2 gap-2 my-1.5 p-2 rounded-lg border border-zinc-300 bg-zinc-50/70 text-xs">
          {/* Row 1 */}
          {isPersonSubtype ? (
            isDeposit ? (
              <>
                <div className="space-y-0.5">
                  <span className="text-zinc-600 font-bold block text-[11px]">اسم الشخص (المودِع):</span>
                  <span className="font-black text-sm text-emerald-950 block truncate">
                    {transaction.person_name || 'غير محدد'}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-zinc-600 font-bold block text-[11px]">الجهة المودَع لها بالمنظومة:</span>
                  <span className="font-black text-sm text-zinc-950 block truncate">
                    {transaction.client_name}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-0.5 col-span-2 sm:col-span-1">
                  <span className="text-zinc-600 font-bold block text-[11px]">عنوان الفاتورة:</span>
                  <span className="font-black text-sm text-rose-950 block truncate">
                    {transaction.person_name || (transaction.person_names && transaction.person_names.length > 0
                      ? transaction.person_names.join(' ، ')
                      : 'غير محدد')}
                  </span>
                </div>
                <div className="space-y-0.5 col-span-2 sm:col-span-1">
                  <span className="text-zinc-600 font-bold block text-[11px]">الجهة المسحوب منها المال:</span>
                  <span className="font-black text-sm text-zinc-950 block truncate">
                    {transaction.client_name}
                  </span>
                </div>
              </>
            )
          ) : (
            <div className="space-y-0.5">
              <span className="text-zinc-600 font-bold block text-[11px]">اسم الجهة / المستفيد:</span>
              <span className="font-black text-sm text-zinc-950 block truncate">{transaction.client_name}</span>
            </div>
          )}

          <div className="space-y-0.5">
            <span className="text-zinc-600 font-bold block text-[11px]">التاريخ والوقت:</span>
            <span className="font-black text-xs text-zinc-950 ar-num block dir-ltr text-right">
              {formatDate(transaction.created_at)}
            </span>
          </div>

          {/* Row 2: Transaction Type */}
          <div className="space-y-0.5 col-span-2">
            <span className="text-zinc-600 font-bold block text-[11px]">نوع المعاملة:</span>
            <span className={`inline-block px-2.5 py-0.5 rounded font-black text-xs ${
              isDeposit ? 'bg-emerald-100 text-emerald-950 border border-emerald-300' : 'bg-rose-100 text-rose-950 border border-rose-300'
            }`}>
              {isPersonSubtype
                ? isDeposit ? 'إيداع نقدي من شخص' : 'سحب نقدي (تفصيلي)'
                : isDeposit ? 'إيداع نقدي (قبض)' : 'سحب نقدي (صرف)'
              }
            </span>
          </div>

          {/* Row 3: Items list if detailed withdrawal */}
          {transaction.items && transaction.items.length > 0 && (
            <div className="col-span-2 my-0.5 border border-zinc-300 rounded overflow-hidden bg-white">
              <div className="bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-800 border-b border-zinc-300">
                تفاصيل عناصر الفاتورة:
              </div>
              <div className="max-h-16 overflow-hidden divide-y divide-zinc-200">
                {transaction.items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between px-2 py-0.5 text-[11px]">
                    <span className="font-semibold text-zinc-900">{idx + 1}. {it.name}</span>
                    <span className="font-mono font-bold text-zinc-950">{formatCurrency(Math.round(it.amount * 100))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Row 4: Amount Box */}
          <div className="col-span-2 mt-0.5 p-2 rounded-lg border-2 border-emerald-600 bg-emerald-50 flex items-center justify-between">
            <span className="font-black text-xs text-emerald-950 shrink-0">المبلغ المقيد بالإيصال:</span>
            <span className="font-black text-lg sm:text-xl text-emerald-950 ar-num">
              {formatCurrency(transaction.amount_cents)}
            </span>
          </div>

          {/* Row 5: Reason / Notes */}
          <div className="space-y-0.5 col-span-2 pt-1 border-t border-zinc-200">
            <span className="text-zinc-600 font-bold block text-[11px]">سبب المعاملة / الملاحظات:</span>
            <span className="font-semibold text-xs text-zinc-950 block truncate">
              {transaction.notes?.trim() || 'لا توجد ملاحظات مسجلة'}
            </span>
          </div>
        </div>
      </div>

      {/* Signature Area Footer */}
      <div className="flex items-center justify-between text-xs font-black text-zinc-950 pt-1 mt-auto px-1 border-t border-zinc-300" dir="rtl">
        <span>توقيع رئيس الشؤون المالية: ....................</span>
        <span>توقيع المستلم / المودِع: ....................</span>
      </div>
    </div>
  )

  if (isPreview) {
    return (
      <div className="block select-none font-arabic bg-white text-zinc-950 w-full p-2 box-border overflow-hidden rounded-xl">
        {renderSingleReceiptCopy('preview-copy', true)}
      </div>
    )
  }

  return createPortal(
    <div
      id="printable-dual-receipt"
      className="hidden print:flex select-none font-arabic bg-white text-zinc-950 w-full box-border"
      dir="rtl"
    >
      {/* Isolation Style for Print Media with Forced Exact Background Colors & Safe Margins */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 6mm 8mm;
        }
        @media print {
          html, body {
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          body > #root {
            display: none !important;
          }
          #printable-dual-receipt {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            width: 100% !important;
            max-width: 100% !important;
            height: calc(297mm - 14mm) !important;
            max-height: calc(297mm - 14mm) !important;
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
            visibility: visible !important;
          }
          #printable-dual-receipt * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Top Half: Office Copy */}
      {renderSingleReceiptCopy('office-copy')}

      {/* Center Cutting Divider Line */}
      <div className="my-1 py-0.5 flex items-center justify-center gap-2 border-b-2 border-dashed border-zinc-600 text-zinc-700 font-bold text-[11px] text-center select-none shrink-0">
        <span className="text-sm">✂️</span>
        <span>خط القص والتسليم (قطع الإيصال من هنا)</span>
        <span className="text-sm">✂️</span>
      </div>

      {/* Bottom Half: Customer Copy */}
      {renderSingleReceiptCopy('customer-copy')}
    </div>,
    document.body
  )
}
