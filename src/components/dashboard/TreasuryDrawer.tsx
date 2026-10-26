import { useState } from 'react'
import {
  X, Plus, FileText, Filter, Printer, Check, RotateCcw,
  Eye, CheckSquare, Square, Palette, SlidersHorizontal,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatCurrency, getDateFilterText } from '@/lib/utils'
import type { DateFilter } from '@/types'
import { usePermission } from '@/hooks/usePermission'
import { useWallet } from '@/context/WalletContext'
import { logUserAction } from '@/lib/auditLogger'
import logoImg from '@/assets/logo.png'

export type DrawerMode = 'ADD_ENTITY' | 'PRINT_REPORT' | 'ADVANCED_FILTER' | null

export interface AdvancedFilterState {
  minDeposit: string
  maxDeposit: string
  minWithdrawal: string
  maxWithdrawal: string
  minNet: string
  maxNet: string
  sortBy: 'netCents' | 'depositedCents' | 'withdrawnCents' | 'name' | 'transactionCount'
  sortOrder: 'asc' | 'desc'
}

export const defaultAdvancedFilter: AdvancedFilterState = {
  minDeposit: '',
  maxDeposit: '',
  minWithdrawal: '',
  maxWithdrawal: '',
  minNet: '',
  maxNet: '',
  sortBy: 'netCents',
  sortOrder: 'desc',
}

interface EntityBalance {
  name: string
  depositedCents: number
  withdrawnCents: number
  netCents: number
  transactionCount: number
}

interface TreasuryDrawerProps {
  mode: DrawerMode
  onClose: () => void
  onAddEntitySuccess: (name: string) => Promise<void> | void
  entities: EntityBalance[]
  totalBalanceCents: number
  totalDepositsCents: number
  totalWithdrawalsCents: number
  dateFilter?: DateFilter
  advancedFilter: AdvancedFilterState
  onApplyAdvancedFilter: (filter: AdvancedFilterState) => void
  onResetAdvancedFilter: () => void
}

