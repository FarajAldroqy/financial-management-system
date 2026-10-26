import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Eye, Printer, Plus, CheckSquare, Filter,
  ChevronLeft, ChevronRight, Pin, Trash2, Archive, FileText, Edit3, Loader2, Download,
} from 'lucide-react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { formatCurrency, formatDate, filterTransactionsByDate, getLocalDeviceISOString } from '@/lib/utils'
import type { Transaction, TransactionCreate, DateFilter } from '@/types'
import { TransactionModal } from './TransactionModal'
import { EditTransactionModal } from './EditTransactionModal'
import { ReceiptModal } from './ReceiptModal'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { PrintReceipt } from './PrintReceipt'
import { TransactionsReportModal } from './TransactionsReportModal'
import {
  DashboardFilterModal,
  DashboardFilterState,
  defaultDashboardFilter,
} from './DashboardFilterModal'
import { usePermission } from '@/hooks/usePermission'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { logUserAction } from '@/lib/auditLogger'
import {
  playDepositSound, playWithdrawalSound, playDeleteSound, playClickSound
} from '@/lib/soundEffects'

import { initMockElectronAPI } from '@/lib/mockApi'
import { exportTransactionsToCsv } from '@/lib/exportUtils'
import { useWallet } from '@/context/WalletContext'

const PAGE_SIZE = 8

