import { ArrowDownLeft, ArrowUpRight, Wallet, CreditCard } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import type { Stats } from '@/types'

interface MetricCardsProps {
  stats: Stats | null
  loading: boolean
  paymentMethodFilter?: 'ALL' | 'نقداً' | 'بنك'
}

function SkeletonCard() {
  return (
    <Card className="subtle-card rounded-2xl p-5 shadow-xs border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-28 rounded-md bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-9 w-9 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="h-8 w-36 rounded-lg bg-zinc-200 dark:bg-zinc-800 mb-4" />
      <div className="h-4 w-32 rounded-md bg-zinc-200/60 dark:bg-zinc-800/60" />
    </Card>
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

export function MetricCards({ stats, loading, paymentMethodFilter = 'ALL' }: MetricCardsProps) {
  if (loading && !stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  const currentStats = stats || DEFAULT_STATS

  const cashDeposits = currentStats.cash_deposit_count ?? Math.max(0, currentStats.deposit_count)
  const bankDeposits = currentStats.bank_deposit_count ?? 0

  const cashWithdrawals = currentStats.cash_withdrawal_count ?? Math.max(0, currentStats.withdrawal_count)
  const bankWithdrawals = currentStats.bank_withdrawal_count ?? 0

  const filterSubtitleSuffix =
    paymentMethodFilter === 'نقداً'
      ? ' (نقداً فقط)'
      : paymentMethodFilter === 'بنك'
      ? ' (بنك فقط)'
      : ''

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 font-arabic" dir="rtl">
      {/* CARD 1: TOTAL WITHDRAWALS (مجموع السحوبات) */}
      <Card
        id="metric-total-withdrawals"
        className="subtle-card rounded-2xl p-5 shadow-xs border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/90 hover:border-rose-300 dark:hover:border-rose-800 transition-all group"
      >
        <CardContent className="p-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              مجموع السحوبات {filterSubtitleSuffix}
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 flex items-center justify-center text-rose-600 dark:text-rose-400 group-hover:scale-105 transition-transform">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>

          <div className="text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400 mb-3 ar-num">
            {formatCurrency(currentStats.total_withdrawals_cents)}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            <span>
              {paymentMethodFilter === 'نقداً'
                ? 'إجمالي المبالغ المسحوبة نقداً'
                : paymentMethodFilter === 'بنك'
                ? 'إجمالي المبالغ المسحوبة عبر البنك'
                : 'إجمالي المبالغ المسحوبة بالكامل'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* CARD 2: TOTAL DEPOSITS (مجموع الإيداعات) */}
      <Card
        id="metric-total-deposits"
        className="subtle-card rounded-2xl p-5 shadow-xs border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d1322] hover:border-cyan-400 dark:hover:border-cyan-600 transition-all group"
      >
        <CardContent className="p-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              مجموع الإيداعات {filterSubtitleSuffix}
            </span>
            <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800/80 flex items-center justify-center text-cyan-600 dark:text-cyan-400 group-hover:scale-105 transition-transform">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>

          <div className="text-2xl font-black tracking-tight text-cyan-600 dark:text-cyan-400 mb-3 ar-num">
            {formatCurrency(currentStats.total_deposits_cents)}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>
              {paymentMethodFilter === 'نقداً'
                ? 'إجمالي الإيداعات النقدية المقبوضة'
                : paymentMethodFilter === 'بنك'
                ? 'إجمالي الإيداعات والتحويلات البنكية'
                : 'إجمالي المقبوضات والمودعات بالكامل'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* CARD 3: DEPOSITS BREAKDOWN COUNT (عدد الإيداعات) */}
      <Card
        id="metric-deposits-count"
        className="subtle-card rounded-2xl p-5 shadow-xs border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/90 hover:border-sky-300 dark:hover:border-sky-800 transition-all group"
      >
        <CardContent className="p-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              عدد الإيداعات {filterSubtitleSuffix}
            </span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/80 flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:scale-105 transition-transform">
              <Wallet className="w-5 h-5" />
            </div>
          </div>

          <div className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mb-3 ar-num">
            {currentStats.deposit_count} <span className="text-xs font-bold text-zinc-400">معاملة</span>
          </div>

          {/* Dual breakdown badges */}
          <div className="flex items-center gap-2 pt-0.5 text-xs font-bold">
            {(paymentMethodFilter === 'ALL' || paymentMethodFilter === 'نقداً') && (
              <span className={`px-2.5 py-1 rounded-lg border ar-num ${
                paymentMethodFilter === 'نقداً'
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-extrabold'
                  : 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-800/60'
              }`}>
                نقداً: {cashDeposits}
              </span>
            )}
            {(paymentMethodFilter === 'ALL' || paymentMethodFilter === 'بنك') && (
              <span className={`px-2.5 py-1 rounded-lg border ar-num ${
                paymentMethodFilter === 'بنك'
                  ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-700 font-extrabold'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
              }`}>
                بنك: {bankDeposits}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* CARD 4: WITHDRAWALS BREAKDOWN COUNT (عدد السحوبات) */}
      <Card
        id="metric-withdrawals-count"
        className="subtle-card rounded-2xl p-5 shadow-xs border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/90 hover:border-amber-300 dark:hover:border-amber-800 transition-all group"
      >
        <CardContent className="p-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              عدد السحوبات {filterSubtitleSuffix}
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>

          <div className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white mb-3 ar-num">
            {currentStats.withdrawal_count} <span className="text-xs font-bold text-zinc-400">معاملة</span>
          </div>

          {/* Dual breakdown badges */}
          <div className="flex items-center gap-2 pt-0.5 text-xs font-bold">
            {(paymentMethodFilter === 'ALL' || paymentMethodFilter === 'نقداً') && (
              <span className={`px-2.5 py-1 rounded-lg border ar-num ${
                paymentMethodFilter === 'نقداً'
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 font-extrabold'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60'
              }`}>
                نقداً: {cashWithdrawals}
              </span>
            )}
            {(paymentMethodFilter === 'ALL' || paymentMethodFilter === 'بنك') && (
              <span className={`px-2.5 py-1 rounded-lg border ar-num ${
                paymentMethodFilter === 'بنك'
                  ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-700 font-extrabold'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
              }`}>
                بنك: {bankWithdrawals}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
