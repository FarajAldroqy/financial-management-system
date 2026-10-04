import { useState, useRef, useEffect } from 'react'
import {
  X, Trash2, RotateCcw, LayoutDashboard, Coins, CheckSquare, Square,
} from 'lucide-react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { formatCurrency } from '@/lib/utils'
import type { Transaction } from '@/types'
import { DeleteConfirmModal } from '../dashboard/DeleteConfirmModal'
import { usePermission } from '@/hooks/usePermission'
import { logUserAction } from '@/lib/auditLogger'
import { playClickSound, playDeleteSound } from '@/lib/soundEffects'

export interface EntityBalance {
  name: string
  depositedCents: number
  withdrawnCents: number
  netCents: number
  transactionCount: number
}

interface TrashDrawerProps {
  open: boolean
  onClose: () => void
  deletedDashboardRows: Transaction[]
  deletedTreasuryRows: EntityBalance[]
  onRestoreDashboardRow: (id: number) => Promise<void>
  onPermanentDeleteDashboardRow: (id: number) => Promise<void>
  onRestoreTreasuryEntity: (name: string) => Promise<void>
  onPermanentDeleteTreasuryEntity: (name: string) => Promise<void>
  onRestoreDashboardRowsBatch?: (ids: number[]) => Promise<void>
  onPermanentDeleteDashboardRowsBatch?: (ids: number[]) => Promise<void>
  onRestoreTreasuryEntitiesBatch?: (names: string[]) => Promise<void>
  onPermanentDeleteTreasuryEntitiesBatch?: (names: string[]) => Promise<void>
}

