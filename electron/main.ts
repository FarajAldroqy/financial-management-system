import { app, BrowserWindow, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

app.setName('منظومة إدارة مالية')

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null

// ─── Database Setup ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any

function initDatabase() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3')
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'finance.db')

  // Migration safeguard: if database does not exist in current userData, check legacy folders
  if (!fs.existsSync(dbPath)) {
    try {
      const appData = app.getPath('appData')
      const legacyDirs = [
        path.join(appData, 'SallatAlkhair'),
        path.join(appData, 'sallat-alkhair'),
        path.join(appData, 'منتجع MJS للمعاملات المالية'),
      ]
      for (const legacyDir of legacyDirs) {
        const legacyDb = path.join(legacyDir, 'finance.db')
        if (fs.existsSync(legacyDb)) {
          if (!fs.existsSync(userDataPath)) {
            fs.mkdirSync(userDataPath, { recursive: true })
          }
          fs.copyFileSync(legacyDb, dbPath)
          if (fs.existsSync(legacyDb + '-wal')) {
            fs.copyFileSync(legacyDb + '-wal', dbPath + '-wal')
          }
          if (fs.existsSync(legacyDb + '-shm')) {
            fs.copyFileSync(legacyDb + '-shm', dbPath + '-shm')
          }
          console.log(`Migrated database from ${legacyDb} to ${dbPath}`)
          break
        }
      }
    } catch (migErr) {
      console.error('Failed checking legacy database paths:', migErr)
    }
  }

  db = new Database(dbPath)

  // Enable WAL mode & configure concurrency pragmas for high reliability
  try { db.pragma('journal_mode = WAL') } catch {}
  try { db.pragma('synchronous = NORMAL') } catch {}
  try { db.pragma('busy_timeout = 10000') } catch {}
  try { db.pragma('foreign_keys = ON') } catch {}
  try { db.pragma('temp_store = MEMORY') } catch {}

  // Create transactions table with all schema columns
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        client_name    TEXT    NOT NULL,
        type           TEXT    NOT NULL CHECK(type IN ('DEPOSIT', 'WITHDRAWAL')),
        subtype        TEXT    NOT NULL DEFAULT 'REGULAR',
        person_name    TEXT    NOT NULL DEFAULT '',
        person_names   TEXT    NOT NULL DEFAULT '',
        items          TEXT    NOT NULL DEFAULT '',
        amount_cents   BIGINT  NOT NULL,
        payment_method TEXT    NOT NULL DEFAULT 'نقداً',
        status         TEXT    NOT NULL DEFAULT 'COMPLETED',
        notes          TEXT    NOT NULL DEFAULT '',
        wallet_type    TEXT    NOT NULL DEFAULT 'LYD',
        is_pinned      INTEGER NOT NULL DEFAULT 0,
        is_archived    INTEGER NOT NULL DEFAULT 0,
        is_deleted     INTEGER NOT NULL DEFAULT 0,
        created_at     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS transaction_notes (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER NOT NULL UNIQUE,
        notes          TEXT    NOT NULL DEFAULT '',
        updated_at     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
      );
    `)
  } catch (e) {
    console.error('Failed to create transactions table:', e)
  }

  // Migration FIRST: check and add missing columns for existing database
  try {
    const tableInfo = db.pragma('table_info(transactions)') as { name: string }[]
    const colNames = new Set(tableInfo.map((col) => col.name))

    if (!colNames.has('payment_method')) {
      try { db.exec(`ALTER TABLE transactions ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'نقداً'`) } catch {}
    }
    if (!colNames.has('notes')) {
      try { db.exec(`ALTER TABLE transactions ADD COLUMN notes TEXT NOT NULL DEFAULT ''`) } catch {}
    }
    if (!colNames.has('subtype')) {
      try { db.exec(`ALTER TABLE transactions ADD COLUMN subtype TEXT NOT NULL DEFAULT 'REGULAR'`) } catch {}
    }
    if (!colNames.has('person_name')) {
      try { db.exec(`ALTER TABLE transactions ADD COLUMN person_name TEXT NOT NULL DEFAULT ''`) } catch {}
    }
    if (!colNames.has('person_names')) {
      try { db.exec(`ALTER TABLE transactions ADD COLUMN person_names TEXT NOT NULL DEFAULT ''`) } catch {}
    }
    if (!colNames.has('items')) {
      try { db.exec(`ALTER TABLE transactions ADD COLUMN items TEXT NOT NULL DEFAULT ''`) } catch {}
    }
    if (!colNames.has('wallet_type')) {
      try { db.exec(`ALTER TABLE transactions ADD COLUMN wallet_type TEXT NOT NULL DEFAULT 'LYD'`) } catch {}
    }
    if (!colNames.has('is_pinned')) {
      try { db.exec(`ALTER TABLE transactions ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0`) } catch {}
    }
    if (!colNames.has('is_archived')) {
      try { db.exec(`ALTER TABLE transactions ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0`) } catch {}
    }
    if (!colNames.has('is_deleted')) {
      try { db.exec(`ALTER TABLE transactions ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0`) } catch {}
    }
  } catch (e) {
    console.error('Migration error:', e)
  }

  // Performance Indexes AFTER columns are guaranteed to exist
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tx_list ON transactions(is_archived, is_pinned DESC, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tx_search ON transactions(client_name, type);
      CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(is_deleted, is_archived, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tx_wallet ON transactions(wallet_type, is_deleted, is_archived, created_at DESC);
    `)
  } catch (e) {
    console.error('Index creation error:', e)
  }
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

