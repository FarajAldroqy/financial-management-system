import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  ShieldCheck, Printer, Clock, ArrowUpRight, UserCheck, Calendar, Activity,
} from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Transaction } from '@/types'
import { getReceiptSerial } from './PrintReceipt'
import { getSystemAuditLogs, SystemAuditLogEntry } from '@/lib/auditLogger'
import { useWallet } from '@/context/WalletContext'

interface UserAuditModalProps {
  open: boolean
  onClose: () => void
}

export interface UnifiedAuditEvent {
  id: string
  username: string
  actionType: string
  category: 'مالية' | 'سلة المهملات والأرشيف' | 'الخزينة والجهات' | 'تقارير وطباعة' | 'المستخدمين' | 'نظام'
  title: string
  details: string
  timestamp: string
  dateKey: string // YYYY-MM-DD
}

interface WeekdayOption {
  dayName: string
  dateFormatted: string
  dateKey: string // YYYY-MM-DD
}

function getCurrentWeekDays(): WeekdayOption[] {
  const dayNamesAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
  const today = new Date()
  const days: WeekdayOption[] = []

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dayName = dayNamesAr[d.getDay()]
    const dateFormatted = `${d.getDate()}/${d.getMonth() + 1}`
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const dateKey = `${yyyy}-${mm}-${dd}`

    days.push({ dayName, dateFormatted, dateKey })
  }
  return days
}

