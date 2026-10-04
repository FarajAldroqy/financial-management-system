import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  Coins, Search, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Wallet,
  Pin, Trash2, Archive, Plus, FileText, Filter, CheckSquare, Edit3, Download,
} from 'lucide-react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { formatCurrency, filterTransactionsByDate } from '@/lib/utils'
import type { Transaction, Stats, DateFilter } from '@/types'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { EntityLedgerModal } from './EntityLedgerModal'
import { EditEntitiesModal } from './EditEntitiesModal'
import {
  TreasuryDrawer, DrawerMode, AdvancedFilterState, defaultAdvancedFilter,
} from './TreasuryDrawer'
import { usePermission } from '@/hooks/usePermission'
import { logUserAction } from '@/lib/auditLogger'
import { playDeleteSound, playClickSound } from '@/lib/soundEffects'
import { initMockElectronAPI } from '@/lib/mockApi'
import { exportEntitiesToCsv } from '@/lib/exportUtils'

import { useWallet, type WalletType } from '@/context/WalletContext'

interface EntityBalance {
  name: string
  depositedCents: number
  withdrawnCents: number
  netCents: number
  transactionCount: number
  isSystemFixed?: boolean
}

interface TreasuryViewProps {
  dateFilter?: DateFilter
  archivedTreasuryRows?: EntityBalance[]
  deletedTreasuryRows?: EntityBalance[]
  onArchiveEntity?: (entity: EntityBalance) => void
  onDeleteEntity?: (entity: EntityBalance) => void
}

