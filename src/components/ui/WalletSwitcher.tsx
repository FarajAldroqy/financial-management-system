import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { useWallet, WALLETS, type WalletType } from '@/context/WalletContext'
import { cn } from '@/lib/utils'

interface WalletSwitcherProps {
  /** compact: small inline badge (for Header), full: wider sidebar button */
  variant?: 'compact' | 'full'
  /** Called after wallet switch so parent can reset local state */
  onSwitch?: () => void
}

export function WalletSwitcher({ variant = 'full', onSwitch }: WalletSwitcherProps) {
  const { activeWallet, activeWalletMeta, selectWallet, clearWallet } = useWallet()
  const [open, setOpen] = useState(false)

  if (!activeWallet || !activeWalletMeta) return null

  const otherType: WalletType = activeWallet === 'LYD' ? 'USD' : 'LYD'
  const otherMeta = WALLETS[otherType]

  const isCyan = activeWalletMeta.color === 'cyan'

  const handleSwitch = () => {
    setOpen(false)
    selectWallet(otherType)
    onSwitch?.()
  }

  const handlePicker = () => {
    setOpen(false)
    clearWallet()
    onSwitch?.()
  }

  if (variant === 'compact') {
    return (
      <div className="relative">
        <button
          id="wallet-switcher-compact"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all border cursor-pointer',
            isCyan
              ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/20'
              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20',
          )}
          title="تبديل المحفظة"
        >
          <span className="text-base leading-none">{activeWallet === 'LYD' ? '🇱🇾' : '🇺🇸'}</span>
          <span className="font-mono">{activeWalletMeta.symbol}</span>
          <span>{activeWalletMeta.labelAr}</span>
          <RefreshCw className="w-3 h-3 opacity-70" />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              key="compact-dropdown"
              initial={{ opacity: 0, scale: 0.92, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="absolute left-0 top-full mt-2 z-50 min-w-[180px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl shadow-black/20 p-1.5"
            >
              <DropdownItems
                otherMeta={otherMeta}
                otherType={otherType}
                onSwitch={handleSwitch}
                onPicker={handlePicker}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      </div>
    )
  }

  // ── Full / sidebar variant ──────────────────────────────────────────────────
  return (
    <div className="relative px-3 pb-2">
      <button
        id="wallet-switcher-full"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all cursor-pointer',
          isCyan
            ? 'bg-cyan-500/8 dark:bg-cyan-500/10 border-cyan-500/25 hover:border-cyan-500/50 text-cyan-800 dark:text-cyan-300'
            : 'bg-emerald-500/8 dark:bg-emerald-500/10 border-emerald-500/25 hover:border-emerald-500/50 text-emerald-800 dark:text-emerald-300',
        )}
        title="تبديل المحفظة"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{activeWallet === 'LYD' ? '🇱🇾' : '🇺🇸'}</span>
          <div className="text-right">
            <p className="text-xs font-extrabold leading-none">{activeWalletMeta.labelAr}</p>
            <p
              className={cn(
                'text-[10px] font-mono mt-0.5',
                isCyan ? 'text-cyan-500 dark:text-cyan-400' : 'text-emerald-500 dark:text-emerald-400',
              )}
            >
              {activeWalletMeta.symbol} · {activeWallet}
            </p>
          </div>
        </div>
        <RefreshCw className="w-3.5 h-3.5 opacity-60" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="full-dropdown"
            initial={{ opacity: 0, scale: 0.94, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute inset-x-3 top-full mt-1.5 z-50 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl shadow-black/25 p-1.5"
          >
            <DropdownItems
              otherMeta={otherMeta}
              otherType={otherType}
              onSwitch={handleSwitch}
              onPicker={handlePicker}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  )
}

// ─── Shared dropdown items ─────────────────────────────────────────────────────

function DropdownItems({
  otherMeta,
  otherType,
  onSwitch,
  onPicker,
}: {
  otherMeta: (typeof WALLETS)[keyof typeof WALLETS]
  otherType: WalletType
  onSwitch: () => void
  onPicker: () => void
}) {
  return (
    <>
      <button
        onClick={onSwitch}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-right"
      >
        <span className="text-xl leading-none">{otherType === 'LYD' ? '🇱🇾' : '🇺🇸'}</span>
        <div>
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{otherMeta.labelAr}</p>
          <p className="text-[10px] text-slate-400 font-mono">{otherMeta.symbol} · {otherType}</p>
        </div>
      </button>

      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

      <button
        onClick={onPicker}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-right text-xs text-slate-500 dark:text-slate-400"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>العودة لاختيار المحفظة</span>
      </button>
    </>
  )
}