export function TreasuryDrawer({
  mode,
  onClose,
  onAddEntitySuccess,
  entities,
  totalBalanceCents,
  totalDepositsCents,
  totalWithdrawalsCents,
  dateFilter,
  advancedFilter,
  onApplyAdvancedFilter,
  onResetAdvancedFilter,
}: TreasuryDrawerProps) {
  const { activeWalletMeta } = useWallet()
  const { hasPermission } = usePermission()
  const canManageTreasury = hasPermission('manage_treasury')
  const canExportReports = hasPermission('export_reports')

  // --- Mode 1: Add Entity Form State ---
  const [newEntityName, setNewEntityName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManageTreasury) {
      alert('عذراً، لا تملك صلاحية إدارة الخزينة والسيولة')
      return
    }
    const trimmed = newEntityName.trim()
    if (!trimmed) {
      setErrorMsg('يرجى إدخال اسم الجهة')
      return
    }

    const alreadyExists = entities.some(
      (e) => e.name.trim().toLowerCase() === trimmed.toLowerCase()
    )
    if (alreadyExists) {
      setErrorMsg('هذه الجهة مسجلة سابقاً بالمنظومة، لا يمكن تكرار إضافة نفس الجهة')
      return
    }

    setErrorMsg('')
    setSubmitting(true)

    try {
      await onAddEntitySuccess(trimmed)
      setNewEntityName('')
      onClose()
    } catch (err) {
      console.error(err)
      setErrorMsg('حدث خطأ أثناء حفظ الجهة')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Mode 2: Print Report Engine State ---
  const [reportTheme, setReportTheme] = useState<'EMERALD' | 'MONO' | 'BLUE'>('EMERALD')
  const [columns, setColumns] = useState({
    name: true,
    count: true,
    deposits: true,
    withdrawals: true,
    net: true,
  })

  const toggleColumn = (key: keyof typeof columns) => {
    setColumns((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handlePrint = () => {
    if (!canExportReports) {
      alert('عذراً، لا تملك صلاحية تصدير وطباعة التقارير')
      return
    }
    logUserAction('PRINT_REPORT', 'تقارير وطباعة', 'طباعة تقرير مستحقات الخزينة والجهات', `نطاق التقرير: ${getDateFilterText(dateFilter)}`)
    window.print()
  }

  // --- Mode 3: Advanced Filter State ---
  const [localAdvFilter, setLocalAdvFilter] = useState<AdvancedFilterState>(advancedFilter)

  const handleApplyAdv = () => {
    onApplyAdvancedFilter(localAdvFilter)
    onClose()
  }

  const handleResetAdv = () => {
    const reset = defaultAdvancedFilter
    setLocalAdvFilter(reset)
    onResetAdvancedFilter()
    onClose()
  }

  if (!mode) return null

  return (
    <>
      {/* -------------------- PRINT MEDIA DOM CONTAINER (OUTSIDE DRAWER OVERLAY) -------------------- */}
      {mode === 'PRINT_REPORT' && (
        <div id="printable-treasury-report" className="hidden print:block font-arabic select-none" dir="rtl">
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
              #printable-treasury-report, #printable-treasury-report * {
                visibility: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              #printable-treasury-report {
                display: block !important;
                position: relative !important;
                left: auto !important;
                top: auto !important;
                width: 100% !important;
                max-width: 100% !important;
                min-height: auto !important;
                background: white !important;
                color: black !important;
                padding: 4mm !important;
                margin: 0 auto !important;
                box-sizing: border-box !important;
              }
              @page {
                size: A4 portrait;
                margin: 8mm;
              }
            }
          `}</style>

          {/* Paper Header */}
          <div className="flex items-center justify-between border-b-2 border-zinc-900 pb-4 mb-4 gap-4" dir="rtl">
            {/* Right: MJS Logo (Circle Shape) */}
            <div className="flex items-center justify-start shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-2 border-zinc-900 bg-white p-0.5 flex items-center justify-center shadow-xs">
                <img
                  src={logoImg}
                  alt="شعار منظومة إدارة مالية"
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
                />
              </div>
            </div>

            {/* Center: System Header Text (في الوسط) */}
            <div className="text-center flex-1 space-y-1">
              <h1 className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">منظومة إدارة مالية</h1>
              <p className="text-sm font-extrabold text-zinc-700">تقرير مستحقات وأرصدة الخزينة والجهات</p>
              <div className="flex items-center justify-center gap-3 text-xs font-bold text-zinc-600 ar-num flex-wrap pt-0.5">
                <span>تاريخ التقرير: {new Date().toLocaleDateString('ar-LY')}</span>
                <span>إجمالي الجهات: {entities.length} جهة</span>
              </div>
            </div>

            {/* Left: Spacer Balancer */}
            <div className="w-24 sm:w-28 shrink-0 hidden sm:block pointer-events-none" />
          </div>

          {/* Active Period Range Highlight Box */}
          <div className="p-3 mb-4 rounded-lg bg-emerald-50 border border-emerald-300 text-xs font-extrabold text-emerald-950 flex items-center justify-between ar-num">
            <span className="text-emerald-800">{getDateFilterText(dateFilter)}</span>
            <span>عدد الجهات المدرجة: {entities.length}</span>
          </div>

          {/* Mini Summary Totals */}
          <div className="grid grid-cols-3 gap-3 bg-zinc-50 p-3 rounded-lg border border-zinc-300 mb-5 text-xs ar-num">
            <div className="p-2 bg-white rounded border border-zinc-200">
              <span className="text-zinc-500 block text-[10px]">إجمالي الأصول</span>
              <span className="font-black text-emerald-700 text-sm">{formatCurrency(totalBalanceCents)}</span>
            </div>
            <div className="p-2 bg-white rounded border border-zinc-200">
              <span className="text-zinc-500 block text-[10px]">المودعات</span>
              <span className="font-bold text-zinc-800 text-sm">{formatCurrency(totalDepositsCents)}</span>
            </div>
            <div className="p-2 bg-white rounded border border-zinc-200">
              <span className="text-zinc-500 block text-[10px]">المسحوبات</span>
              <span className="font-bold text-rose-700 text-sm">{formatCurrency(totalWithdrawalsCents)}</span>
            </div>
          </div>

          {/* Full Table */}
          <table className="w-full text-xs text-right border-collapse border border-zinc-900 mb-8">
            <thead>
              <tr className={reportTheme === 'EMERALD' ? 'bg-emerald-800 text-white' : reportTheme === 'BLUE' ? 'bg-sky-800 text-white' : 'bg-zinc-900 text-white'}>
                <th className="p-2 border border-zinc-900 font-bold text-center w-10">#</th>
                {columns.name && <th className="p-2 border border-zinc-900 font-bold">اسم الجهة</th>}
                {columns.count && <th className="p-2 border border-zinc-900 font-bold text-center w-24">المعاملات</th>}
                {columns.deposits && <th className="p-2 border border-zinc-900 font-bold text-left w-32">المودعات</th>}
                {columns.withdrawals && <th className="p-2 border border-zinc-900 font-bold text-left w-32">المسحوبات</th>}
                {columns.net && <th className="p-2 border border-zinc-900 font-bold text-left w-36">صافي الحساب</th>}
              </tr>
            </thead>
            <tbody>
              {entities.map((ent, idx) => (
                <tr key={ent.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                  <td className="p-2 border border-zinc-300 text-center font-mono ar-num">{idx + 1}</td>
                  {columns.name && <td className="p-2 border border-zinc-300 font-bold text-zinc-900">{ent.name}</td>}
                  {columns.count && <td className="p-2 border border-zinc-300 text-center ar-num font-medium">{ent.transactionCount}</td>}
                  {columns.deposits && <td className="p-2 border border-zinc-300 text-left ar-num text-emerald-700 font-semibold">+{formatCurrency(ent.depositedCents)}</td>}
                  {columns.withdrawals && <td className="p-2 border border-zinc-300 text-left ar-num text-rose-700 font-semibold">-{formatCurrency(ent.withdrawnCents)}</td>}
                  {columns.net && (
                    <td className={`p-2 border border-zinc-300 text-left ar-num font-black ${ent.netCents >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                      {formatCurrency(ent.netCents)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Signatures Footer */}
          <div className="pt-6 border-t-2 border-zinc-900 flex justify-between text-xs font-bold text-zinc-800 mt-8" dir="rtl">
            <div>التوقيع: .........</div>
          </div>
        </div>
      )}

      {/* -------------------- INTERACTIVE ON-SCREEN DRAWER -------------------- */}
      <AnimatePresence>
        {mode && (
          <div className="fixed inset-0 z-50 flex justify-end font-arabic select-none">
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            />

            {/* Slide-over Right Drawer Panel */}
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 240 }}
              className="relative w-full sm:w-[480px] h-full bg-white dark:bg-zinc-900 border-l border-zinc-200/80 dark:border-zinc-800 shadow-2xl z-50 flex flex-col justify-between overflow-hidden text-zinc-900 dark:text-zinc-100"
              dir="rtl"
            >
              {/* Drawer Top Header */}
              <div className="px-6 py-4 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/70 dark:bg-zinc-900/80">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs">
                    {mode === 'ADD_ENTITY' && <Plus className="w-5 h-5" />}
                    {mode === 'PRINT_REPORT' && <FileText className="w-5 h-5" />}
                    {mode === 'ADVANCED_FILTER' && <Filter className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                      {mode === 'ADD_ENTITY' && 'إضافة جهة جديدة'}
                      {mode === 'PRINT_REPORT' && 'طباعة تقارير ومستندات الخزينة'}
                      {mode === 'ADVANCED_FILTER' && 'الفلترة والترتيب المتقدم'}
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {mode === 'ADD_ENTITY' && 'تسجيل جهة التعامل ورصيدها الأولي'}
                      {mode === 'PRINT_REPORT' && 'تصدير ومعاينة المستندات الرسمية'}
                      {mode === 'ADVANCED_FILTER' && 'تصفية وحصر مبالغ المستحقات'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Body Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* -------------------- CONTENT 1: ADD ENTITY -------------------- */}
                {mode === 'ADD_ENTITY' && (
                  <form onSubmit={handleAddSubmit} className="space-y-5">
                    {errorMsg && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300">
                        {errorMsg}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                        اسم الجهة أو المستفيد <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="أدخل اسم الجهة الجديدة..."
                        value={newEntityName}
                        onChange={(e) => setNewEntityName(e.target.value)}
                        className="w-full h-10 px-3 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-arabic"
                      />
                    </div>

                    <div className="pt-4 flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{submitting ? 'جاري الإضافة...' : 'حفظ وإضافة الجهة'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  </form>
                )}

                {/* -------------------- CONTENT 2: PRINT REPORT ENGINE -------------------- */}
                {mode === 'PRINT_REPORT' && (
                  <div className="space-y-6">
                    {/* Scope Notice Banner */}
                  <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                    <span className="font-semibold">نطاق التقرير النشط:</span>
                    <span className="font-bold ar-num">
                      {getDateFilterText(dateFilter)}
                    </span>
                  </div>

                  {/* Theme Colors */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5" />
                      <span>تنسيق وألوان التقرير</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setReportTheme('EMERALD')}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          reportTheme === 'EMERALD'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        }`}
                      >
                        زمردي الخزينة
                      </button>
                      <button
                        onClick={() => setReportTheme('MONO')}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          reportTheme === 'MONO'
                            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 shadow-xs'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700'
                        }`}
                      >
                        كلاسيكي أسود
                      </button>
                      <button
                        onClick={() => setReportTheme('BLUE')}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          reportTheme === 'BLUE'
                            ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                            : 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                        }`}
                      >
                        أزرق رسمي
                      </button>
                    </div>
                  </div>

                  {/* Column Checkboxes */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                      الأعمدة المضمنة في المستند
                    </label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { key: 'name', label: 'اسم الجهة' },
                        { key: 'count', label: 'عدد المعاملات' },
                        { key: 'deposits', label: 'إجمالي الإيداعات' },
                        { key: 'withdrawals', label: 'إجمالي المسحوبات' },
                        { key: 'net', label: 'صافي الحساب' },
                      ].map((item) => {
                        const isChecked = columns[item.key as keyof typeof columns]
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => toggleColumn(item.key as keyof typeof columns)}
                            className={`p-2.5 rounded-xl border flex items-center gap-2 text-right transition-colors cursor-pointer ${
                              isChecked
                                ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 font-bold text-zinc-900 dark:text-white'
                                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400'
                            }`}
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-zinc-400 shrink-0" />
                            )}
                            <span>{item.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* LIVE PRINT PREVIEW PAPER */}
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" />
                      <span>معاينة التقرير قبل الطباعة</span>
                    </label>

                    {/* Paper Mockup Container */}
                    <div
                      id="printable-report-paper"
                      className={`p-5 rounded-xl bg-white text-zinc-900 shadow-md border border-zinc-200 text-right space-y-4 ${
                        reportTheme === 'EMERALD' ? 'border-t-4 border-t-emerald-600' : reportTheme === 'BLUE' ? 'border-t-4 border-t-sky-600' : 'border-t-4 border-t-zinc-900'
                      }`}
                    >
                      {/* Paper Header */}
                      <div className="flex items-center justify-between border-b pb-3 border-zinc-200 gap-3" dir="rtl">
                        <div className="flex items-center justify-start shrink-0">
                          <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-zinc-900 bg-white p-0.5 flex items-center justify-center shadow-xs">
                            <img
                              src={logoImg}
                              alt="شعار منظومة إدارة مالية"
                              className="w-full h-full object-cover rounded-full"
                              onError={(e) => { (e.target as HTMLElement).style.display = 'none' }}
                            />
                          </div>
                        </div>
                        <div className="text-center flex-1 space-y-0.5">
                          <h3 className="text-sm font-extrabold text-zinc-900">منظومة إدارة مالية — تقرير مستحقات الخزينة</h3>
                          <p className="text-[11px] text-emerald-700 font-bold">{getDateFilterText(dateFilter)}</p>
                          <div className="text-[10px] text-zinc-500 ar-num flex items-center justify-center gap-2 pt-0.5">
                            <span>تاريخ: {new Date().toLocaleDateString('ar-LY')}</span>
                            <span>عدد الجهات: {entities.length}</span>
                          </div>
                        </div>
                        <div className="w-18 sm:w-20 shrink-0 hidden sm:block pointer-events-none" />
                      </div>

                      {/* Mini Summary Totals */}
                      <div className="grid grid-cols-3 gap-2 bg-zinc-50 p-2.5 rounded-lg text-[11px] ar-num">
                        <div>
                          <span className="text-zinc-500 block text-[9px]">إجمالي الأصول</span>
                          <span className="font-bold text-emerald-700">{formatCurrency(totalBalanceCents)}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[9px]">المودعات</span>
                          <span className="font-bold text-zinc-800">{formatCurrency(totalDepositsCents)}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[9px]">المسحوبات</span>
                          <span className="font-bold text-rose-700">{formatCurrency(totalWithdrawalsCents)}</span>
                        </div>
                      </div>

                      {/* Preview Table */}
                      <div className="overflow-hidden border border-zinc-200 rounded-lg">
                        <table className="w-full text-[10px] text-right border-collapse">
                          <thead className={
                            reportTheme === 'EMERALD' ? 'bg-emerald-700 text-white' : reportTheme === 'BLUE' ? 'bg-sky-700 text-white' : 'bg-zinc-900 text-white'
                          }>
                            <tr>
                              {columns.name && <th className="p-1.5 border-b">اسم الجهة</th>}
                              {columns.count && <th className="p-1.5 border-b text-center">المعاملات</th>}
                              {columns.deposits && <th className="p-1.5 border-b">المودعات</th>}
                              {columns.withdrawals && <th className="p-1.5 border-b">المسحوبات</th>}
                              {columns.net && <th className="p-1.5 border-b">صافي الحساب</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {entities.slice(0, 8).map((ent, idx) => (
                              <tr key={ent.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}>
                                {columns.name && <td className="p-1.5 border-b font-bold">{ent.name}</td>}
                                {columns.count && <td className="p-1.5 border-b text-center ar-num">{ent.transactionCount}</td>}
                                {columns.deposits && <td className="p-1.5 border-b ar-num text-emerald-600">+{formatCurrency(ent.depositedCents)}</td>}
                                {columns.withdrawals && <td className="p-1.5 border-b ar-num text-rose-600">-{formatCurrency(ent.withdrawnCents)}</td>}
                                {columns.net && (
                                  <td className={`p-1.5 border-b ar-num font-bold ${ent.netCents >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {formatCurrency(ent.netCents)}
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {entities.length > 8 && (
                        <p className="text-[9px] text-zinc-400 text-center">
                          + {entities.length - 8} جهات إضافية سيتم تضمينها في الطباعة الكاملة
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Print Action */}
                  <div className="pt-2">
                    <button
                      onClick={handlePrint}
                      className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-[0.99]"
                    >
                      <Printer className="w-4 h-4" />
                      <span>طباعة المستند 🖨️</span>
                    </button>
                  </div>
                </div>
              )}

              {/* -------------------- CONTENT 3: ADVANCED FILTER -------------------- */}
              {mode === 'ADVANCED_FILTER' && (
                <div className="space-y-6">
                  {/* Range Filters Section */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 border-b pb-2 border-zinc-200 dark:border-zinc-800">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-500" />
                      <span>فلترة النطاقات المالية (المبالغ)</span>
                    </h3>

                    {/* Deposit Range */}
                    <div>
                      <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                        إجمالي المودعات ({activeWalletMeta?.symbol || 'د.ل'})
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          placeholder="الحد الأدنى"
                          value={localAdvFilter.minDeposit}
                          onChange={(e) => setLocalAdvFilter((prev) => ({ ...prev, minDeposit: e.target.value }))}
                          className="h-9 px-3 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white ar-num focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <input
                          type="number"
                          placeholder="الحد الأقصى"
                          value={localAdvFilter.maxDeposit}
                          onChange={(e) => setLocalAdvFilter((prev) => ({ ...prev, maxDeposit: e.target.value }))}
                          className="h-9 px-3 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white ar-num focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Withdrawal Range */}
                    <div>
                      <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                        إجمالي المسحوبات ({activeWalletMeta?.symbol || 'د.ل'})
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          placeholder="الحد الأدنى"
                          value={localAdvFilter.minWithdrawal}
                          onChange={(e) => setLocalAdvFilter((prev) => ({ ...prev, minWithdrawal: e.target.value }))}
                          className="h-9 px-3 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white ar-num focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <input
                          type="number"
                          placeholder="الحد الأقصى"
                          value={localAdvFilter.maxWithdrawal}
                          onChange={(e) => setLocalAdvFilter((prev) => ({ ...prev, maxWithdrawal: e.target.value }))}
                          className="h-9 px-3 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white ar-num focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Net Balance Range */}
                    <div>
                      <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                        صافي الحساب القائم ({activeWalletMeta?.symbol || 'د.ل'})
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          placeholder="الحد الأدنى"
                          value={localAdvFilter.minNet}
                          onChange={(e) => setLocalAdvFilter((prev) => ({ ...prev, minNet: e.target.value }))}
                          className="h-9 px-3 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white ar-num focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <input
                          type="number"
                          placeholder="الحد الأقصى"
                          value={localAdvFilter.maxNet}
                          onChange={(e) => setLocalAdvFilter((prev) => ({ ...prev, maxNet: e.target.value }))}
                          className="h-9 px-3 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white ar-num focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Multi-Sorting Options */}
                  <div className="space-y-4 pt-2">
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 border-b pb-2 border-zinc-200 dark:border-zinc-800">
                      <Filter className="w-3.5 h-3.5 text-emerald-500" />
                      <span>معايير الترتيب والتصنيف</span>
                    </h3>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                        الترتيب حسب
                      </label>
                      <select
                        value={localAdvFilter.sortBy}
                        onChange={(e) => setLocalAdvFilter((prev) => ({ ...prev, sortBy: e.target.value as any }))}
                        className="w-full h-10 px-3 text-xs rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="netCents">صافي الحساب القائم</option>
                        <option value="depositedCents">إجمالي الإيداعات</option>
                        <option value="withdrawnCents">إجمالي المسحوبات</option>
                        <option value="name">اسم الجهة (أبجدي)</option>
                        <option value="transactionCount">عدد المعاملات</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                        اتجاه الترتيب
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setLocalAdvFilter((prev) => ({ ...prev, sortOrder: 'desc' }))}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                            localAdvFilter.sortOrder === 'desc'
                              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                              : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          تنازلي (من الأعلى للأقل) ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => setLocalAdvFilter((prev) => ({ ...prev, sortOrder: 'asc' }))}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                            localAdvFilter.sortOrder === 'asc'
                              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                              : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          تصاعدي (من الأقل للأعلى) ↑
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 space-y-2">
                    <button
                      onClick={handleApplyAdv}
                      className="w-full h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>تطبيق وحفظ الإعدادات</span>
                    </button>
                    <button
                      onClick={handleResetAdv}
                      className="w-full h-10 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>إعادة ضبط الفلترة المتقدمة ✕</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
    </>
  )
}
