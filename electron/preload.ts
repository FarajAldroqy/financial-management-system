import { ipcRenderer, contextBridge } from 'electron'
import type {
  PaginatedTransactions,
  TransactionCreate,
  TransactionUpdate,
  Transaction,
  Stats,
  GetTransactionsParams,
  ChartDataPoint,
  GetChartDataParams,
} from '../src/types'

// --------- Expose typed electronAPI to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
  getTransactions: (params: GetTransactionsParams): Promise<PaginatedTransactions> =>
    ipcRenderer.invoke('db:get-transactions', params),

  createTransaction: (payload: TransactionCreate): Promise<Transaction> =>
    ipcRenderer.invoke('db:create-transaction', payload),

  updateTransaction: (payload: TransactionUpdate): Promise<{ success: boolean; data?: Transaction; error?: string }> =>
    ipcRenderer.invoke('db:update-transaction', payload),

  getStats: (params?: { wallet_type?: 'LYD' | 'USD' }): Promise<Stats> =>
    ipcRenderer.invoke('db:get-stats', params),

  getChartData: (params: GetChartDataParams): Promise<ChartDataPoint[]> =>
    ipcRenderer.invoke('db:get-chart-data', params),

  togglePin: (id: number): Promise<{ success: boolean; is_pinned: number }> =>
    ipcRenderer.invoke('db:toggle-pin', id),

  deleteTransaction: (id: number, permanent?: boolean): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('db:delete-transaction', id, permanent),

  restoreTransaction: (id: number): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('db:restore-transaction', id),

  archiveTransaction: (id: number): Promise<{ success: boolean; is_archived: number }> =>
    ipcRenderer.invoke('db:archive-transaction', id),

  deleteEntityTransactions: (clientName: string, permanent?: boolean, walletType?: 'LYD' | 'USD'): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('db:delete-entity-transactions', clientName, permanent, walletType),

  restoreEntityTransactions: (clientName: string, walletType?: 'LYD' | 'USD'): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('db:restore-entity-transactions', clientName, walletType),

  updateEntityName: (params: { oldName: string; newName: string; walletType?: 'LYD' | 'USD' }): Promise<{ success: boolean; updatedCount?: number; message?: string }> =>
    ipcRenderer.invoke('db:update-entity-name', params),

  restoreAllTransactions: (txs: Transaction[]): Promise<{ success: boolean; restoredCount?: number; error?: string }> =>
    ipcRenderer.invoke('db:restore-all-transactions', txs),

  updateTransactionNotes: (params: { id: number; notes: string }): Promise<{ success: boolean; id?: number; notes?: string; error?: string }> =>
    ipcRenderer.invoke('db:update-transaction-notes', params),

  deleteTransactionsBatch: (ids: number[], permanent?: boolean): Promise<{ success: boolean; count?: number; error?: string }> =>
    ipcRenderer.invoke('db:delete-transactions-batch', ids, permanent),

  archiveTransactionsBatch: (ids: number[]): Promise<{ success: boolean; count?: number; error?: string }> =>
    ipcRenderer.invoke('db:archive-transactions-batch', ids),

  restoreTransactionsBatch: (ids: number[]): Promise<{ success: boolean; count?: number; error?: string }> =>
    ipcRenderer.invoke('db:restore-transactions-batch', ids),

  deleteEntitiesBatch: (clientNames: string[], permanent?: boolean, walletType?: 'LYD' | 'USD'): Promise<{ success: boolean; count?: number; error?: string }> =>
    ipcRenderer.invoke('db:delete-entities-batch', clientNames, permanent, walletType),

  restoreEntitiesBatch: (clientNames: string[], walletType?: 'LYD' | 'USD'): Promise<{ success: boolean; count?: number; error?: string }> =>
    ipcRenderer.invoke('db:restore-entities-batch', clientNames, walletType),

  onRequestAutoBackup: (callback: () => void) => {
    ipcRenderer.on('app:request-auto-backup', () => callback())
  },

  notifyAutoBackupCompleted: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('app:auto-backup-completed'),
})

// Keep legacy ipcRenderer for backward compatibility
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})
