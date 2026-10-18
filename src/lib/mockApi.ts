import type {
  Transaction,
  TransactionCreate,
  TransactionUpdate,
  PaginatedTransactions,
  GetTransactionsParams,
  Stats,
  ChartDataPoint,
  GetChartDataParams,
} from '@/types'
import { getLocalDeviceISOString } from './utils'

const STORAGE_KEY = 'salla_mock_transactions_clean_v4'

const INITIAL_TRANSACTIONS: Transaction[] = []

function getStoredTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
      return []
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]))
      return []
    }
    return parsed.map((t, idx) => ({
      ...t,
      id: typeof t.id === 'number' && !isNaN(t.id) ? t.id : idx + 1,
      wallet_type: t.wallet_type === 'USD' ? 'USD' : 'LYD',
      is_pinned: t.is_pinned ?? 0,
      is_archived: t.is_archived ?? 0,
      is_deleted: t.is_deleted ?? 0,
      payment_method: t.payment_method === 'تحويل مصرفي' ? 'بنك' : (t.payment_method || 'نقداً'),
    }))
  } catch {
    return []
  }
}

function saveStoredTransactions(txs: Transaction[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(txs))
  } catch (e) {
    console.error('Failed to save mock transactions:', e)
  }
}

export function initMockElectronAPI() {
  if (typeof window === 'undefined') return
  if (window.electronAPI) return // Already defined in Electron desktop runtime

  console.log('[MockAPI] Initializing localStorage fallback for web browser mode')

  window.electronAPI = {
    getTransactions: async (params: GetTransactionsParams): Promise<PaginatedTransactions> => {
      const page = params?.page ?? 1
      const pageSize = params?.pageSize ?? 10
      const search = (params?.search ?? '').trim().toLowerCase()
      const type = params?.type ?? 'ALL'
      const status = params?.status ?? 'ACTIVE'

      let all = getStoredTransactions()

      if (status !== 'ALL' || params?.wallet_type) {
        const walletType = params?.wallet_type || 'LYD'
        all = all.filter((t) => (t.wallet_type || 'LYD') === walletType)
      }

      if (status === 'ACTIVE') {
        all = all.filter((t) => (t.is_deleted ?? 0) === 0 && (t.is_archived ?? 0) === 0)
      } else if (status === 'ARCHIVED') {
        all = all.filter((t) => (t.is_deleted ?? 0) === 0 && (t.is_archived ?? 1) === 1)
      } else if (status === 'TRASH') {
        all = all.filter((t) => (t.is_deleted ?? 0) === 1)
      } else if (status === 'ALL_NON_DELETED') {
        all = all.filter((t) => (t.is_deleted ?? 0) === 0)
      }

      if (search) {
        all = all.filter((t) => t.client_name && t.client_name.toLowerCase().includes(search))
      }

      if (type !== 'ALL') {
        all = all.filter((t) => t.type === type)
      }

      all.sort((a, b) => {
        const pinA = a.is_pinned ?? 0
        const pinB = b.is_pinned ?? 0
        if (pinA !== pinB) return pinB - pinA
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      const total = all.length
      const start = (page - 1) * pageSize
      const data = all.slice(start, start + pageSize)

      return { data, total, page, pageSize }
    },

    createTransaction: async (payload: TransactionCreate): Promise<Transaction> => {
      const all = getStoredTransactions()
      const maxId = all.reduce((max, t) => {
        const validId = typeof t.id === 'number' && !isNaN(t.id) ? t.id : 0
        return Math.max(max, validId)
      }, 0)
      const newTx: Transaction = {
        id: maxId + 1,
        client_name: payload.client_name.trim(),
        type: payload.type,
        subtype: payload.subtype || 'REGULAR',
        person_name: payload.person_name?.trim(),
        person_names: payload.person_names?.map((n) => n.trim()).filter(Boolean),
        amount_cents: Number(payload.amount_cents) || 0,
        payment_method: payload.payment_method || 'نقداً',
        notes: (payload.notes || '').trim(),
        status: payload.status || 'COMPLETED',
        wallet_type: payload.wallet_type || 'LYD',
        is_pinned: 0,
        is_archived: 0,
        is_deleted: 0,
        created_at: payload.created_at || getLocalDeviceISOString(),
      }
      saveStoredTransactions([newTx, ...all])
      return newTx
    },

    updateTransaction: async (payload: TransactionUpdate): Promise<{ success: boolean; data?: Transaction; error?: string }> => {
      const all = getStoredTransactions()
      const index = all.findIndex((t) => t.id === payload.id)
      if (index === -1) {
        return { success: false, error: 'Transaction not found' }
      }
      const existing = all[index]
      const updated: Transaction = {
        ...existing,
        client_name: payload.client_name !== undefined ? payload.client_name.trim() : existing.client_name,
        type: payload.type !== undefined ? payload.type : existing.type,
        subtype: payload.subtype !== undefined ? payload.subtype : (existing.subtype || 'REGULAR'),
        person_name: payload.person_name !== undefined ? payload.person_name.trim() : existing.person_name,
        person_names: payload.person_names !== undefined ? payload.person_names.map((n) => n.trim()).filter(Boolean) : existing.person_names,
        amount_cents: payload.amount_cents !== undefined ? Number(payload.amount_cents) : existing.amount_cents,
        payment_method: payload.payment_method !== undefined ? payload.payment_method : existing.payment_method,
        notes: payload.notes !== undefined ? payload.notes.trim() : existing.notes,
        status: payload.status !== undefined ? payload.status : existing.status,
        wallet_type: payload.wallet_type !== undefined ? payload.wallet_type : existing.wallet_type,
        created_at: payload.created_at !== undefined ? payload.created_at : existing.created_at,
      }
      all[index] = updated
      saveStoredTransactions(all)
      return { success: true, data: updated }
    },

    getStats: async (params?: { wallet_type?: 'LYD' | 'USD' }): Promise<Stats> => {
      const walletType = params?.wallet_type || 'LYD'
      const all = getStoredTransactions().filter((t) => (t.is_deleted ?? 0) === 0 && (t.wallet_type || 'LYD') === walletType)
      let dep = 0
      let withd = 0
      let depCnt = 0
      let withdCnt = 0
      let cashDepCnt = 0
      let bankDepCnt = 0
      let cashWithdCnt = 0
      let bankWithdCnt = 0
      const accounts = new Set<string>()

      all.forEach((tx) => {
        if (tx.client_name) accounts.add(tx.client_name.trim())
        const isCash = !tx.payment_method || tx.payment_method === 'نقداً'

        if (tx.type === 'DEPOSIT') {
          dep += tx.amount_cents
          depCnt += 1
          if (isCash) cashDepCnt += 1
          else bankDepCnt += 1
        } else {
          withd += tx.amount_cents
          withdCnt += 1
          if (isCash) cashWithdCnt += 1
          else bankWithdCnt += 1
        }
      })

      return {
        total_balance_cents: dep - withd,
        total_deposits_cents: dep,
        total_withdrawals_cents: withd,
        active_accounts: accounts.size,
        deposit_count: depCnt,
        withdrawal_count: withdCnt,
        cash_deposit_count: cashDepCnt,
        bank_deposit_count: bankDepCnt,
        cash_withdrawal_count: cashWithdCnt,
        bank_withdrawal_count: bankWithdCnt,
      }
    },

    getChartData: async (params: GetChartDataParams): Promise<ChartDataPoint[]> => {
      const timeframe = params?.timeframe ?? '3m'
      const walletType = params?.wallet_type || 'LYD'
      const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90
      const all = getStoredTransactions().filter((t) => (t.is_deleted ?? 0) === 0 && (t.wallet_type || 'LYD') === walletType)

      const map = new Map<string, { dep: number; withd: number }>()
      all.forEach((tx) => {
        const dateKey = tx.created_at.slice(0, 10)
        const current = map.get(dateKey) || { dep: 0, withd: 0 }
        if (tx.type === 'DEPOSIT') current.dep += tx.amount_cents
        else current.withd += tx.amount_cents
        map.set(dateKey, current)
      })

      const result: ChartDataPoint[] = []
      const now = new Date()
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        const dateKey = d.toISOString().slice(0, 10)
        const entry = map.get(dateKey) || { dep: 0, withd: 0 }
        const dateLabel = new Intl.DateTimeFormat('ar-LY', { day: 'numeric', month: 'short' }).format(d)
        result.push({
          date: dateKey,
          dateLabel,
          deposits: entry.dep / 100,
          withdrawals: entry.withd / 100,
          deposits_cents: entry.dep,
          withdrawals_cents: entry.withd,
        })
      }
      return result
    },

    togglePin: async (id: number) => {
      const all = getStoredTransactions()
      let is_pinned = 0
      const updated = all.map((t) => {
        if (t.id === id) {
          is_pinned = t.is_pinned === 1 ? 0 : 1
          return { ...t, is_pinned }
        }
        return t
      })
      saveStoredTransactions(updated)
      return { success: true, is_pinned }
    },

    deleteTransaction: async (id: number, permanent?: boolean) => {
      let all = getStoredTransactions()
      if (permanent) {
        all = all.filter((t) => t.id !== id)
      } else {
        all = all.map((t) => (t.id === id ? { ...t, is_deleted: 1 } : t))
      }
      saveStoredTransactions(all)
      return { success: true }
    },

    restoreTransaction: async (id: number) => {
      const all = getStoredTransactions()
      const updated = all.map((t) => (t.id === id ? { ...t, is_deleted: 0, is_archived: 0 } : t))
      saveStoredTransactions(updated)
      return { success: true }
    },

    archiveTransaction: async (id: number) => {
      const all = getStoredTransactions()
      let is_archived = 0
      const updated = all.map((t) => {
        if (t.id === id) {
          is_archived = t.is_archived === 1 ? 0 : 1
          return { ...t, is_archived }
        }
        return t
      })
      saveStoredTransactions(updated)
      return { success: true, is_archived }
    },

    deleteEntityTransactions: async (clientName: string, permanent?: boolean, walletType?: 'LYD' | 'USD') => {
      let all = getStoredTransactions()
      const trimmed = clientName.trim()
      const wt = walletType || 'LYD'
      if (permanent) {
        all = all.filter((t) => !(t.client_name.trim() === trimmed && (t.wallet_type || 'LYD') === wt))
      } else {
        all = all.map((t) => (t.client_name.trim() === trimmed && (t.wallet_type || 'LYD') === wt ? { ...t, is_deleted: 1 } : t))
      }
      saveStoredTransactions(all)
      return { success: true }
    },

    restoreEntityTransactions: async (clientName: string, walletType?: 'LYD' | 'USD') => {
      const all = getStoredTransactions()
      const trimmed = clientName.trim()
      const wt = walletType || 'LYD'
      const updated = all.map((t) =>
        t.client_name.trim() === trimmed && (t.wallet_type || 'LYD') === wt ? { ...t, is_deleted: 0, is_archived: 0 } : t
      )
      saveStoredTransactions(updated)
      return { success: true }
    },

    updateEntityName: async (p: { oldName: string; newName: string; walletType?: 'LYD' | 'USD' }) => {
      const all = getStoredTransactions()
      const oldTrim = p.oldName.trim()
      const newTrim = p.newName.trim()
      const wt = p.walletType || 'LYD'
      let updatedCount = 0
      const updated = all.map((t) => {
        if (t.client_name.trim() === oldTrim && (t.wallet_type || 'LYD') === wt) {
          updatedCount++
          return { ...t, client_name: newTrim }
        }
        return t
      })
      saveStoredTransactions(updated)
      return { success: true, updatedCount }
    },

    restoreAllTransactions: async (txs: Transaction[]) => {
      saveStoredTransactions(txs || [])
      return { success: true, restoredCount: txs?.length ?? 0 }
    },

    updateTransactionNotes: async (p: { id: number; notes: string }) => {
      const all = getStoredTransactions()
      const trimmedNotes = (p.notes || '').trim()
      const updated = all.map((t) => (t.id === p.id ? { ...t, notes: trimmedNotes } : t))
      saveStoredTransactions(updated)
      return { success: true, id: p.id, notes: trimmedNotes }
    },

    deleteTransactionsBatch: async (ids: number[], permanent?: boolean) => {
      let all = getStoredTransactions()
      const set = new Set(ids)
      if (permanent) {
        all = all.filter((t) => !set.has(t.id))
      } else {
        all = all.map((t) => (set.has(t.id) ? { ...t, is_deleted: 1 } : t))
      }
      saveStoredTransactions(all)
      return { success: true, count: ids.length }
    },

    archiveTransactionsBatch: async (ids: number[]) => {
      const all = getStoredTransactions()
      const set = new Set(ids)
      const updated = all.map((t) => (set.has(t.id) ? { ...t, is_archived: 1 } : t))
      saveStoredTransactions(updated)
      return { success: true, count: ids.length }
    },

    restoreTransactionsBatch: async (ids: number[]) => {
      const all = getStoredTransactions()
      const set = new Set(ids)
      const updated = all.map((t) => (set.has(t.id) ? { ...t, is_deleted: 0, is_archived: 0 } : t))
      saveStoredTransactions(updated)
      return { success: true, count: ids.length }
    },

    deleteEntitiesBatch: async (clientNames: string[], permanent?: boolean, walletType?: 'LYD' | 'USD') => {
      let all = getStoredTransactions()
      const wt = walletType || 'LYD'
      const set = new Set(clientNames.map((n) => n.trim()))
      if (permanent) {
        all = all.filter((t) => !(set.has(t.client_name.trim()) && (t.wallet_type || 'LYD') === wt))
      } else {
        all = all.map((t) => (set.has(t.client_name.trim()) && (t.wallet_type || 'LYD') === wt ? { ...t, is_deleted: 1 } : t))
      }
      saveStoredTransactions(all)
      return { success: true, count: clientNames.length }
    },

    restoreEntitiesBatch: async (clientNames: string[], walletType?: 'LYD' | 'USD') => {
      const all = getStoredTransactions()
      const wt = walletType || 'LYD'
      const set = new Set(clientNames.map((n) => n.trim()))
      const updated = all.map((t) => (set.has(t.client_name.trim()) && (t.wallet_type || 'LYD') === wt ? { ...t, is_deleted: 0, is_archived: 0 } : t))
      saveStoredTransactions(updated)
      return { success: true, count: clientNames.length }
    },
  }
}
