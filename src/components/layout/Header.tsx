import { Sidebar as SidebarIcon, Search, Calendar as CalendarIcon, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { DarkModeToggle } from '@/components/ui/DarkModeToggle'
import { WalletSwitcher } from '@/components/ui/WalletSwitcher'
import type { DateFilter } from '@/types'

const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

interface HeaderProps {
  searchValue: string
  onSearchChange: (v: string) => void
  sectionTitle: string
  dateFilter?: DateFilter
  onResetDateFilter?: () => void
  onToggleSidebar?: () => void
  /** Called after wallet switch so parent can reset local state */
  onWalletSwitch?: () => void
}

export function Header({
  searchValue,
  onSearchChange,
  sectionTitle,
  dateFilter,
  onResetDateFilter,
  onToggleSidebar,
  onWalletSwitch,
}: HeaderProps) {
  let filterText = ''
  if (dateFilter && dateFilter.mode === 'YEAR') {
    filterText = `كامل سنة ${dateFilter.year}`
  } else if (dateFilter && dateFilter.mode === 'MONTH') {
    filterText = `${MONTH_NAMES_AR[dateFilter.month]} ${dateFilter.year}`
  } else if (dateFilter && dateFilter.mode === 'DAY') {
    const d = dateFilter.date
    filterText = `${d.getDate()} ${MONTH_NAMES_AR[d.getMonth()]} ${d.getFullYear()}`
  } else if (dateFilter && dateFilter.mode === 'RANGE') {
    const f = dateFilter.from
    const t = dateFilter.to
    filterText = `${f.getDate()} ${MONTH_NAMES_AR[f.getMonth()]} - ${t.getDate()} ${MONTH_NAMES_AR[t.getMonth()]} ${t.getFullYear()}`
  }

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-6 h-13 border-b border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-colors duration-300 app-drag-region select-none">
      {/* Left side: Panel icon + Dynamic Title + Active Filter Badge */}
      <div className="flex items-center gap-3 app-no-drag">
        <button
          onClick={onToggleSidebar}
          className="p-1 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer app-no-drag"
          title="إخفاء / إظهار القائمة الجانبية"
        >
          <SidebarIcon className="w-4 h-4" />
        </button>

        <span className="text-sm font-bold font-arabic text-zinc-900 dark:text-zinc-100 select-none">
          {sectionTitle === 'Dashboard' || !sectionTitle ? 'لوحة التحكم' : sectionTitle}
        </span>

        {/* Active Filter Indicator Badge */}
        {dateFilter && dateFilter.mode !== 'NONE' && (
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200/80 dark:border-cyan-800 text-xs font-arabic text-cyan-800 dark:text-cyan-300 app-no-drag">
            <CalendarIcon className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
            <span className="font-semibold ar-num">{filterText}</span>
            {onResetDateFilter && (
              <button
                onClick={onResetDateFilter}
                className="hover:bg-cyan-200/60 dark:hover:bg-cyan-900 rounded-full p-0.5 transition-colors cursor-pointer app-no-drag"
                title="إلغاء الفلترة"
              >
                <X className="w-3 h-3 text-cyan-700 dark:text-cyan-300" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Center Draggable Spacer Area */}
      <div className="flex-1 h-full app-drag-region min-w-4 cursor-default" />

      {/* Right side: Wallet Switcher + Dark Mode Toggle + Search */}
      <div className="flex items-center gap-3.5 app-no-drag">
        {/* Compact Wallet Switcher */}
        <div className="app-no-drag">
          <WalletSwitcher variant="compact" onSwitch={onWalletSwitch} />
        </div>

        {/* Dark Mode Toggle Button */}
        <div className="app-no-drag">
          <DarkModeToggle />
        </div>

        {/* Search */}
        <div className="relative hidden md:block w-48 app-no-drag">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
          <Input
            id="header-search"
            placeholder="Search..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 bg-zinc-50 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 rounded-lg focus-visible:ring-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500 app-no-drag"
          />
        </div>
      </div>
    </header>
  )
}
