import { useState, useMemo, useEffect } from 'react'
import {
  X, Printer, FileText, ArrowUpRight, ArrowDownLeft, Coins, Search, Building2,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrency, getDateFilterText, filterTransactionsByDate } from '@/lib/utils'
import type { Transaction, DateFilter } from '@/types'
import { usePermission } from '@/hooks/usePermission'
import logoImg from '@/assets/logo.png'

interface EntityLedgerModalProps {
  open: boolean
  onClose: () => void
  entityName: string
  transactions: Transaction[]
  dateFilter?: DateFilter
}

export function EntityLedgerModal({
  open,
  onClose,
  entityName,
  transactions,
  dateFilter,
}: EntityLedgerModalProps) {
  const { hasPermission } = usePermission()
  const canExportReports = hasPermission('export_reports')
  const [search, setSearch] = useState('')

  // Filter transactions belonging to this entity and constrained by dateFilter
  const entityTx = useMemo(() => {
    if (!entityName) return []
    const forEntity = transactions.filter(
      (t) => t.client_name.trim().toLowerCase() === entityName.trim().toLowerCase()
    )
    return filterTransactionsByDate(forEntity, dateFilter)
  }, [transactions, entityName, dateFilter])

  // Filtered by search within modal
  const filteredTx = useMemo(() => {
    if (!search.trim()) return entityTx
    const q = search.toLowerCase()
    return entityTx.filter(
      (t) =>
        t.notes?.toLowerCase().includes(q) ||
        t.amount_cents.toString().includes(q) ||
        t.payment_method?.toLowerCase().includes(q)
    )
  }, [entityTx, search])

  // KPI Statistics
  const { totalDepositsCents, totalWithdrawalsCents, netCents, depositCount, withdrawalCount } = useMemo(() => {
    let dep = 0
    let withd = 0
    let depCnt = 0
    let withdCnt = 0

    entityTx.forEach((t) => {
      if (t.type === 'DEPOSIT') {
        dep += t.amount_cents
        depCnt++
      } else {
        withd += t.amount_cents
        withdCnt++
      }
    })

    return {
      totalDepositsCents: dep,
      totalWithdrawalsCents: withd,
      netCents: dep - withd,
      depositCount: depCnt,
      withdrawalCount: withdCnt,
    }
  }, [entityTx])

  const isPositiveNet = netCents >= 0

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const handlePrint = () => {
    if (!canExportReports) {
      alert('عفواً، لا تملك صلاحية تصدير وطباعة التقارير')
      return
    }
    window.print()
  }

  const dateLabel = getDateFilterText(dateFilter)

  return (
    <>
      {/* PRINT ENGINE DOCUMENT CONTAINER (OUTSIDE MODAL OVERLAY) */}
      {open && (
        <div id="printable-entity-ledger" className="hidden print:block font-arabic text-black bg-white dir-rtl">
          <style>{`
            @media print {
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              html, body {
                background: white !important;
                color: black !important;
                overflow: visible !important;
                height: auto !important;
              }
              body * {
                visibility: hidden !important;
              }
              #printable-entity-ledger, #printable-entity-ledger * {
                visibility: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              #printable-entity-ledger {
                display: block !important;
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 210mm !important;
                min-height: 297mm !important;
                background: white !important;
                color: black !important;
                padding: 10mm !important;
                box-sizing: border-box !important;
              }
              @page {
                size: A4 portrait;
                margin: 0;
              }
            }
          `}</style>

          {/* Official Report Document Header */}
          <div className="flex items-center justify-between border-b-2 border-black pb-4 mb-4 gap-4" dir="rtl">
            {/* Right: App Logo (Circle Shape) */}
            <div className="flex items-center justify-start shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-black bg-white p-0.5 flex items-center justify-center shadow-xs">
                <img
                  src={logoImg}
                  alt="شعار منظومة إدارة مالية"
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
                />
              </div>
            </div>

            {/* Center: System Header & Entity Title Text (في الوسط) */}
            <div className="text-center flex-1 space-y-1">
              <h1 className="text-xl sm:text-2xl font-black text-black tracking-tight">منظومة إدارة مالية</h1>
              <p className="text-sm font-extrabold text-gray-800">
                تقرير كشف حساب مالي — <span className="underline font-black text-black">{entityName}</span>
              </p>
              <div className="flex items-center justify-center gap-3 text-xs font-bold text-gray-700 ar-num flex-wrap pt-0.5">
                <span className="bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-300 text-emerald-900 font-extrabold">
                  {dateLabel}
                </span>
                <span>تاريخ التقرير: {new Date().toLocaleDateString('ar-LY')}</span>
                <span>إجمالي العمليات: {entityTx.length} معاملة</span>
              </div>
            </div>

            {/* Left: Spacer Balancer */}
            <div className="w-24 sm:w-28 shrink-0 hidden sm:block pointer-events-none" />
          </div>

          {/* Report Summary KPI Table */}
          <table className="w-full border-collapse border border-black mb-6 text-center text-xs font-bold">
            <thead>
              <tr className="bg-gray-200 text-black border-b border-black">
                <th className="border border-black py-2">إجمالي الإيداعات (+)</th>
                <th className="border border-black py-2">إجمالي المسحوبات (-)</th>
                <th className="border border-black py-2">صافي رصيد الحساب</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black py-2 text-emerald-800 font-extrabold ar-num">
                  +{formatCurrency(totalDepositsCents)}
                </td>
                <td className="border border-black py-2 text-rose-800 font-extrabold ar-num">
                  -{formatCurrency(totalWithdrawalsCents)}
                </td>
                <td className="border border-black py-2 font-black ar-num">
                  {formatCurrency(netCents)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Report Full Transactions Table */}
          <table className="w-full border-collapse border border-black text-right text-xs">
            <thead>
              <tr className="bg-gray-200 text-black border-b border-black font-bold">
                <th className="border border-black py-2 px-2">تاريخ الحركة</th>
                <th className="border border-black py-2 px-2 text-center">نوع العملية</th>
                <th className="border border-black py-2 px-2 text-center">طريقة الدفع</th>
                <th className="border border-black py-2 px-2 text-left">المبلغ</th>
                <th className="border border-black py-2 px-2">البيان والملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {entityTx.map((tx) => (
                <tr key={tx.id} className="border-b border-black">
                  <td className="border border-black py-1.5 px-2 ar-num font-medium">
                    {new Date(tx.created_at).toLocaleDateString('ar-LY')}
                  </td>
                  <td className="border border-black py-1.5 px-2 text-center font-bold">
                    {tx.type === 'DEPOSIT' ? 'إيداع' : 'سحب'}
                  </td>
                  <td className="border border-black py-1.5 px-2 text-center">
                    {tx.payment_method === 'CASH' ? 'نقداً' : 'تحويل مصرفي'}
                  </td>
                  <td className="border border-black py-1.5 px-2 text-left font-bold ar-num">
                    {tx.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(tx.amount_cents)}
                  </td>
                  <td className="border border-black py-1.5 px-2">
                    {tx.notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Official Signature Box */}
          <div className="mt-12 flex justify-between items-end text-xs font-bold text-black border-t border-gray-400 pt-6" dir="rtl">
            <div>التوقيع: .........</div>
          </div>
        </div>
      )}

      {/* ON-SCREEN INTERACTIVE MODAL */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 font-arabic select-none">
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            />

            {/* Modal Card Dialog */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 24, stiffness: 280 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden text-zinc-900 dark:text-zinc-100"
              dir="rtl"
            >
              {/* Modal Top Header */}
              <div className="px-6 py-4 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <span>كشف حساب مالي تفصيلي:</span>
                      <span className="text-emerald-700 dark:text-emerald-300 font-extrabold">{entityName}</span>
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        الحركات المالية المقيدة بحساب الجهة
                      </p>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200/80 dark:border-emerald-800 text-[10px]">
                        {dateLabel}
                      </span>
                    </div>
                  </div>
                </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  disabled={!canExportReports}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold shadow-md transition-all ${
                    !canExportReports
                      ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                      : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 cursor-pointer active:scale-95'
                  }`}
                  title={!canExportReports ? 'لا تملك صلاحية تصدير واستيراد التقارير' : undefined}
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة كشف الحساب 🖨️</span>
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content Scroll Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* 4 KPI Metric Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* 1. عدد العمليات */}
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-800/80">
                  <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-xs font-medium mb-1">
                    <FileText className="w-3.5 h-3.5" />
                    <span>إجمالي العمليات</span>
                  </div>
                  <div className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100 ar-num">
                    {entityTx.length} <span className="text-xs font-semibold text-zinc-500">حركة</span>
                  </div>
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 ar-num">
                    ({depositCount} إيداع / {withdrawalCount} سحب)
                  </div>
                </div>

                {/* 2. مجموع الإيداعات */}
                <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40">
                  <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-medium mb-1">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>مجموع الإيداعات</span>
                  </div>
                  <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 ar-num">
                    +{formatCurrency(totalDepositsCents)}
                  </div>
                </div>

                {/* 3. مجموع المسحوبات */}
                <div className="p-3.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40">
                  <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 text-xs font-medium mb-1">
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>مجموع المسحوبات</span>
                  </div>
                  <div className="text-lg font-extrabold text-rose-600 dark:text-rose-400 ar-num">
                    -{formatCurrency(totalWithdrawalsCents)}
                  </div>
                </div>

                {/* 4. صافي الحساب الحالي */}
                <div className={`p-3.5 rounded-xl border ${
                  isPositiveNet
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                }`}>
                  <div className="flex items-center gap-1.5 text-xs font-medium mb-1 opacity-90">
                    <Coins className="w-3.5 h-3.5" />
                    <span>صافي الحساب الحالي</span>
                  </div>
                  <div className="text-lg font-black ar-num">
                    {isPositiveNet ? '+' : ''}{formatCurrency(netCents)}
                  </div>
                </div>
              </div>

              {/* Search Bar inside Modal */}
              <div className="flex items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-800/40 p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ابحث برقم الإشعار أو طريقة الدفع أو البيان..."
                    className="w-full pr-9 pl-4 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
                <div className="text-xs text-zinc-400 dark:text-zinc-500 font-bold ar-num shrink-0 px-2">
                  عدد النتائج: {filteredTx.length}
                </div>
              </div>

              {/* Transactions Table */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                {filteredTx.length === 0 ? (
                  <div className="text-center py-12 text-xs text-zinc-400 dark:text-zinc-500">
                    لا توجد معاملات مطابقة للبحث لهذه الجهة
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs border-collapse">
                      <thead>
                        <tr className="bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 font-bold border-b border-zinc-200 dark:border-zinc-800">
                          <th className="py-2.5 px-4">تاريخ الحركة</th>
                          <th className="py-2.5 px-4 text-center">نوع العملية</th>
                          <th className="py-2.5 px-4 text-center">طريقة الدفع</th>
                          <th className="py-2.5 px-4 text-left">المبلغ</th>
                          <th className="py-2.5 px-4">البيان / الملاحظات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTx.map((tx) => {
                          const isDeposit = tx.type === 'DEPOSIT'
                          const dateFormatted = new Date(tx.created_at).toLocaleString('ar-LY', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })

                          return (
                            <tr
                              key={tx.id}
                              className="border-b border-zinc-200/60 dark:border-zinc-800/60 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors"
                            >
                              <td className="py-3 px-4 font-semibold text-zinc-600 dark:text-zinc-300 ar-num text-[11px]">
                                {dateFormatted}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  isDeposit
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                    : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                }`}>
                                  {isDeposit ? 'إيداع' : 'سحب'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center font-medium">
                                <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px]">
                                  {tx.payment_method === 'CASH' ? 'نقداً' : tx.payment_method === 'BANK_TRANSFER' ? 'تحويل مصرفي' : tx.payment_method}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-left font-bold ar-num">
                                <span className={isDeposit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                  {isDeposit ? '+' : '-'}{formatCurrency(tx.amount_cents)}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400 text-[11px] truncate max-w-xs">
                                {tx.notes || '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    </>
  )
}
