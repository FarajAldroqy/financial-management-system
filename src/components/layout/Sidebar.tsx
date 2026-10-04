import {
  LayoutDashboard,
  Coins,
  User,
  Mail,
  Archive,
  Trash2,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DateFilter } from '@/types'
import { SidebarCalendar } from '@/components/sidebar/SidebarCalendar'
import logoImg from '@/assets/logo.png'
import { WalletSwitcher } from '@/components/ui/WalletSwitcher'

interface NavItem {
  id: string
  label: string
  labelAr: string
  icon: React.ComponentType<{ className?: string }>
}

const mainNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', labelAr: 'لوحة التحكم', icon: LayoutDashboard },
  { id: 'treasury', label: 'Treasury', labelAr: 'الخزينة    ', icon: Coins },
]

interface SidebarProps {
  activeSection: string
  onNavigate: (id: string) => void
  onOpenUserAudit?: () => void
  dateFilter: DateFilter
  onDateFilterChange: (filter: DateFilter) => void
  isOpen?: boolean
  archivedCount?: number
  onOpenArchive?: () => void
  deletedCount?: number
  onOpenTrash?: () => void
  onOpenSettings?: () => void
  onOpenNotes?: () => void
  /** Called after the user switches or clears the active wallet */
  onWalletSwitch?: () => void
}

