import { useMemo } from 'react'
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
    receiptTitle = isDeposit ? 'إيصال قبض (إيداع من شخص)' : 'إيصال صرف (سحب للأشخاص)'
  }

  const renderSingleReceiptCopy = (copyKey: string) => (
    <div
      key={copyKey}
      className="w-full h-[134mm] border-2 border-zinc-900 rounded-2xl p-4 bg-white flex flex-col justify-between box-border relative overflow-hidden font-arabic text-zinc-950"
      dir="rtl"
    >

        {/* Top Header Row */}
        <div className="relative z-10">
          <div className="flex items-center justify-between pb-2 border-b-2 border-zinc-900 gap-3" dir="rtl">
            {/* Far Right: App Logo (Circle Shape) */}
            <div className="flex items-center justify-start shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 border-zinc-900 bg-white p-0.5 flex items-center justify-center shadow-xs">
                <img
                  src={logoImg}
                  alt="شعار منظومة إدارة مالية"
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
                />
              </div>
            </div>

            {/* Center (في الوسط): System Title, Receipt Type & Serial Number */}
            <div className="text-center flex-1 space-y-1.5">
              <h1 className="font-black text-xl sm:text-2xl text-zinc-950 tracking-tight leading-tight">منظومة إدارة مالية</h1>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <div className="inline-block px-3.5 py-1 rounded-lg bg-zinc-950 text-white font-black text-xs sm:text-sm shadow-xs">
                  {receiptTitle}
                </div>
                <div className="inline-block px-3 py-1 rounded-lg border-2 border-zinc-900 bg-zinc-50 font-mono text-xs sm:text-sm font-black text-zinc-950 dir-ltr shadow-xs">
                  #{serial}
                </div>
              </div>
            </div>

            {/* Far Left Spacer Balancer */}
            <div className="w-20 sm:w-24 shrink-0 hidden sm:block pointer-events-none" />
          </div>

        {/* Data Fields Grid (Large Fonts + Compact Vertical Padding) */}
        <div className="grid grid-cols-2 gap-2.5 my-2.5 p-3 rounded-xl border-2 border-zinc-300 bg-zinc-50/60 text-xs sm:text-sm">
          {/* Row 1 */}
          {isPersonSubtype ? (
            isDeposit ? (
              <>
                <div className="space-y-0.5">
                  <span className="text-zinc-600 font-bold block text-xs">اسم الشخص (المودِع):</span>
                  <span className="font-black text-base sm:text-lg text-emerald-950 block truncate">
                    {transaction.person_name || 'غير محدد'}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-zinc-600 font-bold block text-xs">الجهة المودَع لها بالمنظومة:</span>
                  <span className="font-black text-base sm:text-lg text-zinc-950 block truncate">
                    {transaction.client_name}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-0.5 col-span-2 sm:col-span-1">
                  <span className="text-zinc-600 font-bold block text-xs">أسماء الأشخاص (المستلمون):</span>
                  <span className="font-black text-base sm:text-lg text-rose-950 block truncate">
                    {transaction.person_names && transaction.person_names.length > 0
                      ? transaction.person_names.join(' ، ')
                      : (transaction.person_name || 'غير محدد')}
                  </span>
                </div>
                <div className="space-y-0.5 col-span-2 sm:col-span-1">
                  <span className="text-zinc-600 font-bold block text-xs">الجهة المسحوب منها المال:</span>
                  <span className="font-black text-base sm:text-lg text-zinc-950 block truncate">
                    {transaction.client_name}
                  </span>
                </div>
              </>
            )
          ) : (
            <div className="space-y-0.5">
              <span className="text-zinc-600 font-bold block text-xs">اسم الجهة / المستفيد:</span>
              <span className="font-black text-base sm:text-lg text-zinc-950 block truncate">{transaction.client_name}</span>
            </div>
          )}

          <div className="space-y-0.5">
            <span className="text-zinc-600 font-bold block text-xs">التاريخ والوقت:</span>
            <span className="font-black text-xs sm:text-sm text-zinc-950 ar-num block dir-ltr text-right">
              {formatDate(transaction.created_at)}
            </span>
          </div>

          {/* Row 2: Transaction Type */}
          <div className="space-y-0.5 col-span-2">
            <span className="text-zinc-600 font-bold block text-xs">نوع المعاملة:</span>
            <span className={`inline-block px-3 py-1 rounded-md font-black text-xs sm:text-sm ${
              isDeposit ? 'bg-emerald-100 text-emerald-950 border border-emerald-300' : 'bg-rose-100 text-rose-950 border border-rose-300'
            }`}>
              {isPersonSubtype
                ? isDeposit ? 'إيداع نقدي من شخص' : 'سحب نقدي للأشخاص'
                : isDeposit ? 'إيداع نقدي (قبض)' : 'سحب نقدي (صرف)'
              }
            </span>
          </div>

          {/* Row 3: Amount Box (Enlarged & Right-Aligned Value) */}
          <div className="col-span-2 mt-0.5 p-2.5 rounded-lg border-2 border-emerald-600 bg-emerald-50 flex items-center justify-start gap-3">
            <span className="font-black text-xs sm:text-sm text-emerald-950 shrink-0">المبلغ المقيد بالإيصال:</span>
            <span className="font-black text-xl sm:text-2xl text-emerald-950 ar-num">
              {formatCurrency(transaction.amount_cents)}
            </span>
          </div>

          {/* Row 4: Reason / Notes */}
          <div className="space-y-0.5 col-span-2 pt-1 border-t border-zinc-200">
            <span className="text-zinc-600 font-bold block text-xs">سبب المعاملة / الملاحظات:</span>
            <span className="font-bold text-xs sm:text-sm text-zinc-950 block">
              {transaction.notes?.trim() || 'لا توجد ملاحظات مسجلة'}
            </span>
          </div>
        </div>
      </div>

      {/* Signature Area Footer */}
      <div className="flex items-center justify-between text-xs sm:text-sm font-black text-zinc-950 mt-auto pt-1 relative z-10 px-1" dir="rtl">
        <span>توقيع رئيس الشؤون المالية: ....................</span>
        <span>توقيع المستلم: ....................</span>
      </div>
    </div>
  )

  if (isPreview) {
    return (
      <div className="block select-none font-arabic bg-white text-zinc-950 w-full p-2 box-border overflow-hidden rounded-xl">
        {renderSingleReceiptCopy('preview-copy')}
      </div>
    )
  }

  return (
    <div id="printable-dual-receipt" className="hidden print:block select-none font-arabic bg-white text-zinc-950 w-[210mm] max-h-[297mm] p-3 box-border overflow-hidden">
      {/* Isolation Style for Print Media with Forced Exact Background Colors */}
      <style>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-dual-receipt, #printable-dual-receipt * {
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #printable-dual-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            background: white !important;
            color: black !important;
            padding: 4mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>

      {/* Top Half: Office Copy */}
      {renderSingleReceiptCopy('office-copy')}

      {/* Center Cutting Divider Line */}
      <div className="my-1.5 py-0.5 flex items-center justify-center gap-2 border-b-2 border-dashed border-zinc-500 text-zinc-700 font-black text-xs text-center select-none shrink-0">
        <span className="text-base">✂️</span>
        <span>خط القص والتسليم (قطع الإيصال من هنا)</span>
        <span className="text-base">✂️</span>
      </div>

      {/* Bottom Half: Customer Copy */}
      {renderSingleReceiptCopy('customer-copy')}
    </div>
  )
}