function registerIpcHandlers() {
  // POST /reset-database – clear all transactions and reset database
  ipcMain.handle('db:reset-database', () => {
    try {
      db.exec('DELETE FROM transactions')
      db.exec('VACUUM')
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // POST /restore-all-transactions – replace all transactions in SQLite for backup restoration
  ipcMain.handle('db:restore-all-transactions', (_event, txs: any[]) => {
    try {
      db.exec('DELETE FROM transactions')
      db.exec('DELETE FROM transaction_notes')
      const stmt = db.prepare(`
        INSERT INTO transactions (id, client_name, type, subtype, person_name, person_names, amount_cents, payment_method, status, notes, wallet_type, is_pinned, is_archived, is_deleted, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      const noteStmt = db.prepare(`
        INSERT OR REPLACE INTO transaction_notes (transaction_id, notes)
        VALUES (?, ?)
      `)

      const insertMany = db.transaction((items: any[]) => {
        for (const t of items) {
          const notesVal = t.notes || ''
          const personNamesStr = Array.isArray(t.person_names) ? JSON.stringify(t.person_names) : (t.person_names || '')
          stmt.run(
            t.id,
            t.client_name,
            t.type,
            t.subtype || 'REGULAR',
            t.person_name || '',
            personNamesStr,
            t.amount_cents,
            t.payment_method || 'نقداً',
            t.status || 'COMPLETED',
            notesVal,
            t.wallet_type || 'LYD',
            t.is_pinned ?? 0,
            t.is_archived ?? 0,
            t.is_deleted ?? 0,
            t.created_at || new Date().toISOString()
          )
          if (notesVal) {
            try { noteStmt.run(t.id, notesVal) } catch {}
          }
        }
      })

      insertMany(txs || [])
      return { success: true, restoredCount: txs?.length ?? 0 }
    } catch (err: any) {
      console.error('Failed to restore all transactions:', err)
      return { success: false, error: err.message }
    }
  })

  // POST /auto-backup-completed – renderer completed auto backup on window close
  ipcMain.handle('app:auto-backup-completed', () => {
    isQuitting = true
    if (win && !win.isDestroyed()) {
      win.destroy()
    }
    return { success: true }
  })

  // GET /transactions – paginated + searchable + sorted by is_pinned DESC
  ipcMain.handle('db:get-transactions', (_event, params: {
    page?: number
    pageSize?: number
    search?: string
    type?: string
    status?: 'ACTIVE' | 'ARCHIVED' | 'TRASH' | 'ALL_NON_DELETED' | 'ALL'
    wallet_type?: string
  }) => {
    try {
      const page = params?.page ?? 1
      const pageSize = params?.pageSize ?? 10
      const search = params?.search ?? ''
      const type = params?.type ?? 'ALL'
      const status = params?.status ?? 'ACTIVE'
      const offset = (page - 1) * pageSize

      let whereClause = 'WHERE 1=1'
      const args: (string | number)[] = []

      // Scope to wallet unless full export/backup without wallet_type is requested
      if (status !== 'ALL' || params?.wallet_type) {
        const walletType = params?.wallet_type || 'LYD'
        whereClause += ' AND wallet_type = ?'
        args.push(walletType)
      }

      if (status === 'ACTIVE') {
        whereClause += ' AND is_deleted = 0 AND is_archived = 0'
      } else if (status === 'ARCHIVED') {
        whereClause += ' AND is_deleted = 0 AND is_archived = 1'
      } else if (status === 'TRASH') {
        whereClause += ' AND is_deleted = 1'
      } else if (status === 'ALL_NON_DELETED') {
        whereClause += ' AND is_deleted = 0'
      } else if (status === 'ALL') {
        // No status filter: return ALL rows
      }

      if (search) {
        const sanitized = search.replace(/[%_]/g, '\\$&')
        whereClause += " AND client_name LIKE ? ESCAPE '\\'"
        args.push(`%${sanitized}%`)
      }
      if (type !== 'ALL') {
        whereClause += ' AND type = ?'
        args.push(type)
      }

      const total = (db.prepare(
        `SELECT COUNT(*) as c FROM transactions ${whereClause}`
      ).get(...args) as { c: number }).c

      const rawData = db.prepare(
        `SELECT * FROM transactions ${whereClause} ORDER BY is_pinned DESC, created_at DESC LIMIT ? OFFSET ?`
      ).all(...args, pageSize, offset) as any[]

      const data = rawData.map((t) => {
        let person_names: string[] | undefined = undefined
        if (t.person_names) {
          try {
            person_names = JSON.parse(t.person_names)
          } catch {
            person_names = [t.person_names]
          }
        }
        let items: any[] | undefined = undefined
        if (t.items) {
          try {
            items = JSON.parse(t.items)
          } catch {
            items = undefined
          }
        }
        return { ...t, person_names, items }
      })

      return { data, total, page, pageSize }
    } catch (err: any) {
      console.error('Failed to get transactions:', err)
      return { data: [], total: 0, page: 1, pageSize: 10 }
    }
  })

  // POST /transactions – create new
  ipcMain.handle('db:create-transaction', (_event, payload: {
    client_name: string
    type: string
    subtype?: string
    person_name?: string
    person_names?: string[]
    items?: any[]
    amount_cents: number
    payment_method?: string
    notes?: string
    status?: string
    wallet_type?: string
    created_at?: string
  }) => {
    try {
      const paymentMethod = payload.payment_method || 'نقداً'
      const status = payload.status || 'COMPLETED'
      const notes = (payload.notes || '').trim()
      const subtype = payload.subtype || 'REGULAR'
      const personName = payload.person_name || ''
      const personNamesStr = payload.person_names ? JSON.stringify(payload.person_names) : ''
      const itemsStr = payload.items ? JSON.stringify(payload.items) : ''
      const walletType = payload.wallet_type || 'LYD'

      // Self-healing migration check for all columns
      try {
        const info = db.pragma('table_info(transactions)') as { name: string }[]
        const colNames = new Set(info.map((c) => c.name))
        if (!colNames.has('payment_method')) {
          try { db.exec(`ALTER TABLE transactions ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'نقداً'`) } catch {}
        }
        if (!colNames.has('notes')) {
          try { db.exec(`ALTER TABLE transactions ADD COLUMN notes TEXT NOT NULL DEFAULT ''`) } catch {}
        }
        if (!colNames.has('subtype')) {
          try { db.exec(`ALTER TABLE transactions ADD COLUMN subtype TEXT NOT NULL DEFAULT 'REGULAR'`) } catch {}
        }
        if (!colNames.has('person_name')) {
          try { db.exec(`ALTER TABLE transactions ADD COLUMN person_name TEXT NOT NULL DEFAULT ''`) } catch {}
        }
        if (!colNames.has('person_names')) {
          try { db.exec(`ALTER TABLE transactions ADD COLUMN person_names TEXT NOT NULL DEFAULT ''`) } catch {}
        }
        if (!colNames.has('items')) {
          try { db.exec(`ALTER TABLE transactions ADD COLUMN items TEXT NOT NULL DEFAULT ''`) } catch {}
        }
        if (!colNames.has('wallet_type')) {
          try { db.exec(`ALTER TABLE transactions ADD COLUMN wallet_type TEXT NOT NULL DEFAULT 'LYD'`) } catch {}
        }
        if (!colNames.has('is_pinned')) {
          try { db.exec(`ALTER TABLE transactions ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0`) } catch {}
        }
        if (!colNames.has('is_archived')) {
          try { db.exec(`ALTER TABLE transactions ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0`) } catch {}
        }
        if (!colNames.has('is_deleted')) {
          try { db.exec(`ALTER TABLE transactions ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0`) } catch {}
        }
      } catch {}

      // Capture exact local device time
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const defaultLocalCreatedAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
      const createdAt = payload.created_at || defaultLocalCreatedAt

      let result: any
      try {
        const stmt = db.prepare(`
          INSERT INTO transactions (client_name, type, subtype, person_name, person_names, items, amount_cents, payment_method, status, notes, wallet_type, is_pinned, is_archived, is_deleted, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)
        `)
        result = stmt.run(
          payload.client_name,
          payload.type,
          subtype,
          personName,
          personNamesStr,
          itemsStr,
          payload.amount_cents,
          paymentMethod,
          status,
          notes,
          walletType,
          createdAt
        )
      } catch {
        const stmtFallback = db.prepare(`
          INSERT INTO transactions (client_name, type, amount_cents, payment_method, status, wallet_type, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        result = stmtFallback.run(
          payload.client_name,
          payload.type,
          payload.amount_cents,
          paymentMethod,
          status,
          walletType,
          createdAt
        )
      }

      if (notes && result?.lastInsertRowid) {
        try {
          db.prepare('INSERT OR REPLACE INTO transaction_notes (transaction_id, notes) VALUES (?, ?)').run(result.lastInsertRowid, notes)
        } catch {}
      }

      const createdRow: any = db.prepare('SELECT * FROM transactions WHERE id = ?').get(result.lastInsertRowid)
      if (createdRow && createdRow.person_names) {
        try {
          createdRow.person_names = JSON.parse(createdRow.person_names)
        } catch {
          createdRow.person_names = [createdRow.person_names]
        }
      }
      if (createdRow && createdRow.items) {
        try {
          createdRow.items = JSON.parse(createdRow.items)
        } catch {
          createdRow.items = undefined
        }
      }
      return createdRow
    } catch (err: any) {
      console.error('Failed to create transaction:', err)
      throw err
    }
  })

  // PUT /transactions – full transaction update including client_name, type, amount, subtype, person_names, items, date, notes, etc.
  ipcMain.handle('db:update-transaction', (_event, payload: {
    id: number
    client_name?: string
    type?: string
    subtype?: string
    person_name?: string
    person_names?: string[]
    items?: any[]
    amount_cents?: number
    payment_method?: string
    notes?: string
    status?: string
    wallet_type?: string
    created_at?: string
  }) => {
    try {
      if (!payload.id) {
        return { success: false, error: 'معرف المعاملة مطلوب' }
      }

      const existing: any = db.prepare('SELECT * FROM transactions WHERE id = ?').get(payload.id)
      if (!existing) {
        return { success: false, error: 'المعاملة غير موجودة' }
      }

      const clientName = payload.client_name !== undefined ? payload.client_name.trim() : existing.client_name
      if (!clientName) {
        return { success: false, error: 'اسم الجهة مطلوب' }
      }

      const type = payload.type !== undefined ? payload.type : existing.type
      if (type !== 'DEPOSIT' && type !== 'WITHDRAWAL') {
        return { success: false, error: 'نوع المعاملة يجب أن يكون إيداع أو سحب' }
      }

      const subtype = payload.subtype !== undefined ? payload.subtype : (existing.subtype || 'REGULAR')
      const personName = payload.person_name !== undefined ? payload.person_name.trim() : (existing.person_name || '')
      const personNamesStr = payload.person_names !== undefined ? JSON.stringify(payload.person_names) : (existing.person_names || '')
      const itemsStr = payload.items !== undefined ? JSON.stringify(payload.items) : (existing.items || '')
      
      const rawAmount = payload.amount_cents !== undefined ? payload.amount_cents : existing.amount_cents
      const amountCents = Math.round(Number(rawAmount))
      if (isNaN(amountCents) || amountCents <= 0) {
        return { success: false, error: 'المبلغ المالي يجب أن يكون رقماً صحيحاً أكبر من الصفر' }
      }

      const paymentMethod = payload.payment_method !== undefined ? payload.payment_method : (existing.payment_method || 'نقداً')
      const status = payload.status !== undefined ? payload.status : (existing.status || 'COMPLETED')
      const notes = payload.notes !== undefined ? payload.notes.trim() : (existing.notes || '')
      const walletType = payload.wallet_type !== undefined ? payload.wallet_type : (existing.wallet_type || 'LYD')
      if (walletType !== 'LYD' && walletType !== 'USD') {
        return { success: false, error: 'نوع المحفظة غير صالح' }
      }
      const createdAt = payload.created_at !== undefined ? payload.created_at : existing.created_at

      const executeAtomicUpdate = db.transaction(() => {
        db.prepare(`
          UPDATE transactions
          SET client_name = ?,
              type = ?,
              subtype = ?,
              person_name = ?,
              person_names = ?,
              items = ?,
              amount_cents = ?,
              payment_method = ?,
              status = ?,
              notes = ?,
              wallet_type = ?,
              created_at = ?
          WHERE id = ?
        `).run(
          clientName,
          type,
          subtype,
          personName,
          personNamesStr,
          itemsStr,
          amountCents,
          paymentMethod,
          status,
          notes,
          walletType,
          createdAt,
          payload.id
        )

        try {
          if (notes) {
            db.prepare(`
              INSERT INTO transaction_notes (transaction_id, notes, updated_at)
              VALUES (?, ?, datetime('now'))
              ON CONFLICT(transaction_id) DO UPDATE SET notes = excluded.notes, updated_at = datetime('now')
            `).run(payload.id, notes)
          } else {
            db.prepare('DELETE FROM transaction_notes WHERE transaction_id = ?').run(payload.id)
          }
        } catch {}
      })

      executeAtomicUpdate()

      const updatedRow: any = db.prepare('SELECT * FROM transactions WHERE id = ?').get(payload.id)
      if (updatedRow && updatedRow.person_names) {
        try {
          updatedRow.person_names = JSON.parse(updatedRow.person_names)
        } catch {
          updatedRow.person_names = [updatedRow.person_names]
        }
      }
      if (updatedRow && updatedRow.items) {
        try {
          updatedRow.items = JSON.parse(updatedRow.items)
        } catch {
          updatedRow.items = undefined
        }
      }

      return { success: true, data: updatedRow }
    } catch (err: any) {
      console.error('Failed to update transaction:', err)
      return { success: false, error: err.message }
    }
  })

  // POST /update-transaction-notes – edit or fill notes for an existing transaction
  ipcMain.handle('db:update-transaction-notes', (_event, payload: { id: number; notes: string }) => {
    try {
      const trimmedNotes = (payload.notes || '').trim()

      // Update main transactions table
      db.prepare('UPDATE transactions SET notes = ? WHERE id = ?').run(trimmedNotes, payload.id)

      // Update relational transaction_notes table
      try {
        db.prepare(`
          INSERT INTO transaction_notes (transaction_id, notes, updated_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT(transaction_id) DO UPDATE SET notes = excluded.notes, updated_at = datetime('now')
        `).run(payload.id, trimmedNotes)
      } catch {}

      return { success: true, id: payload.id, notes: trimmedNotes }
    } catch (err: any) {
      console.error('Failed to update transaction notes:', err)
      return { success: false, error: err.message }
    }
  })

  // POST /toggle-pin – toggle row pinned status
  ipcMain.handle('db:toggle-pin', (_event, id: number) => {
    try {
      const current = db.prepare('SELECT is_pinned FROM transactions WHERE id = ?').get(id) as { is_pinned: number } | undefined
      const newStatus = current && current.is_pinned === 1 ? 0 : 1
      db.prepare('UPDATE transactions SET is_pinned = ? WHERE id = ?').run(newStatus, id)
      return { success: true, is_pinned: newStatus }
    } catch (err: any) {
      console.error('Failed to toggle pin:', err)
      return { success: false, is_pinned: 0 }
    }
  })

  // DELETE /transactions – soft delete or permanent delete
  ipcMain.handle('db:delete-transaction', (_event, id: number, permanent?: boolean) => {
    try {
      if (permanent) {
        db.prepare('DELETE FROM transactions WHERE id = ?').run(id)
      } else {
        db.prepare('UPDATE transactions SET is_deleted = 1 WHERE id = ?').run(id)
      }
      return { success: true }
    } catch (err: any) {
      console.error('Failed to delete transaction:', err)
      return { success: false, error: err.message }
    }
  })

  // POST /restore-transaction – restore soft deleted transaction
  ipcMain.handle('db:restore-transaction', (_event, id: number) => {
    try {
      db.prepare('UPDATE transactions SET is_deleted = 0, is_archived = 0 WHERE id = ?').run(id)
      return { success: true }
    } catch (err: any) {
      console.error('Failed to restore transaction:', err)
      return { success: false, error: err.message }
    }
  })

  // POST /archive-transaction – archive transaction
  ipcMain.handle('db:archive-transaction', (_event, id: number) => {
    try {
      const current = db.prepare('SELECT is_archived FROM transactions WHERE id = ?').get(id) as { is_archived: number } | undefined
      const newStatus = current && current.is_archived === 1 ? 0 : 1
      db.prepare('UPDATE transactions SET is_archived = ? WHERE id = ? AND is_deleted = 0').run(newStatus, id)
      return { success: true, is_archived: newStatus }
    } catch (err: any) {
      console.error('Failed to archive transaction:', err)
      return { success: false, is_archived: 0 }
    }
  })

  // POST /delete-entity-transactions – delete all entity transactions for this wallet
  ipcMain.handle('db:delete-entity-transactions', (_event, clientName: string, permanent?: boolean, walletType?: string) => {
    try {
      const wt = walletType || 'LYD'
      if (permanent) {
        db.prepare('DELETE FROM transactions WHERE client_name = ? AND wallet_type = ?').run(clientName, wt)
      } else {
        db.prepare('UPDATE transactions SET is_deleted = 1 WHERE client_name = ? AND wallet_type = ?').run(clientName, wt)
      }
      return { success: true }
    } catch (err: any) {
      console.error('Failed to delete entity transactions:', err)
      return { success: false, error: err.message }
    }
  })

  // --- BATCH IPC HANDLERS FOR LIGHTNING-FAST BULK OPERATIONS ---
  ipcMain.handle('db:delete-transactions-batch', (_event, ids: number[], permanent?: boolean) => {
    try {
      if (!Array.isArray(ids) || ids.length === 0) return { success: true, count: 0 }
      const chunkSize = 400
      const runBatch = db.transaction((batchIds: number[]) => {
        for (let i = 0; i < batchIds.length; i += chunkSize) {
          const chunk = batchIds.slice(i, i + chunkSize)
          const placeholders = chunk.map(() => '?').join(',')
          if (permanent) {
            db.prepare(`DELETE FROM transactions WHERE id IN (${placeholders})`).run(...chunk)
          } else {
            db.prepare(`UPDATE transactions SET is_deleted = 1 WHERE id IN (${placeholders})`).run(...chunk)
          }
        }
      })
      runBatch(ids)
      return { success: true, count: ids.length }
    } catch (err: any) {
      console.error('Failed batch delete transactions:', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('db:archive-transactions-batch', (_event, ids: number[]) => {
    try {
      if (!Array.isArray(ids) || ids.length === 0) return { success: true, count: 0 }
      const chunkSize = 400
      const runBatch = db.transaction((batchIds: number[]) => {
        for (let i = 0; i < batchIds.length; i += chunkSize) {
          const chunk = batchIds.slice(i, i + chunkSize)
          const placeholders = chunk.map(() => '?').join(',')
          db.prepare(`UPDATE transactions SET is_archived = 1 WHERE id IN (${placeholders}) AND is_deleted = 0`).run(...chunk)
        }
      })
      runBatch(ids)
      return { success: true, count: ids.length }
    } catch (err: any) {
      console.error('Failed batch archive transactions:', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('db:restore-transactions-batch', (_event, ids: number[]) => {
    try {
      if (!Array.isArray(ids) || ids.length === 0) return { success: true, count: 0 }
      const chunkSize = 400
      const runBatch = db.transaction((batchIds: number[]) => {
        for (let i = 0; i < batchIds.length; i += chunkSize) {
          const chunk = batchIds.slice(i, i + chunkSize)
          const placeholders = chunk.map(() => '?').join(',')
          db.prepare(`UPDATE transactions SET is_deleted = 0, is_archived = 0 WHERE id IN (${placeholders})`).run(...chunk)
        }
      })
      runBatch(ids)
      return { success: true, count: ids.length }
    } catch (err: any) {
      console.error('Failed batch restore transactions:', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('db:delete-entities-batch', (_event, clientNames: string[], permanent?: boolean, walletType?: string) => {
    try {
      if (!Array.isArray(clientNames) || clientNames.length === 0) return { success: true, count: 0 }
      const wt = walletType || 'LYD'
      const chunkSize = 400
      const runBatch = db.transaction((names: string[]) => {
        for (let i = 0; i < names.length; i += chunkSize) {
          const chunk = names.slice(i, i + chunkSize)
          const placeholders = chunk.map(() => '?').join(',')
          if (permanent) {
            db.prepare(`DELETE FROM transactions WHERE client_name IN (${placeholders}) AND wallet_type = ?`).run(...chunk, wt)
          } else {
            db.prepare(`UPDATE transactions SET is_deleted = 1 WHERE client_name IN (${placeholders}) AND wallet_type = ?`).run(...chunk, wt)
          }
        }
      })
      runBatch(clientNames)
      return { success: true, count: clientNames.length }
    } catch (err: any) {
      console.error('Failed batch delete entities:', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('db:restore-entities-batch', (_event, clientNames: string[], walletType?: string) => {
    try {
      if (!Array.isArray(clientNames) || clientNames.length === 0) return { success: true, count: 0 }
      const wt = walletType || 'LYD'
      const chunkSize = 400
      const runBatch = db.transaction((names: string[]) => {
        for (let i = 0; i < names.length; i += chunkSize) {
          const chunk = names.slice(i, i + chunkSize)
          const placeholders = chunk.map(() => '?').join(',')
          db.prepare(`UPDATE transactions SET is_deleted = 0, is_archived = 0 WHERE client_name IN (${placeholders}) AND wallet_type = ?`).run(...chunk, wt)
        }
      })
      runBatch(clientNames)
      return { success: true, count: clientNames.length }
    } catch (err: any) {
      console.error('Failed batch restore entities:', err)
      return { success: false, error: err.message }
    }
  })

  // POST /restore-entity-transactions – restore all entity transactions for this wallet
  ipcMain.handle('db:restore-entity-transactions', (_event, clientName: string, walletType?: string) => {
    try {
      const wt = walletType || 'LYD'
      db.prepare('UPDATE transactions SET is_deleted = 0, is_archived = 0 WHERE client_name = ? AND wallet_type = ?').run(clientName, wt)
      return { success: true }
    } catch (err: any) {
      console.error('Failed to restore entity transactions:', err)
      return { success: false, error: err.message }
    }
  })

  // POST /update-entity-name – rename entity client_name across all transactions for this wallet
  ipcMain.handle('db:update-entity-name', (_event, params: { oldName: string; newName: string; walletType?: string }) => {
    try {
      if (!params.oldName || !params.newName) return { success: false, message: 'بيانات غير مكتملة' }
      const wt = params.walletType || 'LYD'
      const stmt = db.prepare('UPDATE transactions SET client_name = ? WHERE client_name = ? AND wallet_type = ?')
      const res = stmt.run(params.newName.trim(), params.oldName.trim(), wt)
      return { success: true, updatedCount: res.changes }
    } catch (err: any) {
      console.error('Failed to update entity name:', err)
      return { success: false, message: err.message }
    }
  })

  // GET /stats – aggregated balances across all non-deleted transactions for the wallet
  ipcMain.handle('db:get-stats', (_event, params?: { wallet_type?: string }) => {
    try {
      const walletType = params?.wallet_type || 'LYD'
      const deposits = db.prepare(
        `SELECT COALESCE(SUM(amount_cents),0) as total, COUNT(*) as cnt
         FROM transactions WHERE wallet_type = ? AND type='DEPOSIT' AND is_deleted=0`
      ).get(walletType) as { total: number; cnt: number }

      const withdrawals = db.prepare(
        `SELECT COALESCE(SUM(amount_cents),0) as total, COUNT(*) as cnt
         FROM transactions WHERE wallet_type = ? AND type='WITHDRAWAL' AND is_deleted=0`
      ).get(walletType) as { total: number; cnt: number }

      const activeAccounts = (db.prepare(
        `SELECT COUNT(DISTINCT client_name) as cnt FROM transactions WHERE wallet_type = ? AND is_deleted=0`
      ).get(walletType) as { cnt: number }).cnt

      return {
        total_balance_cents: deposits.total - withdrawals.total,
        total_deposits_cents: deposits.total,
        total_withdrawals_cents: withdrawals.total,
        active_accounts: activeAccounts,
        deposit_count: deposits.cnt,
        withdrawal_count: withdrawals.cnt,
      }
    } catch (err: any) {
      console.error('Failed to get stats:', err)
      return {
        total_balance_cents: 0,
        total_deposits_cents: 0,
        total_withdrawals_cents: 0,
        active_accounts: 0,
        deposit_count: 0,
        withdrawal_count: 0,
      }
    }
  })

  // GET /chart-data – aggregated daily transactions for Recharts for the wallet
  ipcMain.handle('db:get-chart-data', (_event, params: { timeframe?: '7d' | '30d' | '3m'; wallet_type?: string }) => {
    try {
      const timeframe = params?.timeframe ?? '3m'
      const walletType = params?.wallet_type || 'LYD'
      const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90

      const rows = db.prepare(`
        SELECT
          strftime('%Y-%m-%d', created_at) as date_str,
          COALESCE(SUM(CASE WHEN type = 'DEPOSIT' THEN amount_cents ELSE 0 END), 0) as deposits_cents,
          COALESCE(SUM(CASE WHEN type = 'WITHDRAWAL' THEN amount_cents ELSE 0 END), 0) as withdrawals_cents
        FROM transactions
        WHERE wallet_type = ? AND created_at >= date('now', '-' || ? || ' days') AND is_deleted = 0
        GROUP BY strftime('%Y-%m-%d', created_at)
        ORDER BY date_str ASC
      `).all(walletType, days) as { date_str: string; deposits_cents: number; withdrawals_cents: number }[]

      const dataMap = new Map<string, { deposits_cents: number; withdrawals_cents: number }>()
      for (const r of rows) {
        dataMap.set(r.date_str, {
          deposits_cents: r.deposits_cents,
          withdrawals_cents: r.withdrawals_cents,
        })
      }

      const result = []
      const now = new Date()
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now)
        d.setDate(d.getDate() - i)
        const dateKey = d.toISOString().slice(0, 10)

        const entry = dataMap.get(dateKey)
        const deposits_cents = entry ? entry.deposits_cents : 0
        const withdrawals_cents = entry ? entry.withdrawals_cents : 0

        const dateLabel = new Intl.DateTimeFormat('ar-LY', {
          day: 'numeric',
          month: 'short',
        }).format(d)

        result.push({
          date: dateKey,
          dateLabel,
          deposits: deposits_cents / 100,
          withdrawals: withdrawals_cents / 100,
          deposits_cents,
          withdrawals_cents,
        })
      }

      return result
    } catch (err: any) {
      console.error('Failed to get chart data:', err)
      return []
    }
  })
}

let isQuitting = false

function createWindow() {
  win = new BrowserWindow({
    title: 'منظومة إدارة مالية',
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 16 },
    autoHideMenuBar: true,
    icon: path.join(process.env.VITE_PUBLIC!, 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setMenu(null)
  win.center()

  // Intercept window close to trigger auto-backup in renderer before exit
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      if (win && !win.isDestroyed()) {
        win.webContents.send('app:request-auto-backup')
      }
      // Safety fallback timeout (2.5s) if renderer is un-responsive
      setTimeout(() => {
        isQuitting = true
        if (win && !win.isDestroyed()) {
          win.destroy()
        }
      }, 2500)
    }
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date()).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  initDatabase()
  registerIpcHandlers()
  createWindow()
})
