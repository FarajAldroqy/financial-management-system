import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type WalletType = 'LYD' | 'USD'

export interface WalletMeta {
  type: WalletType
  /** Human-readable label in Arabic */
  labelAr: string
  /** ISO 4217 currency symbol */
  symbol: string
  /** Tailwind color token (used for theming) */
  color: 'cyan' | 'emerald'
}

export const WALLETS: Record<WalletType, WalletMeta> = {
  LYD: { type: 'LYD', labelAr: 'دينار ليبي', symbol: 'د.ل', color: 'cyan' },
  USD: { type: 'USD', labelAr: 'دولار أمريكي', symbol: '$', color: 'emerald' },
}

interface WalletContextValue {
  /** The currently active wallet – null means not yet selected */
  activeWallet: WalletType | null
  /** Metadata for the active wallet */
  activeWalletMeta: WalletMeta | null
  /** Select (or switch to) a wallet; also flushes any per-wallet cache */
  selectWallet: (type: WalletType) => void
  /** Clears the active wallet selection (goes back to picker) */
  clearWallet: () => void
  /**
   * Builds a wallet-scoped localStorage key so different wallets never
   * read each other's cached data.
   *   e.g. walletKey('treasury_entities') => 'salla_LYD_treasury_entities'
   */
  walletKey: (key: string) => string
}

// ─── Context ──────────────────────────────────────────────────────────────────

const WalletContext = createContext<WalletContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const [activeWallet, setActiveWallet] = useState<WalletType | null>(() => {
    // Restore from session (so a page refresh inside a session keeps the wallet)
    const saved = sessionStorage.getItem('active_wallet_type')
    if (saved === 'LYD' || saved === 'USD') return saved
    return null
  })

  const selectWallet = useCallback((type: WalletType) => {
    sessionStorage.setItem('active_wallet_type', type)
    setActiveWallet(type)
  }, [])

  const clearWallet = useCallback(() => {
    sessionStorage.removeItem('active_wallet_type')
    setActiveWallet(null)
  }, [])

  const walletKey = useCallback(
    (key: string) => {
      if (!activeWallet) return key
      return `salla_${activeWallet}_${key}`
    },
    [activeWallet],
  )

  const activeWalletMeta = activeWallet ? WALLETS[activeWallet] : null

  return (
    <WalletContext.Provider value={{ activeWallet, activeWalletMeta, selectWallet, clearWallet, walletKey }}>
      {children}
    </WalletContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used inside <WalletProvider>')
  return ctx
}