function sortTransactions(items: Transaction[]): Transaction[] {
  return [...items].sort((a, b) => {
    const pinA = a.is_pinned ?? 0
    const pinB = b.is_pinned ?? 0
    if (pinA !== pinB) return pinB - pinA
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

interface TransactionsTableProps {
  searchValue: string
  onStatsRefresh: () => void
  dateFilter?: DateFilter
  paymentMethodFilter?: 'ALL' | 'نقداً' | 'بنك'
  onArchiveRow?: (tx: Transaction) => void
  onDeleteRow?: (tx: Transaction) => void
}

export function TransactionsTable({
  searchValue,
  onStatsRefresh,
  dateFilter,
  paymentMethodFilter = 'ALL',
  onArchiveRow,
  onDeleteRow,
}: TransactionsTableProps) {
  const { hasPermission } = usePermission()
  const canEditData = hasPermission('edit_data')
  const canDeleteItems = hasPermission('delete_items')
  const { activeWallet } = useWallet()

  const [data, setData] = useState<Transaction[]>([])
  const [allFilteredTransactions, setAllFilteredTransactions] = useState<Transaction[]>([])
  const transactionCacheRef = useRef<Map<number, Transaction>>(new Map())
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAWAL'>('ALL')
  const [activeTab, setActiveTab] = useState<'all' | 'deposits' | 'withdrawals'>('all')
  const [loading, setLoading] = useState(false)

  // Swiped row state for slide-to-reveal action bar
  const [swipedRowId, setSwipedRowId] = useState<number | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  // Exit animation & confirmation states
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [archivingId, setArchivingId] = useState<number | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)

  // Newly created deposit/withdrawal camera strobe flash state (~140ms)
  const [newlyCreatedId, setNewlyCreatedId] = useState<number | null>(null)

  // Audio-style pagination range slider toggle state
  const [isSliderMode, setIsSliderMode] = useState(false)

  // Transaction creation modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT')

  // Transaction edit modal state
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  // Funnel Filter Modal State
  const [dashboardFilter, setDashboardFilter] = useState<DashboardFilterState>(defaultDashboardFilter)
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)

  // Receipt viewing modal state
  const [selectedReceipt, setSelectedReceipt] = useState<Transaction | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (dashboardFilter.type !== 'ALL') count++
    if (dashboardFilter.paymentMethod !== 'ALL') count++
    if (dashboardFilter.minAmount.trim() !== '') count++
    if (dashboardFilter.maxAmount.trim() !== '') count++
    if (dashboardFilter.sortDateOrder !== 'desc') count++
    if (dashboardFilter.sortByAmount !== 'none') count++
    return count
  }, [dashboardFilter])

  const fetchData = useCallback(async () => {
    initMockElectronAPI()
    if (!window.electronAPI) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const walletType = activeWallet || 'LYD'
      const effectiveType = typeFilter !== 'ALL' ? typeFilter : dashboardFilter.type

      // Always fetch all active records for this wallet & criteria to ensure multi-page reports and selections work completely
      const result = await window.electronAPI.getTransactions({
        page: 1,
        pageSize: 10000,
        search: searchValue,
        type: effectiveType,
        status: 'ACTIVE',
        wallet_type: walletType,
      })
      let items = result.data || []

      // Apply date filter
      if (dateFilter && dateFilter.mode !== 'NONE') {
        items = filterTransactionsByDate(items, dateFilter)
      }

      // Apply payment method filter (Quick segmented switch or Funnel filter)
      const effectiveMethod = (paymentMethodFilter && paymentMethodFilter !== 'ALL')
        ? paymentMethodFilter
        : dashboardFilter.paymentMethod

      if (effectiveMethod !== 'ALL') {
        items = items.filter((t) => {
          if (effectiveMethod === 'بنك') {
            return t.payment_method === 'بنك' || t.payment_method === 'تحويل مصرفي'
          }
          return t.payment_method === effectiveMethod
        })
      }

      // Apply min amount filter
      if (dashboardFilter.minAmount.trim() !== '') {
        const minCents = parseFloat(dashboardFilter.minAmount) * 100
        items = items.filter((t) => t.amount_cents >= minCents)
      }

      // Apply max amount filter
      if (dashboardFilter.maxAmount.trim() !== '') {
        const maxCents = parseFloat(dashboardFilter.maxAmount) * 100
        items = items.filter((t) => t.amount_cents <= maxCents)
      }

      // Apply custom sorting
      items.sort((a, b) => {
        const pinA = a.is_pinned ?? 0
        const pinB = b.is_pinned ?? 0
        if (pinA !== pinB) return pinB - pinA

        if (dashboardFilter.sortByAmount === 'desc') {
          return b.amount_cents - a.amount_cents
        }
        if (dashboardFilter.sortByAmount === 'asc') {
          return a.amount_cents - b.amount_cents
        }

        if (dashboardFilter.sortDateOrder === 'asc') {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      // Cache all loaded transactions for persistent multi-page operations
      items.forEach((t) => {
        if (t && typeof t.id === 'number') {
          transactionCacheRef.current.set(t.id, t)
        }
      })

      setAllFilteredTransactions(items)
      setTotal(items.length)
    } catch (err) {
      console.error('Failed to fetch transactions', err)
    } finally {
      setLoading(false)
    }
  }, [searchValue, typeFilter, dateFilter, dashboardFilter, activeWallet, paymentMethodFilter])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    setPage(1)
  }, [searchValue, typeFilter, dateFilter, dashboardFilter, activeWallet, paymentMethodFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Synchronize current page slice from allFilteredTransactions
  useEffect(() => {
    const calculatedTotalPages = Math.max(1, Math.ceil(allFilteredTransactions.length / PAGE_SIZE))
    if (page > calculatedTotalPages && allFilteredTransactions.length > 0) {
      setPage(calculatedTotalPages)
      return
    }
    const start = (page - 1) * PAGE_SIZE
    setData(allFilteredTransactions.slice(start, start + PAGE_SIZE))
  }, [page, allFilteredTransactions])

  // Click-outside and Escape key listener to dismiss swiped row
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (swipedRowId !== null && tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setSwipedRowId(null)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && swipedRowId !== null) {
        setSwipedRowId(null)
      }
    }

    window.addEventListener('click', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('click', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [swipedRowId])

  const handleRowDoubleClick = (id: number) => {
    setSwipedRowId((prev) => (prev === id ? null : id))
  }

  // Edit Transaction Handler
  const handleOpenEditModal = (tx: Transaction, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSwipedRowId(null)
    setEditingTransaction(tx)
  }

  const handleEditSuccess = (updatedTx: Transaction) => {
    setData((prev) => {
      if (updatedTx.wallet_type && activeWallet && updatedTx.wallet_type !== activeWallet) {
        return prev.filter((t) => t.id !== updatedTx.id)
      }
      return sortTransactions(prev.map((t) => (t.id === updatedTx.id ? updatedTx : t)))
    })
    setAllFilteredTransactions((prev) => {
      if (updatedTx.wallet_type && activeWallet && updatedTx.wallet_type !== activeWallet) {
        return prev.filter((t) => t.id !== updatedTx.id)
      }
      return sortTransactions(prev.map((t) => (t.id === updatedTx.id ? updatedTx : t)))
    })
    if (updatedTx && typeof updatedTx.id === 'number') {
      transactionCacheRef.current.set(updatedTx.id, updatedTx)
    }
    onStatsRefresh()
    fetchData()
  }

  // REVERTED & CLEAN PINNING: Optimistic local state update + Framer Motion Shared Layout flight motion
  const handleTogglePin = (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSwipedRowId(null)

    const targetTx = allFilteredTransactions.find((t) => t.id === id) || data.find((t) => t.id === id)
    const isCurrentlyPinned = targetTx?.is_pinned === 1

    setData((prev) =>
      sortTransactions(
        prev.map((t) => (t.id === id ? { ...t, is_pinned: t.is_pinned === 1 ? 0 : 1 } : t))
      )
    )
    setAllFilteredTransactions((prev) =>
      sortTransactions(
        prev.map((t) => (t.id === id ? { ...t, is_pinned: t.is_pinned === 1 ? 0 : 1 } : t))
      )
    )

    if (window.electronAPI?.togglePin) {
      window.electronAPI.togglePin(id).then(() => onStatsRefresh())
      if (!isCurrentlyPinned && page !== 1) {
        setPage(1)
      }
    }
  }

  // Trigger Delete confirmation modal
  const handleOpenDeleteConfirm = (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSwipedRowId(null)
    setPendingDeleteId(id)
  }

  // OPTIMISTIC UI: Execute Delete with Red exit animation & dynamic page backfilling
  const handleConfirmDelete = () => {
    if (!canDeleteItems) {
      alert('عفواً، لا تملك صلاحية حذف العناصر والعمليات')
      setPendingDeleteId(null)
      return
    }

    if (pendingDeleteId === null) return
    const targetId = pendingDeleteId
    setPendingDeleteId(null)
    setDeletingId(targetId)

    const targetTx = allFilteredTransactions.find((t) => t.id === targetId) || data.find((t) => t.id === targetId)
    if (targetTx) {
      playDeleteSound()
      logUserAction(
        'DELETE',
        'سلة المهملات والأرشيف',
        'نقل معاملة لسلة المهملات',
        `جهة: ${targetTx.client_name} | قيمة: ${formatCurrency(targetTx.amount_cents)}`
      )
      onDeleteRow?.(targetTx)
    }

    setTimeout(async () => {
      setData((prev) => prev.filter((item) => item.id !== targetId))
      setAllFilteredTransactions((prev) => prev.filter((item) => item.id !== targetId))
      const newTotal = Math.max(0, total - 1)
      setTotal(newTotal)
      setDeletingId(null)

      const newTotalPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE))
      if (page > newTotalPages) {
        setPage(newTotalPages)
      }

      if (window.electronAPI?.deleteTransaction) {
        await window.electronAPI.deleteTransaction(targetId)
        onStatsRefresh()
        fetchData()
      }
    }, 350)
  }

  // OPTIMISTIC UI: Execute Archive with Gray exit animation & dynamic page backfilling
  const handleArchive = (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSwipedRowId(null)
    setArchivingId(id)

    const targetTx = allFilteredTransactions.find((t) => t.id === id) || data.find((t) => t.id === id)
    if (targetTx) {
      playDeleteSound()
      logUserAction(
        'ARCHIVE',
        'سلة المهملات والأرشيف',
        'أرشفة معاملة مالية',
        `جهة: ${targetTx.client_name} | قيمة: ${formatCurrency(targetTx.amount_cents)}`
      )
      onArchiveRow?.({ ...targetTx, is_archived: 1 })
    }

    setTimeout(async () => {
      setData((prev) => prev.filter((item) => item.id !== id))
      setAllFilteredTransactions((prev) => prev.filter((item) => item.id !== id))
      const newTotal = Math.max(0, total - 1)
      setTotal(newTotal)
      setArchivingId(null)

      const newTotalPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE))
      if (page > newTotalPages) {
        setPage(newTotalPages)
      }

      if (window.electronAPI?.archiveTransaction) {
        await window.electronAPI.archiveTransaction(id)
        onStatsRefresh()
        fetchData()
      }
    }, 350)
  }

  // NEW TRANSACTION CREATION: Resets to Page 1 and triggers ultra-fast 140ms camera strobe flash
  const handleCreate = async (payload: TransactionCreate) => {
    initMockElectronAPI()
    if (payload.type === 'DEPOSIT') playDepositSound()
    else if (payload.type === 'WITHDRAWAL') playWithdrawalSound()

    logUserAction(
      payload.type,
      'مالية',
      payload.type === 'DEPOSIT' ? 'تسجيل عملية إيداع جديدة' : 'تسجيل عملية سحب جديدة',
      `جهة: ${payload.client_name} | قيمة: ${formatCurrency(payload.amount_cents)} | طريقة الدفع: ${payload.payment_method}`
    )
    const createPayload: TransactionCreate = {
      ...payload,
      wallet_type: activeWallet || 'LYD',
      created_at: payload.created_at || getLocalDeviceISOString(),
    }
    if (window.electronAPI?.createTransaction) {
      const newTx = await window.electronAPI.createTransaction(createPayload)
      if ((newTx as any)?.error) {
        throw new Error((newTx as any).error)
      }
      setPage(1)
      await fetchData()
      onStatsRefresh()

      if (newTx && newTx.id) {
        setNewlyCreatedId(newTx.id)
        setTimeout(() => setNewlyCreatedId(null), 140)
        setSelectedReceipt(newTx)
        setReceiptOpen(true)
      }
    }
  }

  const openDeposit = () => { setModalMode('DEPOSIT'); setModalOpen(true) }
  const openWithdrawal = () => { setModalMode('WITHDRAWAL'); setModalOpen(true) }

  // Global Keyboard Shortcuts (Ctrl+ / Cmd+ for Deposit, Ctrl- / Cmd- for Withdrawal)
  useKeyboardShortcuts({
    onOpenDeposit: openDeposit,
    onOpenWithdrawal: openWithdrawal,
  })

  // Custom Report Modal State
  const [reportModalOpen, setReportModalOpen] = useState(false)

  // Direct printable receipt state (for printer icon button direct print without preview modal)
  const [directPrintReceipt, setDirectPrintReceipt] = useState<Transaction | null>(null)

  const handleViewReceipt = (tx: Transaction) => {
    setSelectedReceipt(tx)
    setReceiptOpen(true)
  }

  const handlePrintReceipt = (tx: Transaction) => {
    logUserAction(
      'PRINT_RECEIPT',
      'تقارير وطباعة',
      'طباعة إيصال استلام/صرف',
      `إيصال جهة: ${tx.client_name} | مبلغ: ${formatCurrency(tx.amount_cents)}`
    )
    setDirectPrintReceipt(tx)
    setTimeout(() => {
      window.print()
    }, 50)
  }

  // Edit Transaction Notes State & Handler
  const [editingNotesTx, setEditingNotesTx] = useState<Transaction | null>(null)
  const [editingNotesText, setEditingNotesText] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const handleOpenEditNotes = (tx: Transaction, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditingNotesTx(tx)
    setEditingNotesText(tx.notes || '')
  }

  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingNotesTx) return
    const newNotes = editingNotesText.trim()
    setSavingNotes(true)
    try {
      if (window.electronAPI?.updateTransactionNotes) {
        await window.electronAPI.updateTransactionNotes({ id: editingNotesTx.id, notes: newNotes })
      }
      setData((prev) => prev.map((t) => (t.id === editingNotesTx.id ? { ...t, notes: newNotes } : t)))
      setAllFilteredTransactions((prev) => prev.map((t) => (t.id === editingNotesTx.id ? { ...t, notes: newNotes } : t)))
      const cached = transactionCacheRef.current.get(editingNotesTx.id)
      if (cached) {
        transactionCacheRef.current.set(editingNotesTx.id, { ...cached, notes: newNotes })
      }
      logUserAction('EDIT_TRANSACTION', 'مالية', 'تعديل سبب/ملاحظات المعاملة', `جهة: ${editingNotesTx.client_name} | ملاحظة جديدة: ${newNotes}`)
      setEditingNotesTx(null)
    } catch (err) {
      console.error('Failed to update notes:', err)
    } finally {
      setSavingNotes(false)
    }
  }

  // Multi-Row Selection & Bulk Actions State
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  const handleToggleRowSelect = (id: number) => {
    playClickSound()
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleToggleSelectAll = () => {
    playClickSound()
    const visibleIds = data.map((t) => t.id)
    const isAllVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id))
    if (isAllVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
    }
  }

  const handleSelectAllPages = () => {
    playClickSound()
    const allIds = allFilteredTransactions.map((t) => t.id)
    setSelectedIds(allIds)
  }

  const handleClearSelection = () => {
    playClickSound()
    setSelectedIds([])
  }

  // Available Entities list for TransactionModal dropdown (combining custom Treasury entities + transactions + system entities)
  const availableEntities = useMemo(() => {
    let custom: string[] = []
    const key = activeWallet ? `salla_${activeWallet}_treasury_custom_entities` : 'salla_treasury_custom_entities'
    try {
      let saved = localStorage.getItem(key)
      if (!saved && activeWallet === 'LYD') {
        saved = localStorage.getItem('salla_treasury_custom_entities')
      }
      if (saved) custom = JSON.parse(saved)
    } catch {
      custom = []
    }

    const txEntities = allFilteredTransactions.map((t) => t.client_name?.trim()).filter(Boolean) as string[]
    const combined = Array.from(new Set([...custom, ...txEntities])).filter(Boolean)
    return combined.sort((a, b) => a.localeCompare(b, 'ar'))
  }, [allFilteredTransactions, activeWallet])

  // Multi-page comprehensive report transactions list
  const reportTransactions = useMemo(() => {
    if (selectedIds.length > 0) {
      const list: Transaction[] = []
      const foundIds = new Set<number>()

      // 1. Match from allFilteredTransactions
      allFilteredTransactions.forEach((tx) => {
        if (selectedIds.includes(tx.id)) {
          list.push(tx)
          foundIds.add(tx.id)
        }
      })

      // 2. Fallback to cache for any selected IDs from different filter states
      selectedIds.forEach((id) => {
        if (!foundIds.has(id)) {
          const cached = transactionCacheRef.current.get(id)
          if (cached) {
            list.push(cached)
            foundIds.add(id)
          }
        }
      })

      return list
    }

    // When NO items are selected: print all transactions matching filters across all pages!
    return allFilteredTransactions.length > 0 ? allFilteredTransactions : data
  }, [selectedIds, allFilteredTransactions, data])

  const handleBulkArchive = async () => {
    if (selectedIds.length === 0) return
    const idsToArchive = [...selectedIds]
    setSelectedIds([])

    idsToArchive.forEach((id) => {
      const targetTx = allFilteredTransactions.find((t) => t.id === id) || transactionCacheRef.current.get(id)
      if (targetTx) onArchiveRow?.(targetTx)
    })

    if (window.electronAPI?.archiveTransactionsBatch) {
      await window.electronAPI.archiveTransactionsBatch(idsToArchive)
    } else if (window.electronAPI?.archiveTransaction) {
      for (const id of idsToArchive) {
        await window.electronAPI.archiveTransaction(id)
      }
    }
    onStatsRefresh()
    fetchData()
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`هل أنت تأكد من نقل ${selectedIds.length} عنصر إلى سلة المحذوفات؟`)) return

    const idsToDelete = [...selectedIds]
    setSelectedIds([])

    idsToDelete.forEach((id) => {
      const targetTx = allFilteredTransactions.find((t) => t.id === id) || transactionCacheRef.current.get(id)
      if (targetTx) onDeleteRow?.(targetTx)
    })

    if (window.electronAPI?.deleteTransactionsBatch) {
      await window.electronAPI.deleteTransactionsBatch(idsToDelete, false)
    } else if (window.electronAPI?.deleteTransaction) {
      for (const id of idsToDelete) {
        await window.electronAPI.deleteTransaction(id, false)
      }
    }
    onStatsRefresh()
    fetchData()
  }

  return (
    <>
      <div className="space-y-4" dir="rtl" ref={tableRef}>
        {/* Top Toolbar: Filters & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Right/Start filter tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => { setActiveTab('all'); setTypeFilter('ALL') }}
              className={`px-3 py-1.5 rounded-lg text-xs font-arabic transition-all whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/80 font-medium'
              }`}
            >
              جميع العمليات
            </button>

            <button
              onClick={() => { setActiveTab('deposits'); setTypeFilter('DEPOSIT') }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-arabic transition-all whitespace-nowrap ${
                activeTab === 'deposits'
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 font-bold'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/80 font-medium'
              }`}
            >
              <span>الإيداعات النقدية</span>
            </button>

            <button
              onClick={() => { setActiveTab('withdrawals'); setTypeFilter('WITHDRAWAL') }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-arabic transition-all whitespace-nowrap ${
                activeTab === 'withdrawals'
                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-300 font-bold'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/80 font-medium'
              }`}
            >
              <span>السحوبات النقدية</span>
            </button>
          </div>

          {/* Left/End action buttons */}
          <div className="flex items-center gap-2">
            <Button
              id="dashboard-funnel-filter-btn"
              variant={activeFilterCount > 0 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsFilterModalOpen(true)}
              className={`h-8 gap-1.5 text-xs font-arabic font-semibold shadow-xs transition-all cursor-pointer ${
                activeFilterCount > 0
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600'
                  : 'text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>تصفية وفلترة</span>
              {activeFilterCount > 0 && (
                <span className="flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-white text-emerald-800 ar-num mr-0.5">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            <Button
              id="toggle-selection-btn"
              variant={isSelectionMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setIsSelectionMode((prev) => !prev)
                setSelectedIds([])
              }}
              className={`h-8 gap-1.5 text-xs font-arabic font-medium shadow-xs ${
                isSelectionMode
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                  : 'text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{isSelectionMode ? 'إلغاء التحديد' : 'تحديد الصفوف'}</span>
            </Button>

            <Button
              id="print-report-btn"
              variant="outline"
              size="sm"
              onClick={() => setReportModalOpen(true)}
              className="h-8 gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-arabic font-medium shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>
                {selectedIds.length > 0
                  ? `طباعة المحدد (${selectedIds.length})`
                  : 'طباعة تقرير'}
              </span>
            </Button>

            <Button
              id="export-csv-btn"
              variant="outline"
              size="sm"
              onClick={() => {
                const itemsToExport = selectedIds.length > 0 ? reportTransactions : allFilteredTransactions
                logUserAction('EXPORT_CSV', 'تقارير وطباعة', 'تصدير معاملات CSV من جدول المعاملات', `عدد السجلات: ${itemsToExport.length}`)
                exportTransactionsToCsv(itemsToExport)
              }}
              className="h-8 gap-1.5 text-xs text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 font-arabic font-medium shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير CSV</span>
            </Button>

            {canEditData && (
              <>
                <Button
                  id="add-deposit-btn"
                  size="sm"
                  onClick={openDeposit}
                  className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-arabic font-semibold shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إيداع جديد</span>
                </Button>

                <Button
                  id="add-withdrawal-btn"
                  size="sm"
                  onClick={openWithdrawal}
                  className="h-8 gap-1.5 text-xs bg-rose-600 hover:bg-rose-500 text-white font-arabic font-semibold shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>سحب جديد</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Floating Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border border-zinc-800 dark:border-zinc-200 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200 font-arabic">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 dark:text-emerald-700 border border-emerald-500/40 ar-num">
                تم تحديد {selectedIds.length} من أصل {total} معاملة
              </span>
              {selectedIds.length < total ? (
                <button
                  type="button"
                  onClick={handleSelectAllPages}
                  className="text-xs text-emerald-400 dark:text-emerald-700 underline font-semibold hover:text-emerald-300 dark:hover:text-emerald-800 cursor-pointer"
                >
                  تحديد كافة المعاملات ({total}) عبر جميع الصفحات
                </button>
              ) : (
                <span className="text-zinc-400 dark:text-zinc-600 font-medium">
                  (تم تحديد الكل عبر كافة الصفحات)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="h-7 px-3 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة المحدد ({selectedIds.length})</span>
              </Button>

              <Button
                size="sm"
                type="button"
                onClick={handleBulkArchive}
                className="h-7 px-3 gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-200 dark:hover:bg-zinc-300 text-zinc-100 dark:text-zinc-900 font-bold rounded-lg transition-all cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5 text-amber-400 dark:text-amber-600" />
                <span>أرشفة المحدد</span>
              </Button>

              {canDeleteItems && (
                <Button
                  size="sm"
                  type="button"
                  onClick={handleBulkDelete}
                  className="h-7 px-3 gap-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف المحدد</span>
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={handleClearSelection}
                className="h-7 px-2.5 text-xs text-zinc-400 hover:text-zinc-200 dark:text-zinc-600 dark:hover:text-zinc-800 cursor-pointer"
              >
                إلغاء التحديد
              </Button>
            </div>
          </div>
        )}

        {/* Table Container */}
        <Card className="subtle-card rounded-xl p-0 shadow-none border border-zinc-200/80 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900/90 transition-colors">
          <CardContent className="p-0">
            {isSelectionMode && data.length > 0 && data.every((t) => selectedIds.includes(t.id)) && total > data.length && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800/50 px-4 py-2 text-center text-xs font-arabic text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-2">
                {selectedIds.length >= total ? (
                  <>
                    <span>تم تحديد جميع المعاملات ({total}) في كافة الصفحات ({totalPages} صفحات).</span>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="font-bold underline text-emerald-900 dark:text-emerald-200 hover:text-emerald-700 cursor-pointer"
                    >
                      إلغاء تحديد الكل
                    </button>
                  </>
                ) : (
                  <>
                    <span>تم تحديد جميع المعاملات في هذه الصفحة ({data.length}).</span>
                    <button
                      type="button"
                      onClick={handleSelectAllPages}
                      className="font-bold underline text-emerald-900 dark:text-emerald-200 hover:text-emerald-700 cursor-pointer"
                    >
                      تحديد جميع المعاملات ({total}) في كافة الصفحات ({totalPages} صفحات)
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="overflow-x-auto">
              <Table dir="rtl" className="w-full border-collapse">
                <TableHeader>
                  <TableRow className="flex items-center w-full px-4 py-3 bg-zinc-50/80 dark:bg-zinc-800/80 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/80 border-b border-zinc-200/80 dark:border-zinc-800 font-arabic text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    {isSelectionMode && (
                      <TableHead className="w-8 text-center p-0 flex items-center justify-center shrink-0 ml-2">
                        <input
                          type="checkbox"
                          checked={
                            (data.length > 0 && data.every((t) => selectedIds.includes(t.id))) ||
                            (allFilteredTransactions.length > 0 && selectedIds.length === allFilteredTransactions.length)
                          }
                          ref={(el) => {
                            if (el) {
                              const hasSomeVisible = data.some((t) => selectedIds.includes(t.id))
                              const hasAllVisible = data.length > 0 && data.every((t) => selectedIds.includes(t.id))
                              el.indeterminate = hasSomeVisible && !hasAllVisible
                            }
                          }}
                          onChange={handleToggleSelectAll}
                          className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          title="تحديد الكل"
                        />
                      </TableHead>
                    )}
                    <TableHead className="flex-1 min-w-0 text-right p-0 font-bold">
                      اسم الجهة
                    </TableHead>
                    <TableHead className="w-28 text-center p-0 font-bold shrink-0">
                      نوع العملية
                    </TableHead>
                    <TableHead className="w-28 text-center p-0 font-bold shrink-0">
                      اسلوب الدفع
                    </TableHead>
                    <TableHead className="w-44 text-right p-0 font-bold shrink-0">
                      سبب المعاملة / الملاحظات
                    </TableHead>
                    <TableHead className="w-36 text-right p-0 font-bold shrink-0">
                      القيمة
                    </TableHead>
                    <TableHead className="w-44 text-right p-0 font-bold shrink-0">
                      التاريخ
                    </TableHead>
                    <TableHead className="w-24 text-center p-0 font-bold shrink-0">
                      الإجراء
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody key={`page-body-${page}`} className="relative">
                  {loading ? (
                    Array.from({ length: PAGE_SIZE }).map((_, i) => (
                      <TableRow key={i} className="border-b border-zinc-200/40 dark:border-zinc-800/40">
                        <TableCell colSpan={isSelectionMode ? 8 : 7} className="py-3 px-4">
                          <div className="h-4 w-full bg-zinc-200/50 dark:bg-zinc-800/50 rounded animate-pulse" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isSelectionMode ? 8 : 7} className="text-center py-12 text-xs text-zinc-400 dark:text-zinc-500 font-arabic font-medium">
                        لا توجد معاملات مسجلة
                      </TableCell>
                    </TableRow>
                  ) : (
                    <LayoutGroup id="transactions-table">
                      <AnimatePresence mode="popLayout" initial={false}>
                        {data.map((tx) => {
                          const isDeposit = tx.type === 'DEPOSIT'
                          const isPinned = tx.is_pinned === 1
                          const isSwiped = swipedRowId === tx.id
                          const isDeleting = deletingId === tx.id
                          const isArchiving = archivingId === tx.id
                          const isNewlyCreated = newlyCreatedId === tx.id

                          return (
                            <motion.tr
                              layout="position"
                              layoutId={`tx-row-${tx.id}`}
                              key={tx.id}
                              initial={{ opacity: 0, y: 15, scale: 0.95 }}
                              animate={
                                isDeleting || isArchiving
                                  ? { opacity: 0, x: -250, scale: 0.95 }
                                  : { opacity: 1, y: 0, scale: 1 }
                              }
                              exit={{ opacity: 0, y: 15, scale: 0.95 }}
                              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                              onDoubleClick={() => handleRowDoubleClick(tx.id)}
                              className={`relative border-b border-zinc-200/60 dark:border-zinc-800/60 group cursor-pointer select-none overflow-hidden transition-colors ${
                                isNewlyCreated
                                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white font-extrabold shadow-[0_0_30px_rgba(255,255,255,1)] ring-2 ring-zinc-900 dark:ring-zinc-100'
                                  : isDeleting
                                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-medium'
                                  : isArchiving
                                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 font-medium'
                                  : isPinned
                                  ? 'bg-zinc-100/90 dark:bg-zinc-800/90 font-semibold border-r-4 border-r-zinc-900 dark:border-r-zinc-100 shadow-sm'
                                  : isSwiped
                                  ? 'bg-zinc-50 dark:bg-zinc-800/70'
                                  : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/60 bg-white dark:bg-zinc-900'
                              }`}
                            >
                              <TableCell colSpan={isSelectionMode ? 7 : 6} className="p-0 border-none relative">
                                {/* Underlying Revealed Action Bar */}
                                <AnimatePresence>
                                  {isSwiped && !isDeleting && !isArchiving && (
                                    <motion.div
                                      initial={{ opacity: 0, x: -20 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      exit={{ opacity: 0, x: -20 }}
                                      transition={{ duration: 0.2 }}
                                      className="absolute left-0 inset-y-0 flex items-stretch gap-0 z-10 h-full overflow-hidden"
                                    >
                                      {/* Edit Button */}
                                      {canEditData && (
                                        <button
                                          onClick={(e) => handleOpenEditModal(tx, e)}
                                          title="تعديل المعاملة (المبلغ، التاريخ، الجهة...)"
                                          className="w-12 h-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors active:opacity-90"
                                        >
                                          <Edit3 className="w-4 h-4" />
                                        </button>
                                      )}

                                      {/* Pin Button */}
                                      <button
                                        onClick={(e) => handleTogglePin(tx.id, e)}
                                        title={isPinned ? 'إلغاء التثبيت' : 'تثبيت في الأعلى'}
                                        className={`w-12 h-full text-white flex items-center justify-center transition-colors active:opacity-90 ${
                                          isPinned ? 'bg-amber-600 hover:bg-amber-700' : 'bg-zinc-800 hover:bg-zinc-900'
                                        }`}
                                      >
                                        <Pin className="w-4 h-4" />
                                      </button>

                                      {/* Archive Button */}
                                      <button
                                        onClick={(e) => handleArchive(tx.id, e)}
                                        title="أرشفة المعاملة"
                                        className="w-12 h-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-colors active:opacity-90"
                                      >
                                        <Archive className="w-4 h-4" />
                                      </button>

                                      {/* Delete Button */}
                                      {canDeleteItems && (
                                        <button
                                          onClick={(e) => handleOpenDeleteConfirm(tx.id, e)}
                                          title="حذف المعاملة"
                                          className="w-12 h-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors active:opacity-90"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      )}
                                    </motion.div>
                                  )}
                                </AnimatePresence>

                                {/* Sliding Row Content Layer */}
                                <motion.div
                                  animate={{
                                    x: isDeleting || isArchiving
                                      ? -250
                                      : isSwiped
                                      ? ((canEditData ? 1 : 0) + 2 + (canDeleteItems ? 1 : 0)) * 48
                                      : 0,
                                    opacity: isDeleting || isArchiving ? 0 : 1,
                                  }}
                                  transition={{
                                    x: { type: 'spring', stiffness: 320, damping: 28 },
                                  }}
                                  className="flex items-center w-full px-4 py-3 bg-inherit"
                                >
                                  {/* Selection Checkbox */}
                                  {isSelectionMode && (
                                    <div className="w-8 text-center flex items-center justify-center shrink-0 ml-2">
                                      <input
                                        type="checkbox"
                                        checked={selectedIds.includes(tx.id)}
                                        onChange={(e) => {
                                          e.stopPropagation()
                                          handleToggleRowSelect(tx.id)
                                        }}
                                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                      />
                                    </div>
                                  )}

                                  {/* 1. اسم الجهة */}
                                  <div className="flex-1 min-w-0 text-right font-arabic flex items-center gap-1.5">
                                    {isPinned && (
                                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 shadow-xs shrink-0" title="مثبتة في الأعلى">
                                        <Pin className="w-3 h-3 fill-current" />
                                      </span>
                                    )}
                                    <div className="flex flex-col min-w-0">
                                      <span className={`text-xs truncate ${isNewlyCreated ? 'text-zinc-950 dark:text-white font-extrabold' : isPinned ? 'font-bold text-zinc-900 dark:text-white' : 'font-semibold text-zinc-900 dark:text-zinc-100'}`}>
                                        {tx.client_name}
                                      </span>
                                      {tx.subtype === 'PERSON' && (
                                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium truncate">
                                          {isDeposit
                                            ? `بواسطة المودِع: ${tx.person_name || 'شخص'}`
                                            : `فاتورة: ${tx.person_name || 'سحب تفصيلي'}${tx.items && tx.items.length > 0 ? ` (${tx.items.length} عناصر)` : ''}`
                                          }
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* 2. نوع العملية */}
                                  <div className="w-28 text-center shrink-0">
                                    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full border text-[10px] sm:text-[11px] font-bold font-arabic ${
                                      isNewlyCreated
                                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                                        : isDeposit
                                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                        : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                    }`}>
                                      {tx.subtype === 'PERSON'
                                        ? isDeposit ? 'إيداع من شخص' : 'سحب تفصيلي'
                                        : isDeposit ? 'إيداع' : 'سحب'
                                      }
                                    </span>
                                  </div>

                                  {/* 3. اسلوب الدفع */}
                                  <div className="w-28 text-center shrink-0">
                                    <span className={`inline-block px-2.5 py-0.5 rounded-md border text-[11px] font-medium font-arabic ${
                                      isNewlyCreated
                                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200/70 dark:border-zinc-700'
                                    }`}>
                                      {tx.payment_method || 'نقداً'}
                                    </span>
                                  </div>

                                  {/* 4. سبب المعاملة / الملاحظات */}
                                  <div className="w-44 text-right font-arabic shrink-0">
                                    <button
                                      type="button"
                                      onClick={(e) => handleOpenEditNotes(tx, e)}
                                      className="inline-flex items-center gap-1.5 max-w-full text-right text-xs rounded-lg px-2 py-1 transition-all border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 group/note"
                                      title="اضغط لتعديل سبب/ملاحظات المعاملة"
                                    >
                                      <FileText className="w-3.5 h-3.5 text-zinc-400 group-hover/note:text-emerald-500 shrink-0" />
                                      <span className="truncate max-w-[130px]">
                                        {tx.notes?.trim() ? (
                                          tx.notes.trim()
                                        ) : (
                                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">+ إضافة سبب</span>
                                        )}
                                      </span>
                                    </button>
                                  </div>

                                  {/* 5. القيمة */}
                                  <div className="w-36 text-right font-arabic ar-num shrink-0">
                                    <span className={`text-xs font-semibold ${
                                      isNewlyCreated ? 'text-zinc-950 dark:text-white font-extrabold' : isDeposit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                    }`}>
                                      {isDeposit ? '+' : '-'}{formatCurrency(tx.amount_cents)}
                                    </span>
                                  </div>

                                  {/* 6. التاريخ */}
                                  <div className={`w-44 text-right font-arabic ar-num text-xs shrink-0 ${isNewlyCreated ? 'text-zinc-800 dark:text-zinc-200 font-bold' : 'text-zinc-500 dark:text-zinc-400'}`} dir="ltr">
                                    {formatDate(tx.created_at)}
                                  </div>

                                  {/* 7. الإجراء */}
                                  <div className="w-24 text-center flex items-center justify-center gap-1 shrink-0">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleViewReceipt(tx) }}
                                      className="p-1.5 rounded-md transition-colors border border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700"
                                      title="عرض الإيصال"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>

                                    {hasPermission('export_reports') && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handlePrintReceipt(tx) }}
                                        className="p-1.5 rounded-md transition-colors border border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700"
                                        title="طباعة الإيصال"
                                      >
                                        <Printer className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </motion.div>
                              </TableCell>
                            </motion.tr>
                          )
                        })}
                      </AnimatePresence>
                    </LayoutGroup>
                  )}

                  {/* Fixed 8-row empty slot placeholders */}
                  {!loading && data.length > 0 && data.length < PAGE_SIZE &&
                    Array.from({ length: PAGE_SIZE - data.length }).map((_, i) => (
                      <TableRow
                        key={`empty-slot-${i}`}
                        className="h-[53px] bg-zinc-50/40 dark:bg-zinc-900/30 border-b border-zinc-100/70 dark:border-zinc-800/50 pointer-events-none select-none"
                      >
                        <TableCell colSpan={isSelectionMode ? 7 : 6} className="p-0 border-none">
                          <div className="flex items-center w-full px-4 py-3 text-transparent font-arabic text-xs">
                            &nbsp;
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Footer */}
            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 border-t border-zinc-200/80 dark:border-zinc-800 font-arabic">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 ar-num">
                عرض {data.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0} إلى{' '}
                {Math.min(page * PAGE_SIZE, total)} من إجمالي {total} معاملة
              </span>

              <div className="relative h-8 flex items-center justify-end">
                <AnimatePresence mode="wait">
                  {!isSliderMode ? (
                    <motion.div
                      key="standard-pagination-controls"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-1"
                    >
                      <Button
                        id="prev-page-btn"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>

                      {/* Double-click page indicator */}
                      <span
                        onDoubleClick={() => setIsSliderMode(true)}
                        title="انقر مرتين لتفعيل شريط التمرير الصوتي"
                        className="text-xs font-semibold px-2.5 py-1 rounded-md text-zinc-800 dark:text-zinc-200 ar-num hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer select-none transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
                      >
                        {page} / {totalPages}
                      </span>

                      <Button
                        id="next-page-btn"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages || loading}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="audio-scrub-slider"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      onDoubleClick={() => setIsSliderMode(false)}
                      title="انقر مرتين للعودة إلى التنقل العادي"
                      className="relative flex items-center w-52 h-8 px-2.5 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer select-none group"
                    >
                      {/* Badge showing "صفحة X من Y" */}
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[10px] font-bold font-arabic shadow-md pointer-events-none whitespace-nowrap ar-num">
                        صفحة {page} من {totalPages}
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-zinc-900 dark:border-t-zinc-100" />
                      </div>

                      {/* Range Scrub Bar */}
                      <div className="w-full flex items-center gap-2">
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 ar-num">1</span>
                        <input
                          type="range"
                          min={1}
                          max={totalPages}
                          step={1}
                          value={page}
                          onChange={(e) => setPage(Number(e.target.value))}
                          className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100 focus:outline-none"
                        />
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 ar-num">{totalPages}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction creation modal */}
      <TransactionModal
        open={modalOpen}
        mode={modalMode}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        entities={availableEntities}
      />

      {/* Edit Transaction Modal */}
      <EditTransactionModal
        open={editingTransaction !== null}
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSuccess={handleEditSuccess}
        entities={availableEntities}
      />

      {/* Direct print element (prints immediately without modal) */}
      <PrintReceipt transaction={directPrintReceipt} isPreview={false} />

      {/* Receipt viewing modal */}
      <ReceiptModal
        transaction={selectedReceipt}
        open={receiptOpen}
        onClose={() => setSelectedReceipt(null)}
      />

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        open={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Interactive Report Customization & Live Preview Modal */}
      <TransactionsReportModal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        transactions={reportTransactions}
        stats={null}
        dateFilter={dateFilter}
      />

      {/* Advanced Funnel Filter Modal */}
      <DashboardFilterModal
        open={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filterState={dashboardFilter}
        onApplyFilter={(newFilter) => setDashboardFilter(newFilter)}
        onResetFilter={() => setDashboardFilter(defaultDashboardFilter)}
      />

      {/* Edit / Add Notes Modal for Existing & New Transactions */}
      <Dialog open={editingNotesTx !== null} onOpenChange={(open) => !open && setEditingNotesTx(null)}>
        <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-arabic p-5 rounded-2xl shadow-xl" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-sm font-extrabold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <Edit3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>تعديل سبب / ملاحظات المعاملة</span>
            </DialogTitle>
            {editingNotesTx && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                جهة المعاملة: <span className="font-bold text-zinc-800 dark:text-zinc-200">{editingNotesTx.client_name}</span> | المبلغ: <span className="font-bold text-emerald-600 dark:text-emerald-400 ar-num">{formatCurrency(editingNotesTx.amount_cents)}</span>
              </p>
            )}
          </DialogHeader>

          <form onSubmit={handleSaveNotes} className="space-y-4 mt-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-notes-input" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block text-right">
                سبب الإيداع/السحب (الملاحظات)
              </Label>
              <Input
                id="edit-notes-input"
                type="text"
                placeholder="أدخل سبب المعاملة أو أي ملاحظة إضافية..."
                value={editingNotesText}
                onChange={(e) => setEditingNotesText(e.target.value)}
                className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 rounded-lg font-arabic text-right"
                autoFocus
                autoComplete="off"
              />
            </div>

            <DialogFooter className="flex-row-reverse gap-2 mt-5">
              <Button
                type="submit"
                disabled={savingNotes}
                className="flex-1 text-xs font-arabic font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
              >
                {savingNotes && <Loader2 className="w-3.5 h-3.5 animate-spin ml-1.5" />}
                حفظ الملاحظات
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingNotesTx(null)}
                className="flex-1 text-xs bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 font-arabic rounded-lg"
              >
                إلغاء
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