export function KryptoniteFishbowl({
  totalAmount = "456,851,795.00",
  currencySymbol = "د.ل",
  onOpenDrawer,
}: {
  totalAmount?: string
  currencySymbol?: string
  onOpenDrawer?: (mode: DrawerMode) => void
}) {
  const { hasPermission } = usePermission()
  const canManageTreasury = hasPermission('manage_treasury')
  const canExportReports = hasPermission('export_reports')

  const [showActions, setShowActions] = useState(false)
  const fishbowlRef = useRef<HTMLDivElement>(null)
  const cleanAmount = totalAmount.replace(/[^\d.,-]/g, "").trim()

  useEffect(() => {
    if (!showActions) return

    const handleClickOutside = (e: MouseEvent) => {
      if (fishbowlRef.current && !fishbowlRef.current.contains(e.target as Node)) {
        setShowActions(false)
      }
    }

    document.addEventListener('pointerdown', handleClickOutside)
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside)
    }
  }, [showActions])

  return (
    <div
      ref={fishbowlRef}
      className="relative flex flex-col items-center justify-center my-6 select-none"
    >
      <motion.div
        onClick={(e) => {
          e.stopPropagation()
          setShowActions((prev) => !prev)
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
        className="relative w-80 h-80 rounded-full border-[5px] border-white/80 shadow-[inset_0_0_35px_rgba(255,255,255,0.7),0_20px_45px_rgba(6,182,212,0.35)] bg-gradient-to-b from-white/40 via-cyan-50/15 to-slate-950/70 backdrop-blur-md overflow-hidden cursor-pointer"
      >
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[75%] h-9 rounded-[100%] border-[3px] border-white/90 bg-gradient-to-b from-white/40 to-transparent shadow-[inset_0_8px_16px_rgba(0,0,0,0.3)] z-30 pointer-events-none" />
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[60%] h-6 rounded-[100%] bg-white/10 blur-[2px] z-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-full h-[55%] bg-gradient-to-b from-cyan-500 via-sky-600 to-slate-950 z-10">
          <div className="absolute -top-6 left-0 w-[200%] h-8 pointer-events-none overflow-hidden">
            <motion.div
              className="flex w-full h-full"
              animate={{ x: ["0%", "-50%"] }}
              transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
            >
              <svg viewBox="0 0 600 60" preserveAspectRatio="none" className="w-1/2 h-full fill-cyan-500">
                <path d="M0 20 Q 150 40 300 20 T 600 20 V 60 H 0 Z" />
              </svg>
              <svg viewBox="0 0 600 60" preserveAspectRatio="none" className="w-1/2 h-full fill-cyan-500">
                <path d="M0 20 Q 150 40 300 20 T 600 20 V 60 H 0 Z" />
              </svg>
            </motion.div>
          </div>
          <div className="absolute -top-5 left-0 w-[200%] h-8 pointer-events-none overflow-hidden opacity-50">
            <motion.div
              className="flex w-full h-full"
              animate={{ x: ["-50%", "0%"] }}
              transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
            >
              <svg viewBox="0 0 600 60" preserveAspectRatio="none" className="w-1/2 h-full fill-cyan-300">
                <path d="M0 20 Q 150 0 300 20 T 600 20 V 60 H 0 Z" />
              </svg>
              <svg viewBox="0 0 600 60" preserveAspectRatio="none" className="w-1/2 h-full fill-cyan-300">
                <path d="M0 20 Q 150 0 300 20 T 600 20 V 60 H 0 Z" />
              </svg>
            </motion.div>
          </div>
          <motion.div
            animate={{ y: [20, -50], opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="absolute bottom-4 left-1/4 w-2 h-2 rounded-full bg-cyan-200/80"
          />
          <motion.div
            animate={{ y: [30, -45], opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 4.5, delay: 1, ease: "easeInOut" }}
            className="absolute bottom-2 right-1/3 w-3 h-3 rounded-full bg-fuchsia-300/70"
          />
        </div>
        <div className="absolute inset-2 rounded-full overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/35 via-indigo-600/20 to-slate-950/90" />
          <div className="absolute -inset-10 border border-cyan-300/30 rounded-full border-dashed pointer-events-none" />
          <div className="absolute inset-4 border border-cyan-300/20 rounded-full pointer-events-none" />
          <div className="absolute top-3 left-6 w-28 h-12 rounded-full bg-white/30 blur-xs -rotate-45 pointer-events-none" />
        </div>
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[52%] inset-x-0 z-30 text-center px-4"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/70 text-cyan-300 border border-cyan-400/40 text-[11px] font-bold mb-2 shadow-inner">
            <Coins className="w-3.5 h-3.5 text-cyan-400" />
            <span>إجمالي رصيد الخزينة</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-white font-extrabold text-2xl sm:text-3xl tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] ar-num">
            <span>{cleanAmount}</span>
            <span className="text-lg font-bold text-cyan-200">{currencySymbol}</span>
          </div>
        </motion.div>
      </motion.div>
      {/* 3 CURVED RADIAL FLOATING ACTION BUTTONS ALONG LEFT BOWL ARC */}
      <AnimatePresence>
        {showActions && (
          <>
            {/* Top Button: Add Entity (top-[18%] -left-11) */}
            {canManageTreasury && (
              <motion.button
                key="btn-add-entity"
                initial={{ opacity: 0, scale: 0.8, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 15 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                onClick={(e) => {
                  e.stopPropagation()
                  setShowActions(false)
                  onOpenDrawer?.('ADD_ENTITY')
                }}
                className="group absolute top-[18%] -left-11 z-40 w-12 h-12 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-2 border-white dark:border-zinc-700 shadow-xl flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition-all"
                title="إضافة جهة جديدة"
              >
                <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                <span className="absolute right-full mr-2.5 px-2.5 py-1 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[11px] font-bold font-arabic whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-md">
                  إضافة جهة
                </span>
              </motion.button>
            )}

            {/* Middle Button: Print Reports (top-[43%] -translate-y-1/2 -left-16) */}
            {canExportReports && (
              <motion.button
                key="btn-print-reports"
                initial={{ opacity: 0, scale: 0.8, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 15 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                onClick={(e) => {
                  e.stopPropagation()
                  setShowActions(false)
                  onOpenDrawer?.('PRINT_REPORT')
                }}
                className="group absolute top-[43%] -translate-y-1/2 -left-16 z-40 w-12 h-12 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-2 border-white dark:border-zinc-700 shadow-xl flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition-all"
                title="طباعة تقارير الخزينة"
              >
                <FileText className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="absolute right-full mr-2.5 px-2.5 py-1 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[11px] font-bold font-arabic whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-md">
                  طباعة تقارير
                </span>
              </motion.button>
            )}

            {/* Bottom Button: Advanced Filter (bottom-[18%] -left-11) */}
            <motion.button
              key="btn-advanced-filter"
              initial={{ opacity: 0, scale: 0.8, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 15 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              onClick={(e) => {
                e.stopPropagation()
                setShowActions(false)
                onOpenDrawer?.('ADVANCED_FILTER')
              }}
              className="group absolute bottom-[18%] -left-11 z-40 w-12 h-12 rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-2 border-white dark:border-zinc-700 shadow-xl flex items-center justify-center cursor-pointer hover:scale-110 active:scale-95 transition-all"
              title="الفلترة المتقدمة"
            >
              <Filter className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              <span className="absolute right-full mr-2.5 px-2.5 py-1 rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[11px] font-bold font-arabic whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-md">
                فلترة متقدمة
              </span>
            </motion.button>
          </>
        )}
      </AnimatePresence>

      {/* ظل الحوض السفلي الـ 3D */}
      <div className="w-52 h-4 bg-cyan-950/25 blur-md rounded-full mt-3" />
    </div>
  );
}

const getCustomEntitiesKey = (wallet: string | null) =>
  `salla_${wallet || 'LYD'}_treasury_custom_entities`

const readStoredCustomEntities = (wallet: string | null): string[] => {
  const key = getCustomEntitiesKey(wallet)
  try {
    let saved = localStorage.getItem(key)
    if (!saved && (!wallet || wallet === 'LYD')) {
      saved = localStorage.getItem('salla_treasury_custom_entities')
      if (saved) {
        localStorage.setItem(key, saved)
      }
    }
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (e) {
    console.error('Failed to parse custom entities from localStorage:', e)
  }
  return []
}

const persistCustomEntities = (wallet: string | null, entities: string[]) => {
  const key = getCustomEntitiesKey(wallet)
  try {
    localStorage.setItem(key, JSON.stringify(entities))
    if (!wallet || wallet === 'LYD') {
      localStorage.setItem('salla_treasury_custom_entities', JSON.stringify(entities))
    }
  } catch (e) {
    console.error('Failed to save custom entities to localStorage:', e)
  }
}

export function TreasuryView({ dateFilter, archivedTreasuryRows = [], deletedTreasuryRows = [], onArchiveEntity, onDeleteEntity }: TreasuryViewProps) {
  const { hasPermission } = usePermission()
  const canManageTreasury = hasPermission('manage_treasury')
  const canDeleteItems = hasPermission('delete_items')

  const { activeWallet, activeWalletMeta } = useWallet()
  const currencySymbol = activeWalletMeta?.symbol || 'د.ل'

  const [stats, setStats] = useState<Stats | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Entity Financial Ledger Modal State
  const [selectedEntityForLedger, setSelectedEntityForLedger] = useState<string | null>(null)
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false)
  const [isEditEntitiesModalOpen, setIsEditEntitiesModalOpen] = useState(false)

  const handleOpenLedger = (name: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSelectedEntityForLedger(name)
    setIsLedgerModalOpen(true)
  }
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [advancedFilter, setAdvancedFilter] = useState<AdvancedFilterState>(defaultAdvancedFilter)

  // Double-click row slide action bar states (identical to Dashboard TransactionsTable)
  const [swipedRowName, setSwipedRowName] = useState<string | null>(null)
  const [pinnedEntities, setPinnedEntities] = useState<string[]>([])
  const [deletingName, setDeletingName] = useState<string | null>(null)
  const [archivingName, setArchivingName] = useState<string | null>(null)
  const [pendingDeleteName, setPendingDeleteName] = useState<string | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  // Multi-Row Selection & Bulk Actions State for Treasury Entities
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false)
  const [selectedEntityNames, setSelectedEntityNames] = useState<string[]>([])

  const handleToggleEntitySelect = (name: string) => {
    playClickSound()
    setSelectedEntityNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  const loadTreasuryData = useCallback(async () => {
    initMockElectronAPI()
    if (!window.electronAPI) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const walletType = activeWallet || 'LYD'
      const [s, txResult] = await Promise.all([
        window.electronAPI.getStats({ wallet_type: walletType }),
        window.electronAPI.getTransactions({ page: 1, pageSize: 1000, status: 'ALL_NON_DELETED', wallet_type: walletType }),
      ])
      setStats(s)
      setTransactions(txResult.data)
    } catch (err) {
      console.error('Failed to load treasury data:', err)
    } finally {
      setLoading(false)
    }
  }, [activeWallet])

  useEffect(() => {
    loadTreasuryData()
  }, [loadTreasuryData])

  // Custom Zero-Value Registered Entities State - Scoped by activeWallet
  // Initialize directly from localStorage to prevent empty-state race conditions on mount
  const [customEntities, setCustomEntities] = useState<string[]>(() => {
    const currentWallet = activeWallet || (sessionStorage.getItem('active_wallet_type') as WalletType) || 'LYD'
    return readStoredCustomEntities(currentWallet)
  })

  // Synchronize custom entities when active wallet changes or rows are restored/permanently deleted
  useEffect(() => {
    if (!activeWallet) return
    const stored = readStoredCustomEntities(activeWallet)
    setCustomEntities(stored)
  }, [activeWallet, deletedTreasuryRows, archivedTreasuryRows])

  // Automatically register any newly loaded transaction entity into customEntities list
  useEffect(() => {
    if (transactions.length > 0) {
      setCustomEntities((prev) => {
        const names = new Set(prev)
        let added = false
        transactions.forEach((t) => {
          const name = t.client_name?.trim()
          if (name && !names.has(name)) {
            names.add(name)
            added = true
          }
        })
        if (added) {
          const updated = Array.from(names)
          persistCustomEntities(activeWallet, updated)
          return updated
        }
        return prev
      })
    }
  }, [transactions, activeWallet])

  // Click-outside and Escape key listener to dismiss swiped row or open drawer
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (swipedRowName !== null && tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setSwipedRowName(null)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (drawerMode !== null) setDrawerMode(null)
        if (swipedRowName !== null) setSwipedRowName(null)
      }
    }

    window.addEventListener('click', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('click', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [swipedRowName, drawerMode])

  // Double-click handler
  const handleRowDoubleClick = (name: string) => {
    setSwipedRowName((prev) => (prev === name ? null : name))
  }

  // Toggle Pin handler
  const handleTogglePin = (name: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSwipedRowName(null)
    setPinnedEntities((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
  }

  // Open Delete Confirm handler
  const handleOpenDeleteConfirm = (name: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSwipedRowName(null)
    setPendingDeleteName(name)
  }

  // Confirm Delete handler: soft delete entity transactions in DB & update UI/Vault
  const handleConfirmDelete = async () => {
    if (!canDeleteItems) {
      alert('عفواً، لا تملك صلاحية حذف العناصر والعمليات')
      setPendingDeleteName(null)
      return
    }
    if (!pendingDeleteName) return
    const targetName = pendingDeleteName
    setPendingDeleteName(null)
    setDeletingName(targetName)

    const targetEntity = entityBalances.find((item) => item.name === targetName)
    if (targetEntity) {
      onDeleteEntity?.(targetEntity)
    }

    if (window.electronAPI?.deleteEntityTransactions) {
      await window.electronAPI.deleteEntityTransactions(targetName, false, activeWallet || 'LYD')
    }

    setCustomEntities((prev) => {
      const updated = prev.filter((n) => n !== targetName)
      persistCustomEntities(activeWallet, updated)
      return updated
    })
    setTransactions((prev) => prev.filter((t) => t.client_name.trim() !== targetName))
    setDeletingName(null)
    await loadTreasuryData()
  }

  // Archive handler: hide row without altering financial totals or Vault balances
  const handleArchive = (name: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSwipedRowName(null)
    setArchivingName(name)

    const targetEntity = entityBalances.find((item) => item.name === name)
    if (targetEntity) {
      onArchiveEntity?.(targetEntity)
    }

    setTimeout(() => {
      setArchivingName(null)
    }, 350)
  }

  // Add Entity Submit Callback (Zero-value entity added to Treasury table only, no Dashboard transactions created)
  const handleAddEntitySuccess = (name: string) => {
    if (!canManageTreasury) {
      alert('عفواً، لا تملك صلاحية الوصول والتعديل على الخزينة')
      return
    }
    const trimmedName = name.trim()
    if (!trimmedName) return

    const alreadyExists = entityBalances.some(
      (e) => e.name.trim().toLowerCase() === trimmedName.toLowerCase()
    )
    if (alreadyExists) {
      alert('هذه الجهة مسجلة سابقاً بالمنظومة، لا يمكن تكرار إضافتها')
      return
    }

    logUserAction('ADD_ENTITY', 'الخزينة والجهات', 'إضافة جهة جديدة بالخزينة', `جهة: ${trimmedName}`)
    setCustomEntities((prev) => {
      const updated = Array.from(new Set([...prev, trimmedName]))
      persistCustomEntities(activeWallet, updated)
      return updated
    })
  }

  // Filter transactions dynamically by dateFilter
  const filteredTransactions = useMemo(() => {
    return filterTransactionsByDate(transactions, dateFilter)
  }, [transactions, dateFilter])

  // Group transactions by entity name (client_name) based on filtered transactions
  const entityBalances = useMemo(() => {
    const map = new Map<string, EntityBalance>()

    // Seed custom registered zero-value entities
    customEntities.forEach((entName) => {
      if (entName && !map.has(entName)) {
        map.set(entName, {
          name: entName,
          depositedCents: 0,
          withdrawnCents: 0,
          netCents: 0,
          transactionCount: 0,
        })
      }
    })

    filteredTransactions.forEach((tx) => {
      const name = tx.client_name.trim() || 'جهة غير معرفة'
      const existing = map.get(name) || {
        name,
        depositedCents: 0,
        withdrawnCents: 0,
        netCents: 0,
        transactionCount: 0,
      }

      if (tx.type === 'DEPOSIT') {
        existing.depositedCents += tx.amount_cents
      } else if (tx.type === 'WITHDRAWAL') {
        existing.withdrawnCents += tx.amount_cents
      }
      existing.netCents = existing.depositedCents - existing.withdrawnCents
      existing.transactionCount += 1

      map.set(name, existing)
    })

    const archivedNamesSet = new Set(archivedTreasuryRows.map((r) => r.name))
    const deletedNamesSet = new Set(deletedTreasuryRows.map((r) => r.name))
    let list = Array.from(map.values()).filter(
      (e) => !archivedNamesSet.has(e.name) && !deletedNamesSet.has(e.name)
    )

    // Apply Advanced Filters (deposit range, withdrawal range, net range)
    const { minDeposit, maxDeposit, minWithdrawal, maxWithdrawal, minNet, maxNet, sortBy, sortOrder } = advancedFilter

    if (minDeposit) {
      const minCents = parseFloat(minDeposit) * 100
      list = list.filter((e) => e.depositedCents >= minCents)
    }
    if (maxDeposit) {
      const maxCents = parseFloat(maxDeposit) * 100
      list = list.filter((e) => e.depositedCents <= maxCents)
    }
    if (minWithdrawal) {
      const minCents = parseFloat(minWithdrawal) * 100
      list = list.filter((e) => e.withdrawnCents >= minCents)
    }
    if (maxWithdrawal) {
      const maxCents = parseFloat(maxWithdrawal) * 100
      list = list.filter((e) => e.withdrawnCents <= maxCents)
    }
    if (minNet) {
      const minCents = parseFloat(minNet) * 100
      list = list.filter((e) => e.netCents >= minCents)
    }
    if (maxNet) {
      const maxCents = parseFloat(maxNet) * 100
      list = list.filter((e) => e.netCents <= maxCents)
    }

    // Multi-Sorting
    list.sort((a, b) => {
      let valA: number | string = a[sortBy]
      let valB: number | string = b[sortBy]

      if (typeof valA === 'string') {
        valA = valA.toLowerCase()
        valB = (valB as string).toLowerCase()
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      } else {
        return sortOrder === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number)
      }
    })

    // Sort pinned entities to top
    return list.sort((a, b) => {
      const pinA = pinnedEntities.includes(a.name) ? 1 : 0
      const pinB = pinnedEntities.includes(b.name) ? 1 : 0
      if (pinA !== pinB) return pinB - pinA
      return 0
    })
  }, [filteredTransactions, pinnedEntities, advancedFilter, customEntities, archivedTreasuryRows, deletedTreasuryRows])

  // Filtered entity balances based on search query
  const filteredEntities = useMemo(() => {
    if (!searchQuery.trim()) return entityBalances
    const q = searchQuery.toLowerCase()
    return entityBalances.filter((e) => e.name.toLowerCase().includes(q))
  }, [entityBalances, searchQuery])

  const handleToggleSelectAllEntities = () => {
    playClickSound()
    const visibleNames = filteredEntities.map((e) => e.name)
    const isAllVisibleSelected = visibleNames.length > 0 && visibleNames.every((n) => selectedEntityNames.includes(n))
    if (isAllVisibleSelected) {
      setSelectedEntityNames((prev) => prev.filter((n) => !visibleNames.includes(n)))
    } else {
      setSelectedEntityNames((prev) => Array.from(new Set([...prev, ...visibleNames])))
    }
  }

  const handleBulkArchiveEntities = async () => {
    if (selectedEntityNames.length === 0) return
    playDeleteSound()
    const namesToArchive = [...selectedEntityNames]
    setSelectedEntityNames([])

    namesToArchive.forEach((name) => {
      const ent = entityBalances.find((e) => e.name === name)
      if (ent) onArchiveEntity?.(ent)
    })
  }

  const handleBulkDeleteEntities = async () => {
    if (selectedEntityNames.length === 0) return
    const namesToDelete = [...selectedEntityNames]
    setSelectedEntityNames([])

    if (namesToDelete.length === 0) return
    if (!confirm(`هل أنت تأكد من نقل ${namesToDelete.length} جهة إلى سلة المحذوفات؟`)) return

    playDeleteSound()
    namesToDelete.forEach((name) => {
      const ent = entityBalances.find((e) => e.name === name)
      if (ent) onDeleteEntity?.(ent)
    })

    if (window.electronAPI?.deleteEntitiesBatch) {
      await window.electronAPI.deleteEntitiesBatch(namesToDelete, false, activeWallet || 'LYD')
    } else if (window.electronAPI?.deleteEntityTransactions) {
      for (const name of namesToDelete) {
        await window.electronAPI.deleteEntityTransactions(name, false, activeWallet || 'LYD')
      }
    }
  }

  // Recalculate totals synchronously if date filter is active, otherwise use global stats
  const { totalDepositsCents, totalWithdrawalsCents, totalBalanceCents } = useMemo(() => {
    if (dateFilter && dateFilter.mode !== 'NONE') {
      let dep = 0
      let withd = 0
      filteredTransactions.forEach((tx) => {
        if (tx.type === 'DEPOSIT') dep += tx.amount_cents
        else if (tx.type === 'WITHDRAWAL') withd += tx.amount_cents
      })
      return {
        totalDepositsCents: dep,
        totalWithdrawalsCents: withd,
        totalBalanceCents: dep - withd,
      }
    }
    return {
      totalDepositsCents: stats?.total_deposits_cents ?? 0,
      totalWithdrawalsCents: stats?.total_withdrawals_cents ?? 0,
      totalBalanceCents: stats?.total_balance_cents ?? 0,
    }
  }, [dateFilter, filteredTransactions, stats])

  return (
    <div className="flex flex-col gap-8 p-6 bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 min-h-full font-arabic transition-colors duration-300" dir="rtl" ref={tableRef}>
      {/* Top Header Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200/80 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 shadow-xs">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">خزينة السيولة والمستحقات</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              متابعة حركة الأصول، السيولة النقدية، وصافي التزامات وحسابات الجهات
            </p>
          </div>
        </div>
      </div>

      {/* CENTERED HERO SECTION: HUGE 3D GLASS VAULT WITH FLOATING ACTION BUTTONS */}
      <div className="flex flex-col items-center justify-center py-2 relative">
        {/* Background Ambient MJS Dual Neon Radial Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] bg-gradient-to-tr from-cyan-500/20 via-fuchsia-500/15 to-transparent rounded-full blur-3xl pointer-events-none" />

        {/* 3D FISHBOWL HERO WIDGET */}
        <KryptoniteFishbowl
          totalAmount={formatCurrency(totalBalanceCents, currencySymbol)}
          currencySymbol={currencySymbol}
          onOpenDrawer={(mode) => setDrawerMode(mode)}
        />

        {/* 3 SUMMARY METRIC CARDS ROW BELOW FISHBOWL */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full mt-4">
          <Card className="subtle-card rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0d1322] p-5 shadow-xs transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">إجمالي المودعات</span>
              <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-900">
                <ArrowDownRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900 dark:text-white ar-num">
                {formatCurrency(totalDepositsCents, currencySymbol)}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-cyan-500" />
              <span>مجموع المبالغ المودعة المسجلة</span>
            </p>
          </Card>

          <Card className="subtle-card rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">إجمالي المسحوبات</span>
              <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-zinc-900 dark:text-white ar-num">
                {formatCurrency(totalWithdrawalsCents, currencySymbol)}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-rose-500" />
              <span>مجموع المبالغ المسحوبة الصادرة</span>
            </p>
          </Card>

          <Card className="subtle-card rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">عدد الجهات الفعالة</span>
              <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-zinc-900 dark:text-white ar-num">
                {entityBalances.length}
              </span>
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">جهة</span>
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
              إجمالي المتعاملين ذوي الأرصدة القائمة
            </p>
          </Card>
        </div>
      </div>

      {/* Bottom Section: Entity Balances Table (جدول المستحقات للجهات) */}
      <Card className="subtle-card rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0 shadow-xs overflow-hidden transition-colors">
        {/* Table Header Controls */}
        <div className="p-4 border-b border-zinc-200/80 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">جدول المستحقات للجهات</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              ملخص إجمالي الإيداعات، السحوبات، وصافي الحساب لكل جهة يتعامل معها النظام
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              id="toggle-treasury-selection-btn"
              variant={isSelectionMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setIsSelectionMode((prev) => !prev)
                setSelectedEntityNames([])
              }}
              className={`h-8 gap-1.5 text-xs font-arabic font-medium shadow-xs ${
                isSelectionMode
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                  : 'text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800/90 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{isSelectionMode ? 'إلغاء التحديد' : 'تحديد الصفوف'}</span>
            </Button>

            <Button
              id="edit-entities-btn"
              variant="outline"
              size="sm"
              onClick={() => setIsEditEntitiesModalOpen(true)}
              className="h-8 gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800/90 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 font-arabic font-medium shadow-xs"
            >
              <Edit3 className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>تعديل الجهات</span>
            </Button>

            <Button
              id="export-entities-csv-btn"
              variant="outline"
              size="sm"
              onClick={() => {
                logUserAction('EXPORT_CSV', 'تقارير وطباعة', 'تصدير جدول الجهات CSV', `عدد الجهات: ${filteredEntities.length}`)
                exportEntitiesToCsv(filteredEntities)
              }}
              className="h-8 gap-1.5 text-xs text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20 hover:bg-cyan-100 dark:hover:bg-cyan-500/20 font-arabic font-medium shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير CSV</span>
            </Button>

            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="البحث باسم الجهة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pr-9 pl-3 text-xs bg-white dark:bg-zinc-800/90 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 rounded-lg focus-visible:ring-1 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-500 font-arabic"
              />
            </div>
          </div>
        </div>

        {/* Floating Bulk Action Bar for Treasury Entities */}
        {selectedEntityNames.length > 0 && (
          <div className="flex items-center justify-between p-3 m-4 mb-0 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border border-slate-800 dark:border-slate-200 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200 font-arabic">
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 dark:text-cyan-700 border border-cyan-500/40 ar-num">
                تم تحديد {selectedEntityNames.length} جهة
              </span>
              <span className="text-slate-400 dark:text-slate-600 font-medium hidden sm:inline">
                يمكنك تنفيذ إجراء جماعي على الجهات المحددة
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                type="button"
                onClick={handleBulkArchiveEntities}
                className="h-7 px-3 gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 dark:bg-slate-200 dark:hover:bg-slate-300 text-slate-100 dark:text-slate-900 font-bold rounded-lg transition-all"
              >
                <Archive className="w-3.5 h-3.5 text-amber-400 dark:text-amber-600" />
                <span>أرشفة المحدد</span>
              </Button>

              {canDeleteItems && (
                <Button
                  size="sm"
                  type="button"
                  onClick={handleBulkDeleteEntities}
                  className="h-7 px-3 gap-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف المحدد</span>
                </Button>
              )}
            </div>
          </div>
        )}

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table dir="rtl">
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800">
                  {isSelectionMode && (
                    <TableHead className="w-12 text-center py-3 font-arabic">
                      <input
                        type="checkbox"
                        checked={filteredEntities.length > 0 && filteredEntities.every((e) => selectedEntityNames.includes(e.name))}
                        onChange={handleToggleSelectAllEntities}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        title="تحديد الكل"
                      />
                    </TableHead>
                  )}
                  <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300 text-right py-3 font-arabic">
                    اسم الجهة
                  </TableHead>
                  <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300 text-center py-3 font-arabic w-32">
                    عدد المعاملات
                  </TableHead>
                  <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300 text-right py-3 font-arabic w-44">
                    إجمالي المودعات
                  </TableHead>
                  <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300 text-right py-3 font-arabic w-44">
                    إجمالي المسحوبات
                  </TableHead>
                  <TableHead className="text-xs font-bold text-zinc-700 dark:text-zinc-300 text-right py-3 font-arabic w-48">
                    صافي الحساب
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="relative">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-b border-zinc-200/40 dark:border-zinc-800/40">
                      <TableCell colSpan={isSelectionMode ? 6 : 5} className="py-3 px-4">
                        <div className="h-4 w-full bg-zinc-200/50 dark:bg-zinc-800/50 rounded animate-pulse" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredEntities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isSelectionMode ? 6 : 5} className="text-center py-12 text-xs text-zinc-400 dark:text-zinc-500 font-arabic font-medium">
                      لا توجد نتائج مطابقة للبحث
                    </TableCell>
                  </TableRow>
                ) : (
                  <LayoutGroup id="treasury-entities-table">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {filteredEntities.map((entity) => {
                        const isPositiveNet = entity.netCents >= 0
                        const isPinned = pinnedEntities.includes(entity.name)
                        const isSwiped = swipedRowName === entity.name
                        const isDeleting = deletingName === entity.name
                        const isArchiving = archivingName === entity.name

                        return (
                          <motion.tr
                            layout="position"
                            layoutId={`treasury-row-${entity.name}`}
                            key={entity.name}
                            initial={{ opacity: 0, y: 15, scale: 0.95 }}
                            animate={
                              isDeleting || isArchiving
                                ? { opacity: 0, x: -250, scale: 0.95 }
                                : { opacity: 1, y: 0, scale: 1 }
                            }
                            exit={{ opacity: 0, y: 15, scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                            onDoubleClick={() => handleRowDoubleClick(entity.name)}
                            className={`relative border-b border-zinc-200/60 dark:border-zinc-800/60 group cursor-pointer select-none overflow-hidden transition-colors ${isDeleting
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
                            <TableCell colSpan={isSelectionMode ? 6 : 5} className="p-0 border-none relative">
                              {/* Underlying Revealed Action Bar (FAR LEFT SIDE) */}
                              <AnimatePresence>
                                {isSwiped && !isDeleting && !isArchiving && (
                                  <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute left-0 inset-y-0 flex items-stretch gap-0 z-10 h-full overflow-hidden"
                                  >
                                    {/* 📊 Ledger Statement Button */}
                                    <button
                                      onClick={(e) => handleOpenLedger(entity.name, e)}
                                      title="عرض كشف الحساب التفصيلي"
                                      className="w-12 h-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors active:opacity-90"
                                    >
                                      <FileText className="w-4 h-4" />
                                    </button>

                                    {/* 📌 Pin Button */}
                                    <button
                                      onClick={(e) => handleTogglePin(entity.name, e)}
                                      title={isPinned ? 'إلغاء التثبيت' : 'تثبيت في الأعلى'}
                                      className={`w-12 h-full text-white flex items-center justify-center transition-colors active:opacity-90 ${
                                        isPinned ? 'bg-amber-600 hover:bg-amber-700' : 'bg-zinc-800 hover:bg-zinc-900'
                                      }`}
                                    >
                                      <Pin className="w-4 h-4 fill-current" />
                                    </button>

                                    {/* 📦 Archive Button */}
                                    <button
                                      onClick={(e) => handleArchive(entity.name, e)}
                                      title="أرشفة الجهة"
                                      className="w-12 h-full text-white flex items-center justify-center transition-colors active:opacity-90 bg-sky-500 hover:bg-sky-600"
                                    >
                                      <Archive className="w-4 h-4" />
                                    </button>

                                    {/* 🗑️ Delete Button */}
                                    {canDeleteItems && (
                                      <button
                                        onClick={(e) => handleOpenDeleteConfirm(entity.name, e)}
                                        title="حذف الجهة"
                                        className="w-12 h-full text-white flex items-center justify-center transition-colors active:opacity-90 bg-rose-500 hover:bg-rose-600"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              {/* Sliding Row Content Layer (Slides RIGHT +144px to reveal left action bar) */}
                              <motion.div
                                animate={{
                                  x: isDeleting || isArchiving ? -250 : isSwiped ? 192 : 0,
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
                                      checked={selectedEntityNames.includes(entity.name)}
                                      onChange={(e) => {
                                        e.stopPropagation()
                                        handleToggleEntitySelect(entity.name)
                                      }}
                                      className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                  </div>
                                )}
                                {/* 1. اسم الجهة (Entity Name + Pin Badge) */}
                                <div className="flex-1 min-w-0 text-right font-arabic flex items-center gap-1.5">
                                  {isPinned && (
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 shadow-xs shrink-0" title="مثبتة في الأعلى">
                                      <Pin className="w-3 h-3 fill-current" />
                                    </span>
                                  )}
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleOpenLedger(entity.name, e)
                                    }}
                                    title="انقر لعرض السجل المالي للجهة"
                                    className={`text-xs truncate cursor-pointer font-bold hover:underline hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors ${
                                      isPinned ? 'text-zinc-900 dark:text-white' : 'text-zinc-900 dark:text-zinc-100'
                                    }`}
                                  >
                                    {entity.name}
                                  </span>
                                </div>

                                {/* 2. عدد المعاملات */}
                                <div className="w-32 text-center font-arabic ar-num">
                                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                    {entity.transactionCount} معاملة
                                  </span>
                                </div>

                                {/* 3. إجمالي المودعات */}
                                <div className="w-44 text-right font-arabic ar-num">
                                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                    +{formatCurrency(entity.depositedCents, currencySymbol)}
                                  </span>
                                </div>

                                {/* 4. إجمالي المسحوبات */}
                                <div className="w-44 text-right font-arabic ar-num">
                                  <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                                    -{formatCurrency(entity.withdrawnCents, currencySymbol)}
                                  </span>
                                </div>

                                {/* 5. صافي الحساب */}
                                <div className="w-48 text-right font-arabic ar-num">
                                  <span className={`text-xs font-bold px-2.5 py-1 rounded-md inline-block border ${isPositiveNet
                                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                    : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                    }`}>
                                    {isPositiveNet ? '+' : ''}{formatCurrency(entity.netCents, currencySymbol)}
                                  </span>
                                </div>
                              </motion.div>
                            </TableCell>
                          </motion.tr>
                        )
                      })}
                    </AnimatePresence>
                  </LayoutGroup>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal for Treasury Entities */}
      <DeleteConfirmModal
        open={pendingDeleteName !== null}
        onClose={() => setPendingDeleteName(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Right Slide-over Drawer (Add Entity, Print Reports, Advanced Filter) */}
      <TreasuryDrawer
        mode={drawerMode}
        onClose={() => setDrawerMode(null)}
        onAddEntitySuccess={handleAddEntitySuccess}
        entities={selectedEntityNames.length > 0 ? filteredEntities.filter((e) => selectedEntityNames.includes(e.name)) : filteredEntities}
        totalBalanceCents={totalBalanceCents}
        totalDepositsCents={totalDepositsCents}
        totalWithdrawalsCents={totalWithdrawalsCents}
        dateFilter={dateFilter}
        advancedFilter={advancedFilter}
        onApplyAdvancedFilter={setAdvancedFilter}
        onResetAdvancedFilter={() => setAdvancedFilter(defaultAdvancedFilter)}
      />

      {/* Entity Financial Ledger Modal */}
      <EntityLedgerModal
        open={isLedgerModalOpen}
        onClose={() => setIsLedgerModalOpen(false)}
        entityName={selectedEntityForLedger ?? ''}
        transactions={filteredTransactions}
        dateFilter={dateFilter}
      />

      {/* Edit Entities Modal */}
      <EditEntitiesModal
        open={isEditEntitiesModalOpen}
        onClose={() => setIsEditEntitiesModalOpen(false)}
        entities={entityBalances}
        onSuccess={(oldName, newName) => {
          setCustomEntities((prev) => {
            const updated = prev.map((e) => (e === oldName ? newName : e))
            persistCustomEntities(activeWallet, updated)
            return updated
          })
          loadTreasuryData()
        }}
      />
    </div>
  )
}
