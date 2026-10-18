import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Get the active wallet currency symbol ('د.ل' or '$') from session or default */
export function getActiveWalletSymbol(): string {
  if (typeof window !== 'undefined') {
    const saved = sessionStorage.getItem('active_wallet_type')
    if (saved === 'USD') return '$'
    if (saved === 'LYD') return 'د.ل'
  }
  return 'د.ل'
}

/** Format amount_cents into currency string with dynamic or provided symbol */
export function formatCurrency(cents: number, symbol?: string, _locale = 'ar-LY'): string {
  const amount = cents / 100
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
  const sym = symbol !== undefined ? symbol : getActiveWalletSymbol()
  return `${formatted} ${sym}`
}

/** Convert Eastern Arabic (٠-٩) and Persian (۰-۹) numerals into standard Western (0-9) digits */
export function normalizeArabicNumerals(input: string): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

  return input
    .replace(/[٠-٩]/g, (w) => arabicDigits.indexOf(w).toString())
    .replace(/[۰-۹]/g, (w) => persianDigits.indexOf(w).toString())
}

/** Clean amount string, normalize Eastern Arabic numerals, and fix Windows IME duplication bug (typing ٣ producing 33) */
export function cleanAndNormalizeAmount(rawVal: string, prevVal: string = ''): string {
  const hasEasternArabic = /[٠-٩۰-۹]/.test(rawVal)
  const normalized = normalizeArabicNumerals(rawVal)
  let cleaned = normalized.replace(/[^0-9.]/g, '')

  // Fix Windows IME Eastern Arabic duplication bug
  if (hasEasternArabic && cleaned.length === prevVal.length + 2) {
    let diffStart = 0
    while (diffStart < prevVal.length && prevVal[diffStart] === cleaned[diffStart]) {
      diffStart++
    }
    const inserted = cleaned.slice(diffStart, diffStart + 2)
    if (inserted.length === 2 && inserted[0] === inserted[1] && inserted[0] >= '0' && inserted[0] <= '9') {
      cleaned = cleaned.slice(0, diffStart) + inserted[0] + cleaned.slice(diffStart + 2)
    }
  }

  const parts = cleaned.split('.')
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned
}

/** Get current device date-time formatted as local ISO string 'YYYY-MM-DDTHH:mm:ss' matching user's exact device time */
export function getLocalDeviceISOString(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
}

/** Safely parses a date string across ISO, SQLite 'YYYY-MM-DD HH:MM:SS', and custom formats */
export function parseDateSafe(dateInput: string | Date | undefined | null): Date {
  if (!dateInput) return new Date()
  if (dateInput instanceof Date) return dateInput
  const str = String(dateInput).trim()
  const normalized = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str
  const d = new Date(normalized)
  return isNaN(d.getTime()) ? new Date(str) : d
}

/** Format date into Arabic/Standard date string */
export function formatDate(dateStr: string, locale = 'ar-LY'): string {
  try {
    const d = parseDateSafe(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return dateStr
  }
}

/** Short number formatter for metric cards with active wallet currency */
export function formatShort(cents: number, symbol?: string): string {
  const amount = cents / 100
  const sym = symbol !== undefined ? symbol : getActiveWalletSymbol()
  if (amount >= 1_000_000) {
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(amount / 1_000_000)}M ${sym}`
  }
  if (amount >= 1_000) {
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(amount / 1_000)}K ${sym}`
  }
  return formatCurrency(cents, sym)
}

/** Filter transactions array by DateFilter mode (NONE, YEAR, MONTH, DAY, RANGE) */
export function filterTransactionsByDate<T extends { created_at: string }>(
  items: T[],
  filter?: { mode: string; year?: number | string; month?: number | string; date?: Date | string; from?: Date | string; to?: Date | string }
): T[] {
  if (!filter || filter.mode === 'NONE') return items

  return items.filter((tx) => {
    const txDate = parseDateSafe(tx.created_at)
    if (isNaN(txDate.getTime())) return true

    if (filter.mode === 'YEAR' && filter.year !== undefined && filter.year !== null) {
      return txDate.getFullYear() === Number(filter.year)
    }

    if (filter.mode === 'MONTH' && filter.year !== undefined && filter.month !== undefined && filter.year !== null && filter.month !== null) {
      return (
        txDate.getFullYear() === Number(filter.year) &&
        txDate.getMonth() === Number(filter.month)
      )
    }

    if (filter.mode === 'DAY' && filter.date) {
      const d = new Date(filter.date)
      if (isNaN(d.getTime())) return true
      return (
        txDate.getFullYear() === d.getFullYear() &&
        txDate.getMonth() === d.getMonth() &&
        txDate.getDate() === d.getDate()
      )
    }

    if (filter.mode === 'RANGE' && filter.from && filter.to) {
      const start = new Date(filter.from).setHours(0, 0, 0, 0)
      const end = new Date(filter.to).setHours(23, 59, 59, 999)
      const txTime = txDate.getTime()
      return txTime >= start && txTime <= end
    }

    return true
  })
}

/** Helper to format DateFilter into clean Arabic text string */
export function getDateFilterText(filter?: any): string {
  if (!filter || filter.mode === 'NONE') {
    return 'تقرير شامل لجميع الفترات'
  }

  if (filter.mode === 'YEAR' && filter.year) {
    return `الفترة: سنة ${filter.year}`
  }

  if (filter.mode === 'MONTH' && filter.year !== undefined && filter.month !== undefined) {
    const monthsList = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
    ]
    return `الفترة: شهر ${monthsList[filter.month]} ${filter.year}`
  }

  if (filter.mode === 'DAY' && filter.date) {
    try {
      const d = new Date(filter.date)
      const formatted = new Intl.DateTimeFormat('ar-LY', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(d)
      return `الفترة: يوم ${formatted}`
    } catch {
      return 'تقرير يومي'
    }
  }

  if (filter.mode === 'RANGE' && filter.from && filter.to) {
    try {
      const fromStr = new Intl.DateTimeFormat('ar-LY', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(filter.from))

      const toStr = new Intl.DateTimeFormat('ar-LY', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(filter.to))

      return `الفترة: من ${fromStr} إلى ${toStr}`
    } catch {
      return 'تقرير فترة محددة'
    }
  }

  return 'تقرير شامل لجميع الفترات'
}