export function Sidebar({
  activeSection,
  onNavigate,
  onOpenUserAudit,
  dateFilter,
  onDateFilterChange,
  isOpen = true,
  archivedCount = 0,
  onOpenArchive,
  deletedCount = 0,
  onOpenTrash,
  onOpenSettings,
  onOpenNotes,
  onWalletSwitch,
}: SidebarProps) {
  const currentDisplayName = sessionStorage.getItem('current_display_name') || sessionStorage.getItem('current_username') || 'admin'
  const hasArchivedItems = archivedCount > 0
  const hasDeletedItems = deletedCount > 0

  return (
    <aside
      className={cn(
        'bg-white dark:bg-[#090d16] flex flex-col justify-between h-full shrink-0 border-r border-slate-200/80 dark:border-slate-800/80 select-none text-slate-900 dark:text-slate-100 transition-all duration-300 ease-in-out overflow-y-auto',
        isOpen ? 'w-60 opacity-100' : 'w-0 opacity-0 border-r-0 pointer-events-none'
      )}
    >
      {/* 1. Header / Logo (منظومة إدارة مالية) */}
      <div className="flex items-center justify-between px-3.5 pt-7 pb-3 whitespace-nowrap app-drag-region">
        <div className="flex items-center gap-2 font-arabic">
          <div className="relative w-12 h-12 bg-white dark:bg-slate-900 rounded-full border-2 border-amber-500/40 dark:border-cyan-400/50 shadow-md shadow-cyan-500/10 flex items-center justify-center shrink-0 overflow-hidden p-0">
            <img
              src={logoImg}
              alt="شعار منظومة إدارة مالية"
              className="w-full h-full object-cover"
              style={{ imageRendering: 'crisp-edges' }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none'
              }}
            />
            <span className="absolute text-lg font-black text-cyan-600 font-arabic -z-10">
              م
            </span>
          </div>
          <div className="flex flex-col text-right translate-y-[2px]">
            <span className="font-extrabold text-lg text-slate-900 dark:text-slate-100 leading-tight tracking-tight">
              منظومة إدارة مالية
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              إدارة السيولة والخزينة
            </span>
          </div>
        </div>
      </div>

      {/* Active Logged-In User Button Row (MJS Dark Slate Theme) */}
      <div className="px-3 pb-3 flex items-center gap-1.5 whitespace-nowrap">
        <button
          id="sidebar-user-audit-btn"
          onClick={onOpenUserAudit}
          className="flex-1 bg-slate-900 text-white dark:bg-slate-800/90 dark:text-white hover:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-between shadow-xs border border-slate-700/50 transition-all active:scale-[0.98] cursor-pointer font-arabic"
          title="عرض سجل عمليات الأسبوع وسياسة عدم الإنكار"
        >
          <div className="flex items-center gap-2 truncate">
            <div className="w-4 h-4 rounded-full bg-slate-700 dark:bg-slate-600 flex items-center justify-center shrink-0">
              <User className="w-3 h-3 text-white dark:text-slate-200" />
            </div>
            <span className="truncate font-bold text-xs">{currentDisplayName}</span>
          </div>
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0 shadow-[0_0_8px_rgba(6,182,212,0.8)]" title="متصل الآن" />
        </button>

        <button
          type="button"
          onClick={onOpenNotes}
          className="p-2 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all border border-slate-200 dark:border-slate-700 relative cursor-pointer active:scale-95 shrink-0"
          title="الملاحظات والمفكرة"
        >
          <Mail className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Main Navigation: Dashboard, Treasury, Archive, & Trash */}
      <div className="flex-1 px-3 space-y-1 overflow-y-auto whitespace-nowrap">
        {mainNavItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id || (item.id === 'dashboard' && activeSection === 'transactions')
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all cursor-pointer',
                isActive
                  ? 'bg-cyan-500/10 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 font-bold border-r-2 border-cyan-500 shadow-xs'
                  : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
              )}
            >
              {/* RIGHT GROUP (اليمين): الأيقونة والاسم العربي بالبولد */}
              <div className="flex items-center gap-2">
                <Icon className={cn("w-5 h-5 shrink-0 transition-colors", isActive ? "text-cyan-600 dark:text-cyan-400" : "text-slate-500 dark:text-slate-400")} />
                <span className={cn("font-bold text-sm font-arabic transition-colors", isActive ? "text-cyan-900 dark:text-cyan-200" : "text-slate-900 dark:text-slate-100")}>
                  {item.labelAr}
                </span>
              </div>

              {/* LEFT GROUP (اليسار): الاسم الإنجليزي */}
              <span className={cn("text-xs font-medium transition-colors", isActive ? "text-cyan-600/80 dark:text-cyan-400/80" : "text-slate-400 dark:text-slate-500")}>
                {item.label}
              </span>
            </button>
          )
        })}

        {/* CONDITIONAL ARCHIVE MENU ITEM (ONLY WHEN hasArchivedItems IS TRUE) */}
        {hasArchivedItems && (
          <button
            onClick={onOpenArchive}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors cursor-pointer hover:bg-cyan-50 dark:hover:bg-cyan-950/60 bg-cyan-50/40 dark:bg-cyan-950/20 border border-cyan-200/60 dark:border-cyan-900/40"
          >
            {/* RIGHT GROUP (اليمين): الأيقونة والاسم العربي بالبولد */}
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-cyan-500 shrink-0" />
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100 font-arabic">
                الأرشيف
              </span>
            </div>

            {/* LEFT GROUP (اليسار): الاسم الإنجليزي والعداد */}
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
              <span>Archive</span>
              <span className="px-1.5 py-0.2 bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300 rounded-full text-[10px] font-bold ar-num">
                {archivedCount}
              </span>
            </span>
          </button>
        )}

        {/* CONDITIONAL TRASH / RECYCLE BIN MENU ITEM (ONLY WHEN hasDeletedItems IS TRUE) */}
        {hasDeletedItems && (
          <button
            onClick={onOpenTrash}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-950/60 bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40"
          >
            {/* RIGHT GROUP (اليمين): الأيقونة والاسم العربي بالبولد */}
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-500 shrink-0" />
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100 font-arabic">
                سلة المهملات
              </span>
            </div>

            {/* LEFT GROUP (اليسار): الاسم الإنجليزي والعداد */}
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
              <span>Trash</span>
              <span className="px-1.5 py-0.2 bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 rounded-full text-[10px] font-bold ar-num">
                {deletedCount}
              </span>
            </span>
          </button>
        )}

        {/* 3. Calendar Widget directly below menu items */}
        <SidebarCalendar dateFilter={dateFilter} onDateFilterChange={onDateFilterChange} />
      </div>

      {/* Wallet Switcher – above settings */}
      <WalletSwitcher variant="full" onSwitch={onWalletSwitch} />

      {/* 4. Settings Button at the very bottom */}
      <div className="p-3 border-t border-slate-200/80 dark:border-slate-800">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
        >
          {/* Right Group: Settings Icon + Bold Text "الإعدادات" */}
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400 shrink-0" />
            <span className="font-bold text-sm text-slate-900 dark:text-slate-100 font-arabic">
              الإعدادات
            </span>
          </div>

          {/* Left Group: Small English label "Settings" */}
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Settings
          </span>
        </button>
      </div>
    </aside>
  )
}
