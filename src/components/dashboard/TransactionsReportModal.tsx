import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Printer, X, CheckSquare, Square, FileText, SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate, getDateFilterText } from '@/lib/utils'
import type { Transaction, Stats, DateFilter } from '@/types'
import { usePermission } from '@/hooks/usePermission'
import { logUserAction } from '@/lib/auditLogger'
import logoImg from '@/assets/logo.png'

interface ColumnToggles {
  clientName: boolean
  type: boolean
  paymentMethod: boolean
  amount: boolean
  date: boolean
  notes: boolean
}

interface CardToggles {
  withdrawalsSum: boolean
  depositsSum: boolean
  depositsCount: boolean
  withdrawalsCount: boolean
}

interface TransactionsReportModalProps {
  open: boolean
  onClose: () => void
  transactions: Transaction[]
  stats: Stats | null
  dateFilter?: DateFilter
}

export function TransactionsReportModal({
  open,
  onClose,
  transactions,
  dateFilter,
}: TransactionsReportModalProps) {
  const { hasPermission } = usePermission()
  const canExportReports = hasPermission('export_reports')

  // 1. Column customization toggles state
  const [columns, setColumns] = useState<ColumnToggles>({
    clientName: true,
    type: true,
    paymentMethod: true,
    amount: true,
    date: true,
    notes: true,
  })

  // 2. Summary KPI Cards customization toggles state
  const [cards, setCards] = useState<CardToggles>({
    withdrawalsSum: true,
    depositsSum: true,
    depositsCount: true,
    withdrawalsCount: true,
  })

  if (!open) return null

  const toggleColumn = (key: keyof ColumnToggles) => {
    setColumns((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const toggleCard = (key: keyof CardToggles) => {
    setCards((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handlePrint = () => {
    if (!canExportReports) {
      alert('عذراً، لا تملك صلاحية تصدير وطباعة التقارير')
      return
    }
    logUserAction('PRINT_REPORT', 'تقارير وطباعة', 'طباعة تقرير المعاملات الشامل', `معاملات مدرجة بالتقرير: ${transactions.length}`)

    const printElement = document.getElementById('printable-custom-report')
    if (!printElement) {
      window.print()
      return
    }

    // Create a temporary hidden iframe for 100% clean, unclipped printing & PDF saving
    const iframe = document.createElement('iframe')
    iframe.id = 'report-print-frame'
    iframe.style.position = 'fixed'
    iframe.style.top = '-9999px'
    iframe.style.left = '-9999px'
    iframe.style.width = '210mm'
    iframe.style.height = '297mm'
    iframe.style.border = 'none'
    iframe.style.visibility = 'hidden'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) {
      window.print()
      return
    }

    // Collect all stylesheets from current document
    let styles = ''
    document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
      styles += node.outerHTML
    })

    doc.open()
    doc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>تقرير المعاملات والحركات المالية</title>
          ${styles}
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            html, body {
              background: #ffffff !important;
              color: #09090b !important;
              margin: 0 !important;
              padding: 0 !important;
              font-family: 'IBM Plex Arabic', 'Tajawal', system-ui, sans-serif !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box !important;
            }
            .ar-num {
              font-family: 'IBM Plex Arabic', 'Tajawal', sans-serif !important;
              direction: ltr !important;
              unicode-bidi: embed !important;
            }
            table {
              page-break-inside: auto !important;
              border-collapse: collapse !important;
              width: 100% !important;
            }
            tr {
              page-break-inside: avoid !important;
              page-break-after: auto !important;
            }
            thead {
              display: table-header-group !important;
            }
            tfoot {
              display: table-footer-group !important;
            }
          </style>
        </head>
        <body class="bg-white text-zinc-950 p-4">
          ${printElement.innerHTML}
        </body>
      </html>
    `)
    doc.close()

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch (err) {
        console.error('Iframe print error, falling back to window.print():', err)
        window.print()
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe)
          }
        }, 3000)
      }
    }, 400)
  }

  // Calculate live statistics for the report view
  let totalDep = 0
  let totalWithd = 0
  let cashDep = 0
  let bankDep = 0
  let cashWithd = 0
  let bankWithd = 0
  let depCount = 0
  let withdCount = 0

  transactions.forEach((tx) => {
    const isCash = !tx.payment_method || tx.payment_method === 'نقداً'
    if (tx.type === 'DEPOSIT') {
      totalDep += tx.amount_cents
      depCount += 1
      if (isCash) cashDep += 1
      else bankDep += 1
    } else {
      totalWithd += tx.amount_cents
      withdCount += 1
      if (isCash) cashWithd += 1
      else bankWithd += 1
    }
  })

  // Format Date Filter Label
  const filterText = getDateFilterText(dateFilter)

  return (
    <>
      {/* -------------------- PRINT MEDIA DOM CONTAINER (Portaled into document.body outside #root) -------------------- */}
      {typeof document !== 'undefined' && createPortal(
        <div id="printable-custom-report" className="hidden print:block font-arabic select-none bg-white text-zinc-950 p-6 w-full box-border" dir="rtl">
        <style>{`
          @media print {
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              background: white !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            body * {
              visibility: hidden !important;
            }
            #printable-custom-report, #printable-custom-report * {
              visibility: visible !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #printable-custom-report {
              position: static !important;
              display: block !important;
              width: 100% !important;
              max-width: 100% !important;
              background: white !important;
              color: black !important;
              padding: 6mm !important;
              margin: 0 auto !important;
              box-sizing: border-box !important;
            }
            table {
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            thead {
              display: table-header-group;
            }
            tfoot {
              display: table-footer-group;
            }
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
          }
        `}</style>

        {/* Printable Document Header */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-zinc-900 mb-6 gap-4" dir="rtl">
          <div className="flex items-center justify-start shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-zinc-900 bg-white p-0.5 flex items-center justify-center shadow-xs">
              <img src={logoImg} alt="شعار منظومة إدارة مالية" className="w-full h-full object-cover rounded-full" />
            </div>
          </div>
          <div className="text-center flex-1 space-y-1">
            <h1 className="font-black text-2xl text-zinc-950 tracking-tight leading-tight">منظومة إدارة مالية</h1>
            <p className="text-sm font-extrabold text-zinc-700">تقرير المعاملات والحركات المالية المخصصة</p>
            <p className="text-xs text-zinc-500 font-bold ar-num">{filterText} • إجمالي المعاملات المدرجة بالتقرير: {transactions.length}</p>
          </div>
          <div className="w-24 sm:w-28 shrink-0 hidden sm:block pointer-events-none" />
        </div>

        {/* Printable KPI Cards (If selected) */}
        {(cards.withdrawalsSum || cards.depositsSum || cards.depositsCount || cards.withdrawalsCount) && (
          <div className="grid grid-cols-2 gap-3 mb-6" dir="rtl">
            {cards.withdrawalsSum && (
              <div className="p-3.5 rounded-xl border-2 border-rose-200 bg-rose-50/70">
                <span className="text-xs font-bold text-rose-800 block">مجموع السحوبات</span>
                <span className="text-xl font-black text-rose-700 ar-num block mt-1">
                  {formatCurrency(totalWithd)}
                </span>
              </div>
            )}

            {cards.depositsSum && (
              <div className="p-3.5 rounded-xl border-2 border-emerald-200 bg-emerald-50/70">
                <span className="text-xs font-bold text-emerald-800 block">مجموع الإيداعات</span>
                <span className="text-xl font-black text-emerald-700 ar-num block mt-1">
                  {formatCurrency(totalDep)}
                </span>
              </div>
            )}

            {cards.depositsCount && (
              <div className="p-3.5 rounded-xl border-2 border-sky-200 bg-sky-50/70">
                <span className="text-xs font-bold text-sky-800 block">عدد الإيداعات</span>
                <span className="text-xl font-black text-sky-950 ar-num block mt-1">
                  {depCount} معاملة <span className="text-xs text-sky-700 font-bold">(نقداً: {cashDep} | بنك: {bankDep})</span>
                </span>
              </div>
            )}

            {cards.withdrawalsCount && (
              <div className="p-3.5 rounded-xl border-2 border-amber-200 bg-amber-50/70">
                <span className="text-xs font-bold text-amber-800 block">عدد السحوبات</span>
                <span className="text-xl font-black text-amber-950 ar-num block mt-1">
                  {withdCount} معاملة <span className="text-xs text-amber-700 font-bold">(نقداً: {cashWithd} | بنك: {bankWithd})</span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Printable Data Table */}
        <table className="w-full text-right text-xs border-collapse border-2 border-zinc-900 mb-6" dir="rtl">
          <thead>
            <tr className="bg-zinc-100 text-zinc-950 font-black border-b-2 border-zinc-900">
              {columns.clientName && <th className="p-2.5 border-l border-zinc-300">اسم الجهة / المستفيد</th>}
              {columns.type && <th className="p-2.5 border-l border-zinc-300 text-center">نوع المعاملة</th>}
              {columns.paymentMethod && <th className="p-2.5 border-l border-zinc-300 text-center">أسلوب الدفع</th>}
              {columns.amount && <th className="p-2.5 border-l border-zinc-300 text-left">القيمة المالية</th>}
              {columns.date && <th className="p-2.5 border-l border-zinc-300 text-center">التاريخ والوقت</th>}
              {columns.notes && <th className="p-2.5">الملاحظات والبيان</th>}
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-xs font-bold text-zinc-500 bg-zinc-50">
                  لا توجد معاملات مسجلة في هذا التقرير
                </td>
              </tr>
            ) : (
              transactions.map((tx, idx) => {
              const isDeposit = tx.type === 'DEPOSIT'
              return (
                <tr key={tx.id || idx} className="border-b border-zinc-200">
                  {columns.clientName && <td className="p-2.5 font-bold border-l border-zinc-200">{tx.client_name}</td>}
                  {columns.type && (
                    <td className="p-2.5 text-center border-l border-zinc-200">
                      <span className={`font-black ${isDeposit ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {isDeposit ? 'إيداع (قبض)' : 'سحب (صرف)'}
                      </span>
                    </td>
                  )}
                  {columns.paymentMethod && (
                    <td className="p-2.5 text-center border-l border-zinc-200 font-semibold">
                      {tx.payment_method || 'نقداً'}
                    </td>
                  )}
                  {columns.amount && (
                    <td className="p-2.5 text-left border-l border-zinc-200 font-black ar-num">
                      <span className={isDeposit ? 'text-emerald-700' : 'text-rose-700'}>
                        {isDeposit ? '+' : '-'}{formatCurrency(tx.amount_cents)}
                      </span>
                    </td>
                  )}
                  {columns.date && (
                    <td className="p-2.5 text-center border-l border-zinc-200 font-medium ar-num dir-ltr">
                      {formatDate(tx.created_at)}
                    </td>
                  )}
                  {columns.notes && <td className="p-2.5 text-zinc-600 font-medium">{tx.notes || '-'}</td>}
                </tr>
              )
            })
            )}
          </tbody>
        </table>

        {/* Printable Footer */}
        <div className="pt-6 border-t-2 border-zinc-900 flex justify-between text-xs font-bold text-zinc-800" dir="rtl">
          <div>التوقيع: .........</div>
        </div>
      </div>,
      document.body
      )}

      {/* -------------------- ON-SCREEN INTERACTIVE CUSTOMIZATION & LIVE PREVIEW MODAL -------------------- */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 font-arabic select-none overflow-y-auto print:hidden" dir="rtl">
        <div className="w-full max-w-6xl h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col my-auto">

          {/* Modal Top Header Bar */}
          <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/90 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-600 text-white shadow-xs">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>تخصيص وطباعة التقرير الشامل</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 ar-num">
                    {transactions.length} معاملة
                  </span>
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  يتضمن هذا التقرير {transactions.length} معاملة مالية — حدد الأعمدة والبطاقات وشاهد المعاينة المباشرة
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canExportReports && (
                <Button
                  type="button"
                  onClick={handlePrint}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة التقرير الشامل</span>
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="w-9 h-9 p-0 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
                title="إغلاق النافذة"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Modal Split View Container */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-zinc-100 dark:bg-zinc-950">

            {/* SIDE 1: Interactive Control Panel (Toggles for Columns & Cards) */}
            <div className="w-full md:w-80 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 p-5 overflow-y-auto space-y-6 shrink-0">

              {/* SECTION A: COLUMNS CUSTOMIZATION */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-zinc-900 dark:text-zinc-100">
                    <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                    <span>تخصيص أعمدة الجدول</span>
                  </div>
                  <span className="text-[11px] font-bold text-zinc-400">اختر لتضمين</span>
                </div>

                <div className="space-y-2 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  <button
                    type="button"
                    onClick={() => toggleColumn('clientName')}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-right cursor-pointer"
                  >
                    <span>اسم الجهة / المستفيد</span>
                    {columns.clientName ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4 text-zinc-400" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleColumn('type')}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-right cursor-pointer"
                  >
                    <span>نوع المعاملة (إيداع / سحب)</span>
                    {columns.type ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4 text-zinc-400" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleColumn('paymentMethod')}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-right cursor-pointer"
                  >
                    <span>أسلوب الدفع (نقداً / بنك)</span>
                    {columns.paymentMethod ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4 text-zinc-400" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleColumn('amount')}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-right cursor-pointer"
                  >
                    <span>القيمة المالية (المبلغ)</span>
                    {columns.amount ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4 text-zinc-400" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleColumn('date')}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-right cursor-pointer"
                  >
                    <span>التاريخ والوقت</span>
                    {columns.date ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4 text-zinc-400" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleColumn('notes')}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-right cursor-pointer"
                  >
                    <span>الملاحظات والبيان</span>
                    {columns.notes ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4 text-zinc-400" />}
                  </button>
                </div>
              </div>

              {/* SECTION B: KPI CARDS INCLUSION */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-zinc-900 dark:text-zinc-100">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>تخصيص البطاقات الإحصائية</span>
                  </div>
                  <span className="text-[11px] font-bold text-zinc-400">إدراج بقمة التقرير</span>
                </div>

                <div className="space-y-2 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  <button
                    type="button"
                    onClick={() => toggleCard('withdrawalsSum')}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-right cursor-pointer"
                  >
                    <span>بطاقة مجموع السحوبات</span>
                    {cards.withdrawalsSum ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4 text-zinc-400" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleCard('depositsSum')}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-right cursor-pointer"
                  >
                    <span>بطاقة مجموع الإيداعات</span>
                    {cards.depositsSum ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4 text-zinc-400" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleCard('depositsCount')}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-right cursor-pointer"
                  >
                    <span>بطاقة عدد وتفصيل الإيداعات</span>
                    {cards.depositsCount ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4 text-zinc-400" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleCard('withdrawalsCount')}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-right cursor-pointer"
                  >
                    <span>بطاقة عدد وتفصيل السحوبات</span>
                    {cards.withdrawalsCount ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4 text-zinc-400" />}
                  </button>
                </div>
              </div>
            </div>

            {/* SIDE 2: Live Real-Time Document Preview Panel */}
            <div className="flex-1 p-6 overflow-y-auto flex flex-col items-center">
              <div className="w-full max-w-[210mm] bg-white text-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 p-8 space-y-6 box-border">

                {/* Preview Document Header */}
                <div className="flex items-center justify-between pb-4 border-b-2 border-zinc-900 gap-4" dir="rtl">
                  <div className="flex items-center justify-start shrink-0">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-zinc-900 bg-white p-0.5 flex items-center justify-center shadow-xs">
                      <img src={logoImg} alt="شعار منظومة إدارة مالية" className="w-full h-full object-cover rounded-full" />
                    </div>
                  </div>
                  <div className="text-center flex-1 space-y-1">
                    <h1 className="font-black text-xl sm:text-2xl text-zinc-950 tracking-tight leading-tight">منظومة إدارة مالية</h1>
                    <p className="text-xs sm:text-sm font-extrabold text-zinc-700">تقرير المعاملات والحركات المالية المخصصة</p>
                    <p className="text-[11px] sm:text-xs text-zinc-500 font-bold ar-num">{filterText} • إجمالي المعاملات بالتقرير: {transactions.length}</p>
                  </div>
                  <div className="w-24 sm:w-28 shrink-0 hidden sm:block pointer-events-none" />
                </div>

                {/* Preview KPI Cards */}
                {(cards.withdrawalsSum || cards.depositsSum || cards.depositsCount || cards.withdrawalsCount) && (
                  <div className="grid grid-cols-2 gap-3">
                    {cards.withdrawalsSum && (
                      <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/70">
                        <span className="text-[11px] font-bold text-rose-800 block">مجموع السحوبات</span>
                        <span className="text-lg font-black text-rose-700 ar-num block mt-0.5">
                          {formatCurrency(totalWithd)}
                        </span>
                      </div>
                    )}

                    {cards.depositsSum && (
                      <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/70">
                        <span className="text-[11px] font-bold text-emerald-800 block">مجموع الإيداعات</span>
                        <span className="text-lg font-black text-emerald-700 ar-num block mt-0.5">
                          {formatCurrency(totalDep)}
                        </span>
                      </div>
                    )}

                    {cards.depositsCount && (
                      <div className="p-3 rounded-xl border border-sky-200 bg-sky-50/70">
                        <span className="text-[11px] font-bold text-sky-800 block">عدد الإيداعات</span>
                        <span className="text-lg font-black text-sky-950 ar-num block mt-0.5">
                          {depCount} معاملة <span className="text-[11px] text-sky-700 font-bold">(نقداً: {cashDep} | بنك: {bankDep})</span>
                        </span>
                      </div>
                    )}

                    {cards.withdrawalsCount && (
                      <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/70">
                        <span className="text-[11px] font-bold text-amber-800 block">عدد السحوبات</span>
                        <span className="text-lg font-black text-amber-950 ar-num block mt-0.5">
                          {withdCount} معاملة <span className="text-[11px] text-amber-700 font-bold">(نقداً: {cashWithd} | بنك: {bankWithd})</span>
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Preview Table */}
                <div className="overflow-x-auto border border-zinc-900 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-100 text-zinc-950 font-black border-b border-zinc-900">
                        {columns.clientName && <th className="p-2.5 border-l border-zinc-200">اسم الجهة / المستفيد</th>}
                        {columns.type && <th className="p-2.5 border-l border-zinc-200 text-center">نوع المعاملة</th>}
                        {columns.paymentMethod && <th className="p-2.5 border-l border-zinc-200 text-center">أسلوب الدفع</th>}
                        {columns.amount && <th className="p-2.5 border-l border-zinc-200 text-left">القيمة المالية</th>}
                        {columns.date && <th className="p-2.5 border-l border-zinc-200 text-center">التاريخ والوقت</th>}
                        {columns.notes && <th className="p-2.5">الملاحظات والبيان</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx, idx) => {
                        const isDeposit = tx.type === 'DEPOSIT'
                        return (
                          <tr key={tx.id || idx} className="border-b border-zinc-200 hover:bg-zinc-50">
                            {columns.clientName && <td className="p-2.5 font-bold border-l border-zinc-200">{tx.client_name}</td>}
                            {columns.type && (
                              <td className="p-2.5 text-center border-l border-zinc-200">
                                <span className={`font-black ${isDeposit ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  {isDeposit ? 'إيداع (قبض)' : 'سحب (صرف)'}
                                </span>
                              </td>
                            )}
                            {columns.paymentMethod && (
                              <td className="p-2.5 text-center border-l border-zinc-200 font-semibold">
                                {tx.payment_method || 'نقداً'}
                              </td>
                            )}
                            {columns.amount && (
                              <td className="p-2.5 text-left border-l border-zinc-200 font-black ar-num">
                                <span className={isDeposit ? 'text-emerald-700' : 'text-rose-700'}>
                                  {isDeposit ? '+' : '-'}{formatCurrency(tx.amount_cents)}
                                </span>
                              </td>
                            )}
                            {columns.date && (
                              <td className="p-2.5 text-center border-l border-zinc-200 font-medium ar-num dir-ltr">
                                {formatDate(tx.created_at)}
                              </td>
                            )}
                            {columns.notes && <td className="p-2.5 text-zinc-600 font-medium">{tx.notes || '-'}</td>}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Preview Footer */}
                <div className="pt-4 border-t border-zinc-900 flex justify-between text-xs font-bold text-zinc-800">
                  <div>توقيع موظف المنظومة: ................................</div>
                  <div>اعتماد الإدارة المالية: ................................</div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
