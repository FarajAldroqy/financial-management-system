import { useState, useEffect, useCallback } from 'react'
import './index.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { MetricCards } from '@/components/dashboard/MetricCards'
import { OverviewChart } from '@/components/dashboard/OverviewChart'
import { TransactionsTable } from '@/components/dashboard/TransactionsTable'
import { TreasuryView } from '@/components/dashboard/TreasuryView'
import { ArchiveDrawer, EntityBalance } from '@/components/archive/ArchiveDrawer'
import { TrashDrawer } from '@/components/trash/TrashDrawer'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { LoginPage } from '@/components/auth/LoginPage'
import { WelcomeSplash } from '@/components/auth/WelcomeSplash'
import { WalletSelectScreen } from '@/components/auth/WalletSelectScreen'
import { UserAuditModal } from '@/components/dashboard/UserAuditModal'
import { NotesModal } from '@/components/dashboard/NotesModal'
import type { Stats, DateFilter, Transaction } from '@/types'
import { filterTransactionsByDate } from '@/lib/utils'
import { initAutoBackupListener } from '@/lib/backupManager'
import { initMockElectronAPI } from '@/lib/mockApi'
import { Users, Settings, Database, FileText, Sparkles,
  HelpCircle, Search, LayoutDashboard, Banknote, Building2, Coins,
} from 'lucide-react'
import { AnalyticsDashboard } from '@/components/dashboard/AnalyticsDashboard'
import { WalletProvider, useWallet } from '@/context/WalletContext'

// Initialize fallback mock API if running in browser mode outside Electron
initMockElectronAPI()

const SECTION_TITLES: Record<string, string> = {
  dashboard:    'Dashboard',
  treasury:     'الخزينة',
  transactions: 'Transactions',
  analytics:    'Analytics',
  projects:     'Projects',
  team:         'Team',
  datalibrary:  'Data Library',
  reports:      'Reports',
  assistant:    'Word Assistant',
  more:         'More',
  settings:     'Settings',
  help:         'Get Help',
  search:       'Search',
}

// Placeholder view for secondary sections
function PlaceholderSection({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center py-32 bg-white dark:bg-zinc-950">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800">
        <Icon className="w-6 h-6 text-zinc-500 dark:text-zinc-400" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">Section under development</p>
      </div>
    </div>
  )
}

const DEFAULT_STATS: Stats = {
  total_balance_cents: 0,
  total_deposits_cents: 0,
  total_withdrawals_cents: 0,
  active_accounts: 0,
  deposit_count: 0,
  withdrawal_count: 0,
  cash_deposit_count: 0,
  bank_deposit_count: 0,
  cash_withdrawal_count: 0,
  bank_withdrawal_count: 0,
}