export function TrashDrawer({
  open,
  onClose,
  deletedDashboardRows,
  deletedTreasuryRows,
  onRestoreDashboardRow,
  onPermanentDeleteDashboardRow,
  onRestoreTreasuryEntity,
  onPermanentDeleteTreasuryEntity,
  onRestoreDashboardRowsBatch,
  onPermanentDeleteDashboardRowsBatch,
  onRestoreTreasuryEntitiesBatch,
  onPermanentDeleteTreasuryEntitiesBatch,
}: TrashDrawerProps) {
  const { hasPermission } = usePermission()
  const canDeleteItems = hasPermission('delete_items')
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'TREASURY'>('DASHBOARD')

  // Swiped row states for slide-to-reveal action bar
  const [swipedDashId, setSwipedDashId] = useState<number | null>(null)
  const [swipedTreasuryName, setSwipedTreasuryName] = useState<string | null>(null)

  // Batch Selection States
  const [selectedDashIds, setSelectedDashIds] = useState<number[]>([])
  const [selectedTreasuryNames, setSelectedTreasuryNames] = useState<string[]>([])
  const [isBatchDeleting, setIsBatchDeleting] = useState(false)

  // Delete confirm modal state
  const [pendingDelete, setPendingDelete] = useState<{
    type: 'DASHBOARD' | 'TREASURY' | 'BATCH_DASHBOARD' | 'BATCH_TREASURY'
    idOrName?: number | string
  } | null>(null)

  const drawerRef = useRef<HTMLDivElement>(null)

  const totalDeletedCount = deletedDashboardRows.length + deletedTreasuryRows.length

  // Clear selections when switching tabs or closing
  useEffect(() => {
    setSelectedDashIds([])
    setSelectedTreasuryNames([])
  }, [activeTab, open])

  // Automatically close drawer if all items are restored or deleted
  useEffect(() => {
    if (open && totalDeletedCount === 0) {
      onClose()
    }
  }, [open, totalDeletedCount, onClose])

  // Click outside & Escape listener
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

  // Checkbox Select All Helpers
  const isAllDashSelected =
    deletedDashboardRows.length > 0 && selectedDashIds.length === deletedDashboardRows.length

  const handleToggleSelectAllDash = () => {
    playClickSound()
    if (isAllDashSelected) {
      setSelectedDashIds([])
    } else {
      setSelectedDashIds(deletedDashboardRows.map((r) => r.id))
    }
  }

  const handleToggleSelectDashRow = (id: number) => {
    playClickSound()
    setSelectedDashIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const isAllTreasurySelected =
    deletedTreasuryRows.length > 0 && selectedTreasuryNames.length === deletedTreasuryRows.length

  const handleToggleSelectAllTreasury = () => {
    playClickSound()
    if (isAllTreasurySelected) {
      setSelectedTreasuryNames([])
    } else {
      setSelectedTreasuryNames(deletedTreasuryRows.map((r) => r.name))
    }
  }

  const handleToggleSelectTreasuryRow = (name: string) => {
    playClickSound()
    setSelectedTreasuryNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  // Batch Restore Handlers
  const handleBatchRestoreDash = async () => {
    if (selectedDashIds.length === 0) return
    playClickSound()
    logUserAction(
      'RESTORE',
      'سلة المهملات والأرشيف',
      'استعادة دفعة عناصر من سلة المهملات (لوحة التحكم)',
      `عدد العناصر: ${selectedDashIds.length}`
    )
    const ids = [...selectedDashIds]
    setSelectedDashIds([])
    if (onRestoreDashboardRowsBatch) {
      await onRestoreDashboardRowsBatch(ids)
    } else {
      if (window.electronAPI?.restoreTransactionsBatch) {
        await window.electronAPI.restoreTransactionsBatch(ids)
      }
      for (const id of ids) {
        await onRestoreDashboardRow(id)
      }
    }
  }

  const handleBatchRestoreTreasury = async () => {
    if (selectedTreasuryNames.length === 0) return
    playClickSound()
    logUserAction(
      'RESTORE',
      'سلة المهملات والأرشيف',
      'استعادة دفعة جهات من سلة المهملات (الخزينة)',
      `عدد الجهات: ${selectedTreasuryNames.length}`
    )
    const names = [...selectedTreasuryNames]
    setSelectedTreasuryNames([])
    if (onRestoreTreasuryEntitiesBatch) {
      await onRestoreTreasuryEntitiesBatch(names)
    } else {
      if (window.electronAPI?.restoreEntitiesBatch) {
        await window.electronAPI.restoreEntitiesBatch(names)
      }
      for (const name of names) {
        await onRestoreTreasuryEntity(name)
      }
    }
  }

  // Single & Batch Delete Confirmation Execution
  const handleConfirmDelete = async () => {
    if (!pendingDelete) return

    playDeleteSound()
    setIsBatchDeleting(true)

    try {
      if (pendingDelete.type === 'DASHBOARD' && pendingDelete.idOrName) {
        await onPermanentDeleteDashboardRow(pendingDelete.idOrName as number)
        setSwipedDashId(null)
      } else if (pendingDelete.type === 'TREASURY' && pendingDelete.idOrName) {
        await onPermanentDeleteTreasuryEntity(pendingDelete.idOrName as string)
        setSwipedTreasuryName(null)
      } else if (pendingDelete.type === 'BATCH_DASHBOARD') {
        const ids = [...selectedDashIds]
        setSelectedDashIds([])
        if (onPermanentDeleteDashboardRowsBatch) {
          await onPermanentDeleteDashboardRowsBatch(ids)
        } else {
          if (window.electronAPI?.deleteTransactionsBatch) {
            await window.electronAPI.deleteTransactionsBatch(ids, true)
          }
          for (const id of ids) {
            await onPermanentDeleteDashboardRow(id)
          }
        }
      } else if (pendingDelete.type === 'BATCH_TREASURY') {
        const names = [...selectedTreasuryNames]
        setSelectedTreasuryNames([])
        if (onPermanentDeleteTreasuryEntitiesBatch) {
          await onPermanentDeleteTreasuryEntitiesBatch(names)
        } else {
          if (window.electronAPI?.deleteEntitiesBatch) {
            await window.electronAPI.deleteEntitiesBatch(names, true)
          }
          for (const name of names) {
            await onPermanentDeleteTreasuryEntity(name)
          }
        }
      }
    } finally {
      setIsBatchDeleting(false)
      setPendingDelete(null)
    }
  }

  return (
    <AnimatePresence>
      {open && (
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
            ref={drawerRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 240 }}
            className="relative w-full sm:w-[680px] h-full bg-white dark:bg-zinc-900 border-l border-zinc-200/80 dark:border-zinc-800 shadow-2xl z-50 flex flex-col justify-between overflow-hidden text-zinc-900 dark:text-zinc-100"
            dir="rtl"
          >
            {/* Drawer Top Header */}
            <div className="px-6 py-4 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-xs">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <span>سلة المهملات والمحذوفات المؤقتة</span>
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs font-bold ar-num">
                        {totalDeletedCount} عنصر
                      </span>
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      استعادة العناصر المحذوفة إلى جداولها الأصلية أو حذفها نهائياً
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

              {/* Trash Section Navigation Tabs */}
              <div className="mt-4 flex items-center gap-2 border-b border-zinc-200/80 dark:border-zinc-800 pb-0">
                <button
                  onClick={() => setActiveTab('DASHBOARD')}
                  className={`py-2 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                    activeTab === 'DASHBOARD'
                      ? 'border-rose-600 text-rose-600 dark:border-rose-400 dark:text-rose-400 font-extrabold'
                      : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>محذوفات لوحة التحكم</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] ar-num">
                    {deletedDashboardRows.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('TREASURY')}
                  className={`py-2 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                    activeTab === 'TREASURY'
                      ? 'border-rose-600 text-rose-600 dark:border-rose-400 dark:text-rose-400 font-extrabold'
                      : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>محذوفات الخزينة</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] ar-num">
                    {deletedTreasuryRows.length}
                  </span>
                </button>
              </div>
            </div>

            {/* Drawer Body Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

              {/* TAB 1: DASHBOARD DELETED TRANSACTIONS */}
              {activeTab === 'DASHBOARD' && (
                <div className="space-y-3">
                  {/* Batch Action Toolbar Bar */}
                  {selectedDashIds.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-3 text-xs font-bold">
                      <span className="text-rose-800 dark:text-rose-300 font-extrabold ar-num">
                        تم تحديد {selectedDashIds.length} معاملة
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleBatchRestoreDash}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>استعادة المحدد</span>
                        </button>
                        {canDeleteItems && (
                          <button
                            onClick={() => setPendingDelete({ type: 'BATCH_DASHBOARD' })}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف نهائي للمحدد</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {deletedDashboardRows.length === 0 ? (
                    <div className="text-center py-16 text-xs text-zinc-400 dark:text-zinc-500">
                      سلة مهملات لوحة التحكم فارغة
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-xl">
                      <table className="w-full text-right text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 font-bold border-b border-zinc-200 dark:border-zinc-800">
                            <th className="py-2.5 px-3 w-10 text-center">
                              <button
                                onClick={handleToggleSelectAllDash}
                                className="p-0.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                                title="تحديد الكل"
                              >
                                {isAllDashSelected ? (
                                  <CheckSquare className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </th>
                            <th className="py-2.5 px-3">التاريخ</th>
                            <th className="py-2.5 px-3">الجهة / المستفيد</th>
                            <th className="py-2.5 px-3 text-center">نوع المعاملة</th>
                            <th className="py-2.5 px-3 text-left">المبلغ</th>
                          </tr>
                        </thead>
                        <tbody>
                          <LayoutGroup id="dashboard-trash-group">
                            <AnimatePresence mode="popLayout" initial={false}>
                              {deletedDashboardRows.map((tx) => {
                                const isSwiped = swipedDashId === tx.id
                                const isSelected = selectedDashIds.includes(tx.id)
                                const isDeposit = tx.type === 'DEPOSIT'

                                return (
                                  <motion.tr
                                    layout
                                    key={tx.id}
                                    onDoubleClick={() => setSwipedDashId((prev) => (prev === tx.id ? null : tx.id))}
                                    className={`border-b border-zinc-200/60 dark:border-zinc-800/60 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 cursor-pointer select-none relative group ${
                                      isSelected ? 'bg-rose-50/60 dark:bg-rose-950/20' : ''
                                    }`}
                                  >
                                    <td colSpan={5} className="p-0 relative">
                                      {/* Underlying Action Bar */}
                                      {isSwiped && (
                                        <div className="absolute left-0 inset-y-0 flex items-stretch z-10">
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation()
                                              logUserAction('RESTORE', 'سلة المهملات والأرشيف', 'استعادة معاملة من سلة المهملات', `جهة: ${tx.client_name} | قيمة: ${formatCurrency(tx.amount_cents)}`)
                                              await onRestoreDashboardRow(tx.id)
                                              setSwipedDashId(null)
                                            }}
                                            className="px-3 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 font-bold text-[11px] transition-colors"
                                            title="استعادة المعاملة"
                                          >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            <span>استعادة</span>
                                          </button>
                                          {canDeleteItems && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                setPendingDelete({ type: 'DASHBOARD', idOrName: tx.id })
                                              }}
                                              className="px-3 bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1 font-bold text-[11px] transition-colors"
                                              title="حذف نهائي"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                              <span>حذف نهائي</span>
                                            </button>
                                          )}
                                        </div>
                                      )}

                                      {/* Row Content Layer */}
                                      <motion.div
                                        animate={{ x: isSwiped ? (canDeleteItems ? 130 : 70) : 0 }}
                                        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                                        className="flex items-center w-full px-3 py-2.5 bg-inherit opacity-85"
                                      >
                                        <div className="w-10 text-center shrink-0">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleToggleSelectDashRow(tx.id)
                                            }}
                                            className="p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                                          >
                                            {isSelected ? (
                                              <CheckSquare className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                            ) : (
                                              <Square className="w-4 h-4" />
                                            )}
                                          </button>
                                        </div>
                                        <div className="w-28 text-zinc-500 dark:text-zinc-400 text-[11px] ar-num">
                                          {new Date(tx.created_at).toLocaleDateString('ar-LY')}
                                        </div>
                                        <div className="flex-1 font-bold text-zinc-900 dark:text-zinc-100 truncate line-through decoration-rose-500/50">
                                          {tx.client_name}
                                        </div>
                                        <div className="w-24 text-center">
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            isDeposit
                                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                          }`}>
                                            {isDeposit ? 'إيداع' : 'سحب'}
                                          </span>
                                        </div>
                                        <div className="w-28 text-left font-bold ar-num">
                                          <span className={isDeposit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                            {isDeposit ? '+' : '-'}{formatCurrency(tx.amount_cents)}
                                          </span>
                                        </div>
                                      </motion.div>
                                    </td>
                                  </motion.tr>
                                )
                              })}
                            </AnimatePresence>
                          </LayoutGroup>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: TREASURY DELETED ENTITIES */}
              {activeTab === 'TREASURY' && (
                <div className="space-y-3">
                  {/* Batch Action Toolbar Bar */}
                  {selectedTreasuryNames.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-3 text-xs font-bold">
                      <span className="text-rose-800 dark:text-rose-300 font-extrabold ar-num">
                        تم تحديد {selectedTreasuryNames.length} جهة
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleBatchRestoreTreasury}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>استعادة المحدد</span>
                        </button>
                        {canDeleteItems && (
                          <button
                            onClick={() => setPendingDelete({ type: 'BATCH_TREASURY' })}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف نهائي للمحدد</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {deletedTreasuryRows.length === 0 ? (
                    <div className="text-center py-16 text-xs text-zinc-400 dark:text-zinc-500">
                      سلة مهملات الخزينة فارغة
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-xl">
                      <table className="w-full text-right text-xs border-collapse">
                        <thead>
                          <tr className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 font-bold border-b border-zinc-200 dark:border-zinc-800">
                            <th className="py-2.5 px-3 w-10 text-center">
                              <button
                                onClick={handleToggleSelectAllTreasury}
                                className="p-0.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
                                title="تحديد الكل"
                              >
                                {isAllTreasurySelected ? (
                                  <CheckSquare className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </th>
                            <th className="py-2.5 px-3">اسم الجهة</th>
                            <th className="py-2.5 px-3 text-center">المعاملات</th>
                            <th className="py-2.5 px-3 text-right">المودعات</th>
                            <th className="py-2.5 px-3 text-right">المسحوبات</th>
                            <th className="py-2.5 px-3 text-left">صافي الحساب</th>
                          </tr>
                        </thead>
                        <tbody>
                          <LayoutGroup id="treasury-trash-group">
                            <AnimatePresence mode="popLayout" initial={false}>
                              {deletedTreasuryRows.map((entity) => {
                                const isSwiped = swipedTreasuryName === entity.name
                                const isSelected = selectedTreasuryNames.includes(entity.name)
                                const isPositiveNet = entity.netCents >= 0

                                return (
                                  <motion.tr
                                    layout
                                    key={entity.name}
                                    onDoubleClick={() => setSwipedTreasuryName((prev) => (prev === entity.name ? null : entity.name))}
                                    className={`border-b border-zinc-200/60 dark:border-zinc-800/60 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 cursor-pointer select-none relative group ${
                                      isSelected ? 'bg-rose-50/60 dark:bg-rose-950/20' : ''
                                    }`}
                                  >
                                    <td colSpan={6} className="p-0 relative">
                                      {/* Underlying Action Bar */}
                                      {isSwiped && (
                                        <div className="absolute left-0 inset-y-0 flex items-stretch z-10">
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation()
                                              await onRestoreTreasuryEntity(entity.name)
                                              setSwipedTreasuryName(null)
                                            }}
                                            className="px-3 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 font-bold text-[11px] transition-colors"
                                            title="استعادة الجهة"
                                          >
                                            <RotateCcw className="w-3.5 h-3.5" />
                                            <span>استعادة</span>
                                          </button>
                                          {canDeleteItems && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                setPendingDelete({ type: 'TREASURY', idOrName: entity.name })
                                              }}
                                              className="px-3 bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1 font-bold text-[11px] transition-colors"
                                              title="حذف نهائي"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                              <span>حذف نهائي</span>
                                            </button>
                                          )}
                                        </div>
                                      )}

                                      {/* Row Content Layer */}
                                      <motion.div
                                        animate={{ x: isSwiped ? (canDeleteItems ? 130 : 70) : 0 }}
                                        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                                        className="flex items-center w-full px-3 py-2.5 bg-inherit opacity-85"
                                      >
                                        <div className="w-10 text-center shrink-0">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleToggleSelectTreasuryRow(entity.name)
                                            }}
                                            className="p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                                          >
                                            {isSelected ? (
                                              <CheckSquare className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                            ) : (
                                              <Square className="w-4 h-4" />
                                            )}
                                          </button>
                                        </div>
                                        <div className="flex-1 font-bold text-zinc-900 dark:text-zinc-100 truncate line-through decoration-rose-500/50">
                                          {entity.name}
                                        </div>
                                        <div className="w-20 text-center ar-num text-zinc-500">
                                          {entity.transactionCount}
                                        </div>
                                        <div className="w-28 text-right ar-num text-emerald-600 dark:text-emerald-400 font-semibold">
                                          +{formatCurrency(entity.depositedCents)}
                                        </div>
                                        <div className="w-28 text-right ar-num text-rose-600 dark:text-rose-400 font-semibold">
                                          -{formatCurrency(entity.withdrawnCents)}
                                        </div>
                                        <div className="w-32 text-left ar-num font-bold">
                                          <span className={isPositiveNet ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}>
                                            {formatCurrency(entity.netCents)}
                                          </span>
                                        </div>
                                      </motion.div>
                                    </td>
                                  </motion.tr>
                                )
                              })}
                            </AnimatePresence>
                          </LayoutGroup>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </div>
          </motion.aside>

          {/* Permanent Delete Confirmation Modal */}
          <DeleteConfirmModal
            open={pendingDelete !== null}
            onClose={() => setPendingDelete(null)}
            onConfirm={handleConfirmDelete}
          />
        </div>
      )}
    </AnimatePresence>
  )
}
