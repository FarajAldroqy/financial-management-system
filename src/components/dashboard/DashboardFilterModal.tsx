import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Filter, RotateCcw, Check, ArrowUp, ArrowDown, DollarSign, CreditCard, Calendar,
} from 'lucide-react'
import { cleanAndNormalizeAmount } from '@/lib/utils'
import { useWallet } from '@/context/WalletContext'

export interface DashboardFilterState {
  type: 'ALL' | 'DEPOSIT' | 'WITHDRAWAL'
  paymentMethod: 'ALL' | 'نقداً' | 'بنك' | 'تحويل مصرفي' | 'صك'
  minAmount: string
  maxAmount: string
  sortDateOrder: 'desc' | 'asc' // 'desc' = مؤخراً (newest first), 'asc' = مقدماً (oldest first)
  sortByAmount: 'none' | 'desc' | 'asc'
}

export const defaultDashboardFilter: DashboardFilterState = {
  type: 'ALL',
  paymentMethod: 'ALL',
  minAmount: '',
  maxAmount: '',
  sortDateOrder: 'desc',
  sortByAmount: 'none',
}

interface DashboardFilterModalProps {
  open: boolean
  onClose: () => void
  filterState: DashboardFilterState
  onApplyFilter: (newFilter: DashboardFilterState) => void
  onResetFilter: () => void
}

export function DashboardFilterModal({
  open,
  onClose,
  filterState,
  onApplyFilter,
  onResetFilter,
}: DashboardFilterModalProps) {
  const { activeWalletMeta } = useWallet()
  const [localFilter, setLocalFilter] = useState<DashboardFilterState>(filterState)

  useEffect(() => {
    setLocalFilter(filterState)
  }, [filterState, open])

  const handleMinAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value
    setLocalFilter((prev) => ({ ...prev, minAmount: cleanAndNormalizeAmount(rawVal, prev.minAmount) }))
  }

  const handleMaxAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value
    setLocalFilter((prev) => ({ ...prev, maxAmount: cleanAndNormalizeAmount(rawVal, prev.maxAmount) }))
  }

  const handleApply = () => {
    onApplyFilter(localFilter)
    onClose()
  }

  const handleReset = () => {
    onResetFilter()
    setLocalFilter(defaultDashboardFilter)
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent
        className="sm:max-w-md bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 shadow-2xl font-arabic text-zinc-900 dark:text-zinc-100 p-0 overflow-hidden rounded-2xl"
        dir="rtl"
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                تصفية وفلترة نتائج الجدول
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                تخصيص عرض المعاملات حسب المبلغ، أسلوب الدفع، والترتيب
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* 1. نوع المعاملة (Transaction Type) */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <span>نوع المعاملة</span>
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setLocalFilter((prev) => ({ ...prev, type: 'ALL' }))}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                  localFilter.type === 'ALL'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 font-bold shadow-xs'
                    : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                جميع العمليات
              </button>

              <button
                type="button"
                onClick={() => setLocalFilter((prev) => ({ ...prev, type: 'DEPOSIT' }))}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                  localFilter.type === 'DEPOSIT'
                    ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                    : 'bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/60 hover:bg-emerald-100/50'
                }`}
              >
                إيداع فقط
              </button>

              <button
                type="button"
                onClick={() => setLocalFilter((prev) => ({ ...prev, type: 'WITHDRAWAL' }))}
                className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                  localFilter.type === 'WITHDRAWAL'
                    ? 'bg-rose-600 text-white border-rose-600 font-bold shadow-xs'
                    : 'bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border-rose-200/80 dark:border-rose-800/60 hover:bg-rose-100/50'
                }`}
              >
                سحب فقط
              </button>
            </div>
          </div>

          {/* 2. أسلوب الدفع (Payment Method) */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-zinc-500" />
              <span>أسلوب الدفع</span>
            </Label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'ALL', label: 'الكل' },
                { id: 'نقداً', label: 'نقداً (Cash)' },
                { id: 'بنك', label: 'بنك' },
                { id: 'صك', label: 'صك مصدق' },
              ].map((method) => (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setLocalFilter((prev) => ({ ...prev, paymentMethod: method.id as any }))}
                  className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all text-center truncate ${
                    localFilter.paymentMethod === method.id
                      ? 'bg-sky-600 text-white border-sky-600 font-bold shadow-xs'
                      : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. نطاق المبلغ (Amount Range) */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-zinc-500" />
              <span>تصفية حسب قيمة المبلغ ({activeWalletMeta?.labelAr || 'دينار'} {activeWalletMeta?.symbol || 'د.ل'})</span>
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-1 block">الحد الأدنى (من)</span>
                <Input
                  type="text"
                  placeholder="0.00"
                  value={localFilter.minAmount}
                  onChange={handleMinAmountChange}
                  className="h-9 text-xs ar-num bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                />
              </div>
              <div>
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-1 block">الحد الأقصى (إلى)</span>
                <Input
                  type="text"
                  placeholder="بدون حد"
                  value={localFilter.maxAmount}
                  onChange={handleMaxAmountChange}
                  className="h-9 text-xs ar-num bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                />
              </div>
            </div>
          </div>

          {/* 4. ترتيب التاريخ (Date Sort Order: مؤخراً vs مقدماً) */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-500" />
              <span>ترتيب التاريخ الزمني</span>
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLocalFilter((prev) => ({ ...prev, sortDateOrder: 'desc' }))}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                  localFilter.sortDateOrder === 'desc'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 font-bold shadow-xs'
                    : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span>مؤخراً (الأحدث أولاً)</span>
              </button>

              <button
                type="button"
                onClick={() => setLocalFilter((prev) => ({ ...prev, sortDateOrder: 'asc' }))}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                  localFilter.sortDateOrder === 'asc'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 font-bold shadow-xs'
                    : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <ArrowUp className="w-3.5 h-3.5" />
                <span>مقدماً (الأقدم أولاً)</span>
              </button>
            </div>
          </div>

          {/* 5. ترتيب حسب القيمة المالية (Amount Sort Option) */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              ترتيب إضافي حسب المبلغ
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setLocalFilter((prev) => ({ ...prev, sortByAmount: 'none' }))}
                className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all text-center ${
                  localFilter.sortByAmount === 'none'
                    ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold'
                    : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
                }`}
              >
                افتراضي
              </button>

              <button
                type="button"
                onClick={() => setLocalFilter((prev) => ({ ...prev, sortByAmount: 'desc' }))}
                className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all text-center ${
                  localFilter.sortByAmount === 'desc'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
                }`}
              >
                الأعلى قيمة
              </button>

              <button
                type="button"
                onClick={() => setLocalFilter((prev) => ({ ...prev, sortByAmount: 'asc' }))}
                className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-all text-center ${
                  localFilter.sortByAmount === 'asc'
                    ? 'bg-rose-600 text-white font-bold'
                    : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
                }`}
              >
                الأدنى قيمة
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة ضبط</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs border-zinc-200 dark:border-zinc-800 cursor-pointer"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApply}
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-sm cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>تطبيق الفلترة</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