// ─── Inner app – rendered only when authenticated + wallet selected ───────────
function AppShell() {
  const { activeWallet, clearWallet } = useWallet()

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('is_logged_in') === 'true'
  })

  useEffect(() => {
    initMockElectronAPI()
    initAutoBackupListener()
  }, [])

  const [activeSection, setActiveSection] = useState('dashboard')
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS)
  const [statsLoading, setStatsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilter>({ mode: 'NONE' })
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'ALL' | 'نقداً' | 'بنك'>('ALL')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // Archive Drawer & Rows State (Wallet scoped)
  const [isArchiveOpen, setIsArchiveOpen] = useState(false)
  const [archivedDashboardRows, setArchivedDashboardRows] = useState<Transaction[]>([])
  const [archivedTreasuryRows, setArchivedTreasuryRows] = useState<EntityBalance[]>([])

  // Load archived treasury rows when activeWallet changes
  useEffect(() => {
    if (!activeWallet) return
    const key = `salla_${activeWallet}_archived_treasury_entities`
    try {
      let saved = localStorage.getItem(key)
      if (!saved && activeWallet === 'LYD') {
        saved = localStorage.getItem('salla_archived_treasury_entities')
        if (saved) localStorage.setItem(key, saved)
      }
      setArchivedTreasuryRows(saved ? JSON.parse(saved) : [])
    } catch {
      setArchivedTreasuryRows([])
    }
  }, [activeWallet])

  useEffect(() => {
    if (!activeWallet) return
    try {
      const key = `salla_${activeWallet}_archived_treasury_entities`
      localStorage.setItem(key, JSON.stringify(archivedTreasuryRows))
    } catch (e) {
      console.error('Failed to save archived treasury entities:', e)
    }
  }, [activeWallet, archivedTreasuryRows])

  // Trash Drawer & Rows State (Recycle Bin - Wallet scoped)
  const [isTrashOpen, setIsTrashOpen] = useState(false)
  const [deletedDashboardRows, setDeletedDashboardRows] = useState<Transaction[]>([])
  const [deletedTreasuryRows, setDeletedTreasuryRows] = useState<EntityBalance[]>([])

  // Load deleted treasury rows when activeWallet changes
  useEffect(() => {
    if (!activeWallet) return
    const key = `salla_${activeWallet}_deleted_treasury_entities`
    try {
      let saved = localStorage.getItem(key)
      if (!saved && activeWallet === 'LYD') {
        saved = localStorage.getItem('salla_deleted_treasury_entities')
        if (saved) localStorage.setItem(key, saved)
      }
      setDeletedTreasuryRows(saved ? JSON.parse(saved) : [])
    } catch {
      setDeletedTreasuryRows([])
    }
  }, [activeWallet])

  useEffect(() => {
    if (!activeWallet) return
    try {
      const key = `salla_${activeWallet}_deleted_treasury_entities`
      localStorage.setItem(key, JSON.stringify(deletedTreasuryRows))
    } catch (e) {
      console.error('Failed to save deleted treasury entities:', e)
    }
  }, [activeWallet, deletedTreasuryRows])

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // User Audit Modal State (1-Week Non-Repudiation Log)
  const [isUserAuditOpen, setIsUserAuditOpen] = useState(false)

  // Compact Notes Modal State
  const [isNotesOpen, setIsNotesOpen] = useState(false)

  // Animated Welcome Splash State
  const [showSplash, setShowSplash] = useState(false)
  const [splashDisplayName, setSplashDisplayName] = useState('')

  // ── Wallet switch: reset all local wallet-scoped state ───────────────────
  const handleWalletSwitch = useCallback(() => {
    setArchivedDashboardRows([])
    setDeletedDashboardRows([])
    setStats(DEFAULT_STATS)
    setActiveSection('dashboard')
    setDateFilter({ mode: 'NONE' })
    setPaymentMethodFilter('ALL')
    setSearch('')
  }, [])

  // When activeWallet changes (after switch), re-fetch stats
  useEffect(() => {
    if (activeWallet) fetchStats()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWallet])

  const handleLoginSuccess = () => {
    const name = sessionStorage.getItem('current_display_name') || sessionStorage.getItem('current_username') || 'admin'
    setSplashDisplayName(name)
    setShowSplash(true)
  }

  const handleToggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev)
  }

  const fetchStats = useCallback(async () => {
    initMockElectronAPI()
    if (!window.electronAPI) {
      setStats((prev) => prev || DEFAULT_STATS)
      setStatsLoading(false)
      return
    }
    setStatsLoading(true)
    try {
      const walletType = activeWallet || 'LYD'
      const [s, activeResult, archResult, trashResult] = await Promise.all([
        window.electronAPI.getStats({ wallet_type: walletType }),
        window.electronAPI.getTransactions({ page: 1, pageSize: 1000, status: 'ACTIVE', wallet_type: walletType }),
        window.electronAPI.getTransactions({ page: 1, pageSize: 1000, status: 'ARCHIVED', wallet_type: walletType }),
        window.electronAPI.getTransactions({ page: 1, pageSize: 1000, status: 'TRASH', wallet_type: walletType }),
      ])

      if (archResult?.data) setArchivedDashboardRows(archResult.data)
      if (trashResult?.data) setDeletedDashboardRows(trashResult.data)

      const activeTxs = activeResult?.data || []
      let filtered = (dateFilter && dateFilter.mode !== 'NONE')
        ? filterTransactionsByDate(activeTxs, dateFilter)
        : activeTxs

      if (paymentMethodFilter !== 'ALL') {
        filtered = filtered.filter((t) => {
          if (paymentMethodFilter === 'بنك') {
            return t.payment_method === 'بنك' || t.payment_method === 'تحويل مصرفي'
          }
          return t.payment_method === paymentMethodFilter
        })
      }

      let dep = 0
      let withd = 0
      const accounts = new Set<string>()
      let depCount = 0
      let withdCount = 0
      let cashDepCount = 0
      let bankDepCount = 0
      let cashWithdCount = 0
      let bankWithdCount = 0

      filtered.forEach((tx) => {
        if (tx.client_name) accounts.add(tx.client_name.trim())
        const isCash = !tx.payment_method || tx.payment_method === 'نقداً'

        if (tx.type === 'DEPOSIT') {
          dep += tx.amount_cents
          depCount += 1
          if (isCash) cashDepCount += 1
          else bankDepCount += 1
        } else {
          withd += tx.amount_cents
          withdCount += 1
          if (isCash) cashWithdCount += 1
          else bankWithdCount += 1
        }
      })

      const baseStats = s || DEFAULT_STATS
      const finalStats: Stats = ((dateFilter && dateFilter.mode !== 'NONE') || paymentMethodFilter !== 'ALL')
        ? {
            total_balance_cents: dep - withd,
            total_deposits_cents: dep,
            total_withdrawals_cents: withd,
            active_accounts: accounts.size,
            deposit_count: depCount,
            withdrawal_count: withdCount,
            cash_deposit_count: cashDepCount,
            bank_deposit_count: bankDepCount,
            cash_withdrawal_count: cashWithdCount,
            bank_withdrawal_count: bankWithdCount,
          }
        : {
            ...baseStats,
            cash_deposit_count: cashDepCount,
            bank_deposit_count: bankDepCount,
            cash_withdrawal_count: cashWithdCount,
            bank_withdrawal_count: bankWithdCount,
          }

      setStats(finalStats)
    } catch (err) {
      console.error('Failed to fetch stats', err)
      setStats((prev) => prev || DEFAULT_STATS)
    } finally {
      setStatsLoading(false)
    }
  }, [dateFilter, activeWallet, paymentMethodFilter])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // --- Archive Handlers ---
  const handleRestoreDashboardRow = async (id: number) => {
    if (window.electronAPI?.restoreTransaction) {
      await window.electronAPI.restoreTransaction(id)
      await fetchStats()
    } else if (window.electronAPI?.archiveTransaction) {
      await window.electronAPI.archiveTransaction(id)
      await fetchStats()
    }
    setArchivedDashboardRows((prev) => prev.filter((r) => r.id !== id))
  }

  const handlePermanentDeleteDashboardRow = async (id: number) => {
    if (window.electronAPI?.deleteTransaction) {
      await window.electronAPI.deleteTransaction(id, true)
      await fetchStats()
    }
    setArchivedDashboardRows((prev) => prev.filter((r) => r.id !== id))
  }

  const handleRestoreTreasuryEntity = async (name: string) => {
    setArchivedTreasuryRows((prev) => prev.filter((r) => r.name !== name))
    await fetchStats()
  }

  const removeCustomEntityFromLocalStorage = (name: string) => {
    try {
      const key = activeWallet ? `salla_${activeWallet}_treasury_custom_entities` : 'salla_treasury_custom_entities'
      const saved = localStorage.getItem(key)
      if (saved) {
        const list: string[] = JSON.parse(saved)
        const updated = list.filter((n) => n.trim().toLowerCase() !== name.trim().toLowerCase())
        localStorage.setItem(key, JSON.stringify(updated))
      }
      if (!activeWallet || activeWallet === 'LYD') {
        const legacySaved = localStorage.getItem('salla_treasury_custom_entities')
        if (legacySaved) {
          const list: string[] = JSON.parse(legacySaved)
          const updated = list.filter((n) => n.trim().toLowerCase() !== name.trim().toLowerCase())
          localStorage.setItem('salla_treasury_custom_entities', JSON.stringify(updated))
        }
      }
    } catch (e) {
      console.error('Failed to update treasury_custom_entities on permanent delete:', e)
    }
  }

  const handlePermanentDeleteTreasuryEntity = async (name: string) => {
    if (window.electronAPI?.deleteEntityTransactions) {
      await window.electronAPI.deleteEntityTransactions(name, true, activeWallet || 'LYD')
      await fetchStats()
    }
    removeCustomEntityFromLocalStorage(name)
    setArchivedTreasuryRows((prev) => prev.filter((r) => r.name !== name))
    setDeletedTreasuryRows((prev) => prev.filter((r) => r.name !== name))
  }

  // --- Trash / Soft Delete Handlers ---
  const handleRestoreDashboardTrashRow = async (id: number) => {
    if (window.electronAPI?.restoreTransaction) {
      await window.electronAPI.restoreTransaction(id)
      await fetchStats()
    }
    setDeletedDashboardRows((prev) => prev.filter((r) => r.id !== id))
  }

  const handlePermanentDeleteDashboardTrashRow = async (id: number) => {
    if (window.electronAPI?.deleteTransaction) {
      await window.electronAPI.deleteTransaction(id, true)
      await fetchStats()
    }
    setDeletedDashboardRows((prev) => prev.filter((r) => r.id !== id))
  }

  const handleRestoreTreasuryTrashEntity = async (name: string) => {
    if (window.electronAPI?.restoreEntityTransactions) {
      await window.electronAPI.restoreEntityTransactions(name, activeWallet || 'LYD')
      await fetchStats()
    }
    setDeletedTreasuryRows((prev) => prev.filter((r) => r.name !== name))
  }

  const handlePermanentDeleteTreasuryTrashEntity = async (name: string) => {
    if (window.electronAPI?.deleteEntityTransactions) {
      await window.electronAPI.deleteEntityTransactions(name, true, activeWallet || 'LYD')
      await fetchStats()
    }
    removeCustomEntityFromLocalStorage(name)
    setDeletedTreasuryRows((prev) => prev.filter((r) => r.name !== name))
    setArchivedTreasuryRows((prev) => prev.filter((r) => r.name !== name))
  }

  // --- High-Performance Batch Handlers (Single DB query + single state refresh) ---
  const handleRestoreDashboardRowsBatch = async (ids: number[]) => {
    if (window.electronAPI?.restoreTransactionsBatch) {
      await window.electronAPI.restoreTransactionsBatch(ids)
    }
    const idSet = new Set(ids)
    setArchivedDashboardRows((prev) => prev.filter((r) => !idSet.has(r.id)))
    setDeletedDashboardRows((prev) => prev.filter((r) => !idSet.has(r.id)))
    await fetchStats()
  }

  const handlePermanentDeleteDashboardRowsBatch = async (ids: number[]) => {
    if (window.electronAPI?.deleteTransactionsBatch) {
      await window.electronAPI.deleteTransactionsBatch(ids, true)
    }
    const idSet = new Set(ids)
    setArchivedDashboardRows((prev) => prev.filter((r) => !idSet.has(r.id)))
    setDeletedDashboardRows((prev) => prev.filter((r) => !idSet.has(r.id)))
    await fetchStats()
  }

  const handleRestoreTreasuryEntitiesBatch = async (names: string[]) => {
    if (window.electronAPI?.restoreEntitiesBatch) {
      await window.electronAPI.restoreEntitiesBatch(names, activeWallet || 'LYD')
    }
    const nameSet = new Set(names.map((n) => n.trim().toLowerCase()))
    setArchivedTreasuryRows((prev) => prev.filter((r) => !nameSet.has(r.name.trim().toLowerCase())))
    setDeletedTreasuryRows((prev) => prev.filter((r) => !nameSet.has(r.name.trim().toLowerCase())))
    await fetchStats()
  }

  const handlePermanentDeleteTreasuryEntitiesBatch = async (names: string[]) => {
    if (window.electronAPI?.deleteEntitiesBatch) {
      await window.electronAPI.deleteEntitiesBatch(names, true, activeWallet || 'LYD')
    }
    names.forEach(removeCustomEntityFromLocalStorage)
    const nameSet = new Set(names.map((n) => n.trim().toLowerCase()))
    setArchivedTreasuryRows((prev) => prev.filter((r) => !nameSet.has(r.name.trim().toLowerCase())))
    setDeletedTreasuryRows((prev) => prev.filter((r) => !nameSet.has(r.name.trim().toLowerCase())))
    await fetchStats()
  }

  // Global Pointer Events Watchdog: Ensures UI input fields never get locked or frozen
  useEffect(() => {
    const unlockBody = () => {
      if (document.body.style.pointerEvents === 'none') {
        document.body.style.pointerEvents = 'auto'
      }
    }
    unlockBody()
    const timer = setInterval(unlockBody, 300)
    return () => clearInterval(timer)
  }, [])

  const totalArchivedCount = archivedDashboardRows.length + archivedTreasuryRows.length
  const totalDeletedCount = deletedDashboardRows.length + deletedTreasuryRows.length

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
      case 'transactions':
      case 'lifecycle':
        return (
          <div className="flex flex-col gap-5 p-6 bg-white dark:bg-zinc-950 min-h-full transition-colors duration-300">
            {/* Quick Payment Method Filter Switch (فوق البطاقات) */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-1" dir="rtl">
              <div className="flex items-center gap-2">
                <div className="flex items-center p-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800/90 rounded-2xl shadow-xs">
                  <button
                    type="button"
                    id="payment-filter-all"
                    onClick={() => setPaymentMethodFilter('ALL')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-arabic font-bold transition-all duration-200 cursor-pointer ${
                      paymentMethodFilter === 'ALL'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-xs border border-zinc-200/80 dark:border-zinc-700/80'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>الكل</span>
                  </button>

                  <button
                    type="button"
                    id="payment-filter-cash"
                    onClick={() => setPaymentMethodFilter('نقداً')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-arabic font-bold transition-all duration-200 cursor-pointer ${
                      paymentMethodFilter === 'نقداً'
                        ? 'bg-emerald-600 text-white shadow-xs border border-emerald-500'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>نقداً</span>
                  </button>

                  <button
                    type="button"
                    id="payment-filter-bank"
                    onClick={() => setPaymentMethodFilter('بنك')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-arabic font-bold transition-all duration-200 cursor-pointer ${
                      paymentMethodFilter === 'بنك'
                        ? 'bg-sky-600 text-white shadow-xs border border-sky-500'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>بنك</span>
                  </button>
                </div>
              </div>

              {/* Active Filter Indicator Hint */}
              <div className="flex items-center gap-2 text-xs font-arabic text-zinc-500 dark:text-zinc-400">
                <span className={`inline-block w-2 h-2 rounded-full ${
                  paymentMethodFilter === 'نقداً' ? 'bg-emerald-500' : paymentMethodFilter === 'بنك' ? 'bg-sky-500' : 'bg-emerald-500'
                }`} />
                <span>
                  {paymentMethodFilter === 'ALL'
                    ? 'عرض كافة المعاملات (النقدية والبنكية)'
                    : paymentMethodFilter === 'نقداً'
                    ? 'عرض المعاملات النقدية فقط'
                    : 'عرض المعاملات البنكية فقط'}
                </span>
              </div>
            </div>

            {/* Top Metric Cards (Row 1) */}
            <MetricCards stats={stats} loading={statsLoading} paymentMethodFilter={paymentMethodFilter} />

            {/* Total Visitors / Overview Wave Chart (Row 2) */}
            <OverviewChart />

            {/* Main Data Table with toolbar (Row 3) */}
            <TransactionsTable
              searchValue={search}
              onStatsRefresh={fetchStats}
              dateFilter={dateFilter}
              paymentMethodFilter={paymentMethodFilter}
              onArchiveRow={(tx) => {
                setArchivedDashboardRows((prev) => [...prev.filter((r) => r.id !== tx.id), tx])
              }}
              onDeleteRow={(tx) => {
                setDeletedDashboardRows((prev) => [...prev.filter((r) => r.id !== tx.id), tx])
              }}
            />
          </div>
        )

      case 'treasury':
        return (
          <TreasuryView
            dateFilter={dateFilter}
            archivedTreasuryRows={archivedTreasuryRows}
            deletedTreasuryRows={deletedTreasuryRows}
            onArchiveEntity={(entity) => {
              setArchivedTreasuryRows((prev) => [...prev.filter((r) => r.name !== entity.name), entity])
            }}
            onDeleteEntity={(entity) => {
              setDeletedTreasuryRows((prev) => [...prev.filter((r) => r.name !== entity.name), entity])
            }}
          />
        )

      case 'analytics':
        return <AnalyticsDashboard dateFilter={dateFilter} />
      case 'team':
        return <PlaceholderSection icon={Users} title="Team" />
      case 'datalibrary':
        return <PlaceholderSection icon={Database} title="Data Library" />
      case 'reports':
        return <PlaceholderSection icon={FileText} title="Reports" />
      case 'assistant':
        return <PlaceholderSection icon={Sparkles} title="Word Assistant" />
      case 'settings':
        return <PlaceholderSection icon={Settings} title="Settings" />
      case 'help':
        return <PlaceholderSection icon={HelpCircle} title="Get Help" />
      case 'search':
        return <PlaceholderSection icon={Search} title="Search" />
      default:
        return <PlaceholderSection icon={LayoutDashboard} title={SECTION_TITLES[activeSection] ?? activeSection} />
    }
  }

  if (showSplash) {
    return (
      <WelcomeSplash
        displayName={splashDisplayName}
        onComplete={() => {
          setShowSplash(false)
          setIsAuthenticated(true)
        }}
      />
    )
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  // ── Step 3: Wallet picker (shown once per session after login/splash) ────
  if (!activeWallet) {
    return <WalletSelectScreen />
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 select-none transition-colors duration-300">
      {/* Sidebar with embedded Calendar widget & Conditional Archive/Trash buttons */}
      <Sidebar
        activeSection={activeSection}
        onNavigate={setActiveSection}
        onOpenUserAudit={() => setIsUserAuditOpen(true)}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        isOpen={isSidebarOpen}
        archivedCount={totalArchivedCount}
        onOpenArchive={() => setIsArchiveOpen(true)}
        deletedCount={totalDeletedCount}
        onOpenTrash={() => setIsTrashOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenNotes={() => setIsNotesOpen(true)}
        onWalletSwitch={handleWalletSwitch}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden bg-white dark:bg-zinc-950">
        {/* Top Header with Active Date Filter Badge & Sidebar Toggle */}
        <Header
          searchValue={search}
          onSearchChange={setSearch}
          sectionTitle={SECTION_TITLES[activeSection] ?? 'Dashboard'}
          dateFilter={dateFilter}
          onResetDateFilter={() => setDateFilter({ mode: 'NONE' })}
          onToggleSidebar={handleToggleSidebar}
          onWalletSwitch={handleWalletSwitch}
        />

        {/* Scrollable Page Content */}
        <main className="flex-1 h-full overflow-y-auto bg-white dark:bg-zinc-950">
          {renderContent()}
        </main>
      </div>

      {/* Archive Drawer */}
      <ArchiveDrawer
        open={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        archivedDashboardRows={archivedDashboardRows}
        archivedTreasuryRows={archivedTreasuryRows}
        onRestoreDashboardRow={handleRestoreDashboardRow}
        onPermanentDeleteDashboardRow={handlePermanentDeleteDashboardRow}
        onRestoreTreasuryEntity={handleRestoreTreasuryEntity}
        onPermanentDeleteTreasuryEntity={handlePermanentDeleteTreasuryEntity}
        onRestoreDashboardRowsBatch={handleRestoreDashboardRowsBatch}
        onPermanentDeleteDashboardRowsBatch={handlePermanentDeleteDashboardRowsBatch}
        onRestoreTreasuryEntitiesBatch={handleRestoreTreasuryEntitiesBatch}
        onPermanentDeleteTreasuryEntitiesBatch={handlePermanentDeleteTreasuryEntitiesBatch}
      />

      {/* Trash Drawer (Recycle Bin) */}
      <TrashDrawer
        open={isTrashOpen}
        onClose={() => setIsTrashOpen(false)}
        deletedDashboardRows={deletedDashboardRows}
        deletedTreasuryRows={deletedTreasuryRows}
        onRestoreDashboardRow={handleRestoreDashboardTrashRow}
        onPermanentDeleteDashboardRow={handlePermanentDeleteDashboardTrashRow}
        onRestoreTreasuryEntity={handleRestoreTreasuryTrashEntity}
        onPermanentDeleteTreasuryEntity={handlePermanentDeleteTreasuryTrashEntity}
        onRestoreDashboardRowsBatch={handleRestoreDashboardRowsBatch}
        onPermanentDeleteDashboardRowsBatch={handlePermanentDeleteDashboardRowsBatch}
        onRestoreTreasuryEntitiesBatch={handleRestoreTreasuryEntitiesBatch}
        onPermanentDeleteTreasuryEntitiesBatch={handlePermanentDeleteTreasuryEntitiesBatch}
      />

      {/* Settings Modal */}
      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onLogout={() => {
          clearWallet()
          setIsAuthenticated(false)
        }}
      />

      {/* User 1-Week Non-Repudiation Audit Log Modal */}
      <UserAuditModal
        open={isUserAuditOpen}
        onClose={() => setIsUserAuditOpen(false)}
      />

      {/* Compact Notes Modal */}
      <NotesModal
        open={isNotesOpen}
        onClose={() => setIsNotesOpen(false)}
      />
    </div>
  )
}

// ─── Root export – wraps everything in WalletProvider ─────────────────────────
export default function App() {
  return (
    <WalletProvider>
      <AppShell />
    </WalletProvider>
  )
}
