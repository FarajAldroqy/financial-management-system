export type PaymentMethod = 'نقداً' | 'بنك' | 'تحويل مصرفي' | 'بطاقة'
export type TransactionSubtype = 'REGULAR' | 'PERSON'

export interface InvoiceItem {
  name: string
  amount: number
}

export interface Transaction {
  id: number
  client_name: string
  type: 'DEPOSIT' | 'WITHDRAWAL'
  subtype?: TransactionSubtype
  person_name?: string
  person_names?: string[]
  items?: InvoiceItem[]
  amount_cents: number
  payment_method?: PaymentMethod | string
  notes?: string
  status?: 'COMPLETED' | 'PENDING' | 'FAILED' | 'PROCESSING'
  is_pinned?: number
  is_archived?: number
  is_deleted?: number
  wallet_type?: 'LYD' | 'USD'
  created_at: string
}

export interface TransactionCreate {
  client_name: string
  type: 'DEPOSIT' | 'WITHDRAWAL'
  subtype?: TransactionSubtype
  person_name?: string
  person_names?: string[]
  items?: InvoiceItem[]
  amount_cents: number
  payment_method: PaymentMethod | string
  notes?: string
  status?: 'COMPLETED' | 'PENDING' | 'FAILED' | 'PROCESSING'
  wallet_type?: 'LYD' | 'USD'
  created_at?: string
}

export interface TransactionUpdate {
  id: number
  client_name?: string
  type?: 'DEPOSIT' | 'WITHDRAWAL'
  subtype?: TransactionSubtype
  person_name?: string
  person_names?: string[]
  items?: InvoiceItem[]
  amount_cents?: number
  payment_method?: PaymentMethod | string
  notes?: string
  status?: 'COMPLETED' | 'PENDING' | 'FAILED' | 'PROCESSING'
  wallet_type?: 'LYD' | 'USD'
  created_at?: string
}

export interface Stats {
  total_balance_cents: number
  total_deposits_cents: number
  total_withdrawals_cents: number
  active_accounts: number
  deposit_count: number
  withdrawal_count: number
  cash_deposit_count?: number
  bank_deposit_count?: number
  cash_withdrawal_count?: number
  bank_withdrawal_count?: number
}

export interface PaginatedTransactions {
  data: Transaction[]
  total: number
  page: number
  pageSize: number
}

export interface GetTransactionsParams {
  page?: number
  pageSize?: number
  search?: string
  type?: 'DEPOSIT' | 'WITHDRAWAL' | 'ALL'
  status?: 'ACTIVE' | 'ARCHIVED' | 'TRASH' | 'ALL_NON_DELETED' | 'ALL'
  wallet_type?: 'LYD' | 'USD'
}

export interface ChartDataPoint {
  date: string
  dateLabel: string
  deposits: number
  withdrawals: number
  deposits_cents: number
  withdrawals_cents: number
}

export interface GetChartDataParams {
  timeframe: '7d' | '30d' | '3m'
  wallet_type?: 'LYD' | 'USD'
}

export type DateFilter =
  | { mode: 'NONE' }
  | { mode: 'YEAR'; year: number }
  | { mode: 'MONTH'; year: number; month: number } // month index 0-11
  | { mode: 'DAY'; date: Date }
  | { mode: 'RANGE'; from: Date; to: Date }

export interface UserAccount {
  id: string
  username: string
  displayName?: string
  password?: string
  permissions: string[]
  recoveryKeys: string[]
}