export function UserAuditModal({ open, onClose }: UserAuditModalProps) {
  const currentUsername = sessionStorage.getItem('current_username') || 'admin'
  const isAdmin = currentUsername.toLowerCase() === 'admin'

  const { activeWallet } = useWallet()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [auditLogs, setAuditLogs] = useState<SystemAuditLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDayKey, setSelectedDayKey] = useState<string>('ALL')

  const weekDays = useMemo(() => getCurrentWeekDays(), [])

  // Fetch transactions and system audit logs when modal opens
  useEffect(() => {
    if (!open) return
    let isMounted = true

    const loadData = async () => {
      setLoading(true)
      try {
        if (window.electronAPI?.getTransactions) {
          const res = await window.electronAPI.getTransactions({
            page: 1,
            pageSize: 1000,
            wallet_type: activeWallet || 'LYD',
          })
          if (isMounted) setTransactions(res.data)
        }
        if (isMounted) {
          setAuditLogs(getSystemAuditLogs())
        }
      } catch (err) {
        console.error('Failed to load audit data:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadData()
    return () => {
      isMounted = false
    }
  }, [open, activeWallet])

  // Combine financial transactions and logged system audit actions into unified events
  const allEvents = useMemo(() => {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const list: UnifiedAuditEvent[] = []

    // 1. Convert Financial Transactions to Audit Events
    transactions.forEach((tx) => {
      const txDate = new Date(tx.created_at)
      if (isNaN(txDate.getTime()) || txDate < sevenDaysAgo) return

      const txUser = (tx as any).created_by || 'admin'
      if (!isAdmin && txUser.toLowerCase() !== currentUsername.toLowerCase()) return

      const yyyy = txDate.getFullYear()
      const mm = String(txDate.getMonth() + 1).padStart(2, '0')
      const dd = String(txDate.getDate()).padStart(2, '0')
      const dateKey = `${yyyy}-${mm}-${dd}`

      const isDeposit = tx.type === 'DEPOSIT'
      list.push({
        id: `tx-${tx.id}`,
        username: txUser,
        actionType: tx.type,
        category: 'مالية',
        title: isDeposit ? 'عملية إيداع مالية' : 'عملية سحب مالية',
        details: `إيصال #${getReceiptSerial(tx)} | جهة: ${tx.client_name} | قيمة: ${formatCurrency(tx.amount_cents)} | ${tx.payment_method || 'نقداً'}`,
        timestamp: tx.created_at,
        dateKey,
      })
    })

    // 2. Add System Audit Log Actions (Deletions, Restorations, Entity Edits, User Management, Printing)
    auditLogs.forEach((log) => {
      const logDate = new Date(log.timestamp)
      if (isNaN(logDate.getTime()) || logDate < sevenDaysAgo) return

      if (!isAdmin && log.username.toLowerCase() !== currentUsername.toLowerCase()) return

      const yyyy = logDate.getFullYear()
      const mm = String(logDate.getMonth() + 1).padStart(2, '0')
      const dd = String(logDate.getDate()).padStart(2, '0')
      const dateKey = `${yyyy}-${mm}-${dd}`

      list.push({
        id: log.id,
        username: log.username,
        actionType: log.actionType,
        category: log.category,
        title: log.title,
        details: log.details || '-',
        timestamp: log.timestamp,
        dateKey,
      })
    })

    // Sort newest first
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [transactions, auditLogs, currentUsername, isAdmin])

  // Filter events by selected weekday
  const filteredEvents = useMemo(() => {
    if (selectedDayKey === 'ALL') return allEvents
    return allEvents.filter((ev) => ev.dateKey === selectedDayKey)
  }, [allEvents, selectedDayKey])

  // Summary counts
  const totalEventsCount = filteredEvents.length
  const financialEventsCount = filteredEvents.filter((e) => e.category === 'مالية').length
  const sysActionsCount = filteredEvents.filter((e) => e.category !== 'مالية').length

  const handlePrintAudit = () => {
    window.print()
  }

  const getActionBadgeStyle = (actionType: string) => {
    switch (actionType) {
      case 'DEPOSIT':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
      case 'WITHDRAWAL':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-200 dark:border-rose-800'
      case 'DELETE':
      case 'DELETE_USER':
        return 'bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border-red-200 dark:border-red-800'
      case 'RESTORE':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border-sky-200 dark:border-sky-800'
      case 'ARCHIVE':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 dark:border-amber-800'
      case 'ADD_ENTITY':
      case 'EDIT_ENTITY':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-200 dark:border-purple-800'
      case 'PRINT_REPORT':
      case 'PRINT_RECEIPT':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 dark:border-blue-800'
      case 'ADD_USER':
      case 'EDIT_USER':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
      default:
        return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700'
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-5xl bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl rounded-2xl p-6 font-arabic max-h-[88vh] flex flex-col"
        dir="rtl"
      >
        {/* Header Section */}
        <DialogHeader className="text-right shrink-0 border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800 shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold font-arabic text-zinc-900 dark:text-white flex items-center gap-2">
                  <span>سجل الأفعال والعمليات للمستخدم:</span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-mono font-extrabold">
                    {currentUsername}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 font-arabic mt-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>سياسة عدم الإنكار الشاملة - تتبع المعاملات المالية، الاستعادة، الحذف، الطباعة، والتعامل مع النظام</span>
                </DialogDescription>
              </div>
            </div>

            {/* Print Audit Statement Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrintAudit}
              className="h-8 gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-arabic font-medium shadow-2xs cursor-pointer shrink-0"
            >
              <Printer className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>طباعة سجل الأنشطة</span>
            </Button>
          </div>
        </DialogHeader>

        {/* 1. Weekday Filter Buttons Row (مصفوفة أيام الأسبوع فوق الجدول) */}
        <div className="my-3 shrink-0">
          <div className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-2 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
            <span>اختر اليوم من الأسبوع لفلترة سجل الأنشطة:</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              onClick={() => setSelectedDayKey('ALL')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer border ${
                selectedDayKey === 'ALL'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              الكل (كامل الأسبوع)
            </button>

            {weekDays.map((day) => {
              const isSelected = selectedDayKey === day.dateKey
              return (
                <button
                  key={day.dateKey}
                  onClick={() => setSelectedDayKey(day.dateKey)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 cursor-pointer border flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span>{day.dayName}</span>
                  <span className="text-[10px] opacity-75 ar-num">({day.dateFormatted})</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Audit Stats Summary Row */}
        <div className="grid grid-cols-3 gap-3 mb-3 shrink-0 font-arabic">
          <Card className="p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 shadow-none">
            <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-sky-500" />
              <span>إجمالي الأفعال المسجلة</span>
            </div>
            <div className="text-sm font-extrabold text-zinc-900 dark:text-white mt-0.5 ar-num">
              {totalEventsCount} نشاط
            </div>
          </Card>

          <Card className="p-2.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-none">
            <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
              <span>المعاملات المالية</span>
            </div>
            <div className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5 ar-num">
              {financialEventsCount} عملية
            </div>
          </Card>

          <Card className="p-2.5 rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 shadow-none">
            <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span>إجراءات النظام والطباعة</span>
            </div>
            <div className="text-sm font-extrabold text-indigo-700 dark:text-indigo-300 mt-0.5 ar-num">
              {sysActionsCount} إجراء
            </div>
          </Card>
        </div>

        {/* Audit Log Table Container */}
        <div className="flex-1 overflow-y-auto border border-zinc-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900">
          <table className="w-full text-right font-arabic border-collapse text-xs">
            <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700 z-10">
              <tr>
                <th className="py-2.5 px-3 font-bold text-center w-12">#</th>
                <th className="py-2.5 px-3 font-bold text-center w-28">نوع الفعل</th>
                <th className="py-2.5 px-3 font-bold text-right w-44">عنوان الفعل / النشاط</th>
                <th className="py-2.5 px-3 font-bold text-right">التفاصيل والبيانات</th>
                <th className="py-2.5 px-3 font-bold text-center w-28">الفئة</th>
                <th className="py-2.5 px-3 font-bold text-right w-40">التاريخ والوقت</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className="py-3 px-4">
                      <div className="h-4 w-full bg-zinc-200/50 dark:bg-zinc-800/50 rounded" />
                    </td>
                  </tr>
                ))
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-zinc-400 dark:text-zinc-500 font-medium">
                    لا توجد أنشطة مسجلة لهذا اليوم المختار
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev, index) => {
                  return (
                    <tr key={ev.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 transition-colors">
                      {/* # */}
                      <td className="py-2.5 px-3 text-center font-mono text-zinc-400 dark:text-zinc-500 ar-num">
                        {index + 1}
                      </td>

                      {/* نوع الفعل */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadgeStyle(ev.actionType)}`}>
                          {ev.actionType}
                        </span>
                      </td>

                      {/* عنوان الفعل / النشاط */}
                      <td className="py-2.5 px-3 font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {ev.title}
                      </td>

                      {/* التفاصيل والبيانات */}
                      <td className="py-2.5 px-3 font-medium text-zinc-600 dark:text-zinc-400 ar-num dir-rtl">
                        {ev.details}
                      </td>

                      {/* الفئة */}
                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-semibold border border-zinc-200/60 dark:border-zinc-700">
                          {ev.category}
                        </span>
                      </td>

                      {/* الوقت والتاريخ بالدقيقة */}
                      <td className="py-2.5 px-3 text-zinc-500 dark:text-zinc-400 ar-num text-[11px] dir-ltr text-right">
                        {formatDate(ev.timestamp)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <DialogFooter className="mt-3 shrink-0 flex-row-reverse">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="px-6 text-xs font-arabic border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
          >
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
