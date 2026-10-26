import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Printer,
  Download,
  Image as ImageIcon,
  Calculator,
  Bold,
  Italic,
  AlignRight,
  AlignCenter,
  AlignLeft,
  Save,
  Check,
  FolderOpen,
  ChevronDown,
  Layers,
  FileText,
  Type,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Sliders,
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  Combine,
  Split,
  Eraser,
  Copy,
  FolderPlus,
  Folder,
  FolderTree,
  Edit3,
  FolderInput,
  Search,
  MoreVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { exportInvoiceToExcel, exportInvoiceToCsv } from './excelExporter'
import { useWallet } from '@/context/WalletContext'

// Color palettes for styling cells and columns independently
const COLOR_PALETTES = [
  { name: 'افتراضي (أبيض)', bg: '#ffffff', text: '#0f172a' },
  { name: 'رمادي ناعم', bg: '#f1f5f9', text: '#1e293b' },
  { name: 'أزرق سماوي', bg: '#e0f2fe', text: '#0369a1' },
  { name: 'زمردي راقي', bg: '#dcfce7', text: '#15803d' },
  { name: 'بنفسجي هادئ', bg: '#f3e8ff', text: '#7e22ce' },
  { name: 'أصفر كهرماني', bg: '#fef3c7', text: '#b45309' },
  { name: 'وردي أنيق', bg: '#ffe4e6', text: '#be123c' },
  { name: 'كحلي داكن', bg: '#1e293b', text: '#ffffff' },
]

export interface ColumnDef {
  id: string
  header: string
  align: 'right' | 'center' | 'left'
  width?: string
  bgColor?: string
  textColor?: string
}

export interface CellData {
  value: string
  formula?: 'SUM_COL' | 'SUM_ROW' | 'PRODUCT' | 'NONE'
  bold?: boolean
  italic?: boolean
  bgColor?: string
  textColor?: string
  align?: 'right' | 'center' | 'left'
  colSpan?: number
  mergedInto?: { rowId: string; colId: string }
  imageUrl?: string
  imageHeight?: number
  imageWidth?: number
}

export interface RowDef {
  id: string
  cells: Record<string, CellData>
}

export type SectionType =
  | 'header'
  | 'client'
  | 'grid'
  | 'summary'
  | 'notes'
  | 'terms'
  | 'signatures'
  | 'custom'

export interface InvoiceSection {
  id: string
  type: SectionType
  title: string
  visible: boolean
  content?: string
}

export interface CustomField {
  id: string
  label: string
  value: string
}

export interface CustomSummaryItem {
  id: string
  label: string
  amount: number
  type: 'add' | 'subtract'
}

export interface SignatureItem {
  id: string
  label: string
  type: 'sign' | 'stamp'
}

export interface InvoiceState {
  // Company & Header
  companyName: string
  showCompanyName: boolean
  companySubtitle: string
  showCompanySubtitle: boolean
  invoiceTitle: string
  invoiceNumberLabel: string
  invoiceNumber: string
  showInvoiceNumber: boolean
  invoiceDateLabel: string
  invoiceDate: string
  showInvoiceDate: boolean
  showDueDate: boolean
  dueDateLabel: string
  dueDate: string
  showTaxNumber: boolean
  taxNumberLabel: string
  taxNumber: string
  logoUrl?: string
  logoAlign: 'right' | 'center' | 'left'
  logoSize: number

  // Client Details
  clientHeaderLabel: string
  clientName: string
  showClientPhone: boolean
  clientPhoneLabel: string
  clientPhone: string
  showClientAddress: boolean
  clientAddressLabel: string
  clientAddress: string
  customClientFields: CustomField[]

  // Currency & Table
  currencySymbol: string
  columns: ColumnDef[]
  rows: RowDef[]

  // Summary fine-grained
  showSubtotal: boolean
  subtotalLabel: string
  customSubtotal?: number | string | null
  showDiscount: boolean
  discountLabel: string
  discount: number
  showTax: boolean
  taxLabel: string
  taxRate: number
  customSummaryItems: CustomSummaryItem[]
  grandTotalLabel: string
  customGrandTotal?: number | string | null

  // Notes & Terms
  notesTitle: string
  notes: string
  termsTitle: string
  terms: string

  // Signatures
  signaturesList: SignatureItem[]

  // Sections order
  sections: InvoiceSection[]
}

export interface InvoiceFolder {
  id: string
  name: string
  createdAt: string
  color?: string
}

export interface SavedInvoice {
  id: string
  title: string
  date: string
  data: InvoiceState
  folderId?: string
}

// Initial template generator
const createInitialState = (currency = 'د.ل'): InvoiceState => ({
  companyName: 'شركة الإنجاز للخدمات العامة والتوريدات',
  showCompanyName: true,
  companySubtitle: 'إدارة العمليات المالية والمقاولات والتجارة العامة',
  showCompanySubtitle: true,
  invoiceTitle: 'فاتورة سحب وتوريد',
  invoiceNumberLabel: 'رقم الفاتورة',
  invoiceNumber: 'INV-' + Math.floor(1000 + Math.random() * 9000),
  showInvoiceNumber: true,
  invoiceDateLabel: 'التاريخ',
  invoiceDate: new Date().toISOString().split('T')[0],
  showInvoiceDate: true,
  showDueDate: false,
  dueDateLabel: 'تاريخ الاستحقاق',
  dueDate: '',
  showTaxNumber: true,
  taxNumberLabel: 'الرقم الضريبي / القيد التجاري',
  taxNumber: '1029384756',
  logoUrl: '',
  logoAlign: 'right',
  logoSize: 75,

  clientHeaderLabel: 'محررة إلى السيد / الجهة',
  clientName: 'شركة النماء للتقنية والاستثمار',
  showClientPhone: true,
  clientPhoneLabel: 'رقم الهاتف',
  clientPhone: '091-2345678',
  showClientAddress: true,
  clientAddressLabel: 'العنوان',
  clientAddress: 'طرابلس - طريق الشط، مجمع الأبراج',
  customClientFields: [],

  currencySymbol: currency,
  columns: [
    { id: 'c_index', header: '#', align: 'center', width: '50px' },
    { id: 'c_desc', header: 'بيان الصنف / الخدمة', align: 'right', width: '45%' },
    { id: 'c_qty', header: 'الكمية', align: 'center', width: '15%' },
    { id: 'c_price', header: 'سعر الوحدة', align: 'center', width: '20%' },
    { id: 'c_total', header: 'الإجمالي', align: 'center', width: '20%' },
  ],
  rows: [
    {
      id: 'r_1',
      cells: {
        c_index: { value: '1', align: 'center' },
        c_desc: { value: 'توريد وتركيب أجهزة وخوادم رئيسية', align: 'right' },
        c_qty: { value: '2', align: 'center' },
        c_price: { value: '850.00', align: 'center' },
        c_total: { value: '1700.00', formula: 'PRODUCT', align: 'center', bold: true },
      },
    },
    {
      id: 'r_2',
      cells: {
        c_index: { value: '2', align: 'center' },
        c_desc: { value: 'أعمال تمديد وصيانة شبكات داخلية', align: 'right' },
        c_qty: { value: '4', align: 'center' },
        c_price: { value: '150.00', align: 'center' },
        c_total: { value: '600.00', formula: 'PRODUCT', align: 'center', bold: true },
      },
    },
    {
      id: 'r_3',
      cells: {
        c_index: { value: '3', align: 'center' },
        c_desc: { value: 'جلسات دعم فني وبرمجة متقدمة', align: 'right' },
        c_qty: { value: '1', align: 'center' },
        c_price: { value: '300.00', align: 'center' },
        c_total: { value: '300.00', formula: 'PRODUCT', align: 'center', bold: true },
      },
    },
  ],

  showSubtotal: true,
  subtotalLabel: 'المجموع الفرعي',
  customSubtotal: null,
  showDiscount: true,
  discountLabel: 'الخصم الممنوح',
  discount: 50,
  showTax: false,
  taxLabel: 'ضريبة القيمة المضافة',
  taxRate: 15,
  customSummaryItems: [],
  grandTotalLabel: 'المبلغ الإجمالي النهائي',
  customGrandTotal: null,

  notesTitle: 'ملاحظات وشروط الدفع',
  notes: 'الدفع يتم بموجب صك مصدق أو تحويل مصرفي معتمد خلال 15 يوماً من تاريخ الفاتورة.',
  termsTitle: 'شروط الاسترجاع والضمان',
  terms: 'البضاعة المسلمة لا ترد بعد فحصها واعتمادها من قبل مندوب الاستلام.',

  signaturesList: [
    { id: 'sig_1', label: 'توقيع المدير المالي', type: 'sign' },
    { id: 'sig_2', label: 'ختم الشركة / المؤسسة', type: 'stamp' },
    { id: 'sig_3', label: 'توقيع المستلم / العميل', type: 'sign' },
  ],

  sections: [
    { id: 'sec_header', type: 'header', title: 'ترويسة الفاتورة ومعلومات الشركة', visible: true },
    { id: 'sec_client', type: 'client', title: 'بيانات العميل والجهة المستلمة', visible: true },
    { id: 'sec_grid', type: 'grid', title: 'جدول الأصناف والبيانات المالية', visible: true },
    { id: 'sec_summary', type: 'summary', title: 'ملخص الحسابات والإجمالي', visible: true },
    { id: 'sec_notes', type: 'notes', title: 'ملاحظات وشروط الدفع', visible: true },
    { id: 'sec_terms', type: 'terms', title: 'شروط الاسترجاع والضمان', visible: true },
    { id: 'sec_signatures', type: 'signatures', title: 'التوقيعات والختم المعتمد', visible: true },
  ],
})

export function ExcelInvoiceBuilder() {
  const { activeWalletMeta } = useWallet()
  const currentSymbol = activeWalletMeta?.symbol || 'د.ل'

  // Invoice state
  const [invoice, setInvoice] = useState<InvoiceState>(() => createInitialState(currentSymbol))

  // Multi-cell selection state
  const [selectedCells, setSelectedCells] = useState<Array<{ rowId: string; colId: string }>>([])
  const [selectionAnchor, setSelectionAnchor] = useState<{ rowId: string; colId: string } | null>(null)
  const [isMouseDownOnCells, setIsMouseDownOnCells] = useState(false)

  // Column selection (independent from cells)
  const [selectedCol, setSelectedCol] = useState<string | null>(null)

  // Drag state for invoice sections
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null)
  const [dragOverSectionIndex, setDragOverSectionIndex] = useState<number | null>(null)

  // Drag state for table rows
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null)
  const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null)

  // Modals state
  const [savedInvoicesOpen, setSavedInvoicesOpen] = useState(false)
  const [savedInvoices, setSavedInvoices] = useState<SavedInvoice[]>([])
  const [folders, setFolders] = useState<InvoiceFolder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all') // 'all' | 'root' | folderId
  const [searchInvoiceTerm, setSearchInvoiceTerm] = useState('')

  // Folder management dialogs
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [editingFolder, setEditingFolder] = useState<InvoiceFolder | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')

  // Invoice management dialogs (move & rename)
  const [renamingInvoice, setRenamingInvoice] = useState<SavedInvoice | null>(null)
  const [renamingInvoiceTitle, setRenamingInvoiceTitle] = useState('')
  const [movingInvoice, setMovingInvoice] = useState<SavedInvoice | null>(null)
  const [targetFolderId, setTargetFolderId] = useState<string>('root')

  const [cellTextModalOpen, setCellTextModalOpen] = useState(false)
  const [cellTextBuffer, setCellTextBuffer] = useState('')
  const [componentsManagerOpen, setComponentsManagerOpen] = useState(false)
  const [logoSettingsOpen, setLogoSettingsOpen] = useState(false)
  const [customSectionModalOpen, setCustomSectionModalOpen] = useState(false)
  const [customSectionTitle, setCustomSectionTitle] = useState('')
  const [customSectionContent, setCustomSectionContent] = useState('')
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cellImageInputRef = useRef<HTMLInputElement>(null)
  const [cellImageSettingsOpen, setCellImageSettingsOpen] = useState(false)
  const [currentCellImageSize, setCurrentCellImageSize] = useState<number>(50)

  // Window mouseup listener for multi-selection drag
  useEffect(() => {
    const handleMouseUp = () => setIsMouseDownOnCells(false)
    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [])

  // Load saved invoices and folders from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('financial_system_excel_invoices')
      if (stored) {
        setSavedInvoices(JSON.parse(stored))
      }
      const storedFolders = localStorage.getItem('financial_system_invoice_folders')
      if (storedFolders) {
        setFolders(JSON.parse(storedFolders))
      }
    } catch {}
  }, [])

  // Auto-evaluate row total (e.g., PRODUCT = qty * price)
  const evaluateRowTotal = (row: RowDef, cols: ColumnDef[]): RowDef => {
    const qtyCol = cols.find((c) => c.header.includes('كمية') || c.id === 'c_qty')
    const priceCol = cols.find((c) => c.header.includes('سعر') || c.id === 'c_price')
    const totalCol = cols.find((c) => c.header.includes('إجمالي') || c.id === 'c_total')

    if (!qtyCol || !priceCol || !totalCol) return row

    const cellTotal = row.cells[totalCol.id]
    if (cellTotal && cellTotal.formula === 'PRODUCT') {
      const q = parseFloat((row.cells[qtyCol.id]?.value || '0').replace(/,/g, '')) || 0
      const p = parseFloat((row.cells[priceCol.id]?.value || '0').replace(/,/g, '')) || 0
      const computed = (q * p).toFixed(2)
      return {
        ...row,
        cells: {
          ...row.cells,
          [totalCol.id]: {
            ...cellTotal,
            value: computed,
          },
        },
      }
    }
    return row
  }

  // Calculate Subtotal and Grand Total dynamically including custom summary items
  const calculateTotals = () => {
    const totalCol = invoice.columns.find((c) => c.header.includes('إجمالي') || c.id === 'c_total')
    let calculatedSubtotal = 0

    if (totalCol) {
      invoice.rows.forEach((row) => {
        const val = parseFloat((row.cells[totalCol.id]?.value || '0').replace(/,/g, ''))
        if (!isNaN(val)) calculatedSubtotal += val
      })
    } else {
      const lastCol = invoice.columns[invoice.columns.length - 1]
      if (lastCol) {
        invoice.rows.forEach((row) => {
          const val = parseFloat((row.cells[lastCol.id]?.value || '0').replace(/,/g, ''))
          if (!isNaN(val)) calculatedSubtotal += val
        })
      }
    }

    const isSubtotalManual =
      invoice.customSubtotal !== undefined &&
      invoice.customSubtotal !== null &&
      String(invoice.customSubtotal).trim() !== ''

    const subtotal = isSubtotalManual
      ? (parseFloat(String(invoice.customSubtotal).replace(/,/g, '')) || 0)
      : calculatedSubtotal

    const discountAmount = invoice.showDiscount ? Number(invoice.discount) || 0 : 0
    const taxAmount = invoice.showTax
      ? ((subtotal - discountAmount) * (Number(invoice.taxRate) || 0)) / 100
      : 0

    let calculatedGrandTotal = subtotal
    if (invoice.showDiscount) calculatedGrandTotal -= discountAmount
    if (invoice.showTax) calculatedGrandTotal += taxAmount

    if (invoice.customSummaryItems && invoice.customSummaryItems.length > 0) {
      invoice.customSummaryItems.forEach((item) => {
        const amt = Number(item.amount) || 0
        if (item.type === 'subtract') calculatedGrandTotal -= amt
        else calculatedGrandTotal += amt
      })
    }

    calculatedGrandTotal = Math.max(0, calculatedGrandTotal)

    const isGrandTotalManual =
      invoice.customGrandTotal !== undefined &&
      invoice.customGrandTotal !== null &&
      String(invoice.customGrandTotal).trim() !== ''

    const grandTotal = isGrandTotalManual
      ? (parseFloat(String(invoice.customGrandTotal).replace(/,/g, '')) || 0)
      : calculatedGrandTotal

    return {
      subtotal,
      calculatedSubtotal,
      isSubtotalManual,
      discountAmount,
      taxAmount,
      grandTotal,
      calculatedGrandTotal,
      isGrandTotalManual,
    }
  }

  const {
    subtotal,
    calculatedSubtotal,
    isSubtotalManual,
    discountAmount,
    taxAmount,
    grandTotal,
    calculatedGrandTotal,
    isGrandTotalManual,
  } = calculateTotals()

  // ── Cell Multi-Selection Logic ───────────────────────────────────────
  const isCellSelected = (rowId: string, colId: string) => {
    return selectedCells.some((c) => c.rowId === rowId && c.colId === colId)
  }

  const handleCellClick = (rowId: string, colId: string, e: React.MouseEvent) => {
    // Clear column header selection to prevent any unintended crosstalk
    setSelectedCol(null)

    if (e.ctrlKey || e.metaKey) {
      // Toggle selection of this cell
      setSelectedCells((prev) => {
        const exists = prev.some((c) => c.rowId === rowId && c.colId === colId)
        if (exists) return prev.filter((c) => !(c.rowId === rowId && c.colId === colId))
        return [...prev, { rowId, colId }]
      })
      setSelectionAnchor({ rowId, colId })
    } else if (e.shiftKey && selectionAnchor) {
      // Select rectangular box of cells between anchor and this cell
      const startR = invoice.rows.findIndex((r) => r.id === selectionAnchor.rowId)
      const endR = invoice.rows.findIndex((r) => r.id === rowId)
      const startC = invoice.columns.findIndex((c) => c.id === selectionAnchor.colId)
      const endC = invoice.columns.findIndex((c) => c.id === colId)

      const minR = Math.min(startR, endR)
      const maxR = Math.max(startR, endR)
      const minC = Math.min(startC, endC)
      const maxC = Math.max(startC, endC)

      const range: Array<{ rowId: string; colId: string }> = []
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          range.push({ rowId: invoice.rows[r].id, colId: invoice.columns[c].id })
        }
      }
      setSelectedCells(range)
    } else {
      // Single cell selection
      setSelectedCells([{ rowId, colId }])
      setSelectionAnchor({ rowId, colId })
    }
  }

  const handleCellMouseEnter = (rowId: string, colId: string) => {
    if (!isMouseDownOnCells || !selectionAnchor) return

    const startR = invoice.rows.findIndex((r) => r.id === selectionAnchor.rowId)
    const endR = invoice.rows.findIndex((r) => r.id === rowId)
    const startC = invoice.columns.findIndex((c) => c.id === selectionAnchor.colId)
    const endC = invoice.columns.findIndex((c) => c.id === colId)

    const minR = Math.min(startR, endR)
    const maxR = Math.max(startR, endR)
    const minC = Math.min(startC, endC)
    const maxC = Math.max(startC, endC)

    const range: Array<{ rowId: string; colId: string }> = []
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        range.push({ rowId: invoice.rows[r].id, colId: invoice.columns[c].id })
      }
    }
    setSelectedCells(range)
  }

  // Select all cells in a row
  const handleSelectRow = (rowId: string) => {
    setSelectedCol(null)
    const rowCells = invoice.columns.map((c) => ({ rowId, colId: c.id }))
    setSelectedCells(rowCells)
  }

  // Select all cells in a column
  const handleSelectColumnCells = (colId: string) => {
    setSelectedCol(null)
    const colCells = invoice.rows.map((r) => ({ rowId: r.id, colId }))
    setSelectedCells(colCells)
  }

  // ── Cell Merging & Unmerging (دمج وإلغاء دمج الخلايا) ──────────────────
  const canMergeSelectedCells = () => {
    if (selectedCells.length < 2) return false
    const firstRowId = selectedCells[0].rowId
    const sameRow = selectedCells.every((c) => c.rowId === firstRowId)
    return sameRow
  }

  const hasMergedCellSelected = () => {
    return selectedCells.some((c) => {
      const cell = invoice.rows.find((r) => r.id === c.rowId)?.cells[c.colId]
      return (cell?.colSpan && cell.colSpan > 1) || cell?.mergedInto
    })
  }

  const handleMergeCells = () => {
    if (!canMergeSelectedCells()) return
    const rowId = selectedCells[0].rowId

    // Sort cells by their column order in the table
    const sorted = [...selectedCells]
      .map((c) => ({ ...c, colIdx: invoice.columns.findIndex((col) => col.id === c.colId) }))
      .sort((a, b) => a.colIdx - b.colIdx)

    const primary = sorted[0]
    const others = sorted.slice(1)
    const span = sorted.length

    setInvoice((prev) => ({
      ...prev,
      rows: prev.rows.map((row) => {
        if (row.id !== rowId) return row
        const updatedCells = { ...row.cells }

        // Primary cell gets colSpan
        const primaryData = updatedCells[primary.colId] || { value: '' }
        updatedCells[primary.colId] = {
          ...primaryData,
          colSpan: span,
          mergedInto: undefined,
        }

        // Subsequent cells marked as mergedInto
        others.forEach((other) => {
          const otherData = updatedCells[other.colId] || { value: '' }
          updatedCells[other.colId] = {
            ...otherData,
            colSpan: undefined,
            mergedInto: { rowId, colId: primary.colId },
          }
        })

        return { ...row, cells: updatedCells }
      }),
    }))

    setSelectedCells([{ rowId: primary.rowId, colId: primary.colId }])
  }

  const handleUnmergeCells = () => {
    setInvoice((prev) => ({
      ...prev,
      rows: prev.rows.map((row) => {
        const updatedCells = { ...row.cells }
        let changed = false

        selectedCells.forEach((sc) => {
          if (sc.rowId === row.id) {
            const current = updatedCells[sc.colId]
            if (current?.colSpan && current.colSpan > 1) {
              changed = true
              updatedCells[sc.colId] = {
                ...current,
                colSpan: undefined,
                mergedInto: undefined,
              }
              // Clear mergedInto from siblings
              Object.keys(updatedCells).forEach((k) => {
                if (updatedCells[k]?.mergedInto?.colId === sc.colId) {
                  updatedCells[k] = {
                    ...updatedCells[k],
                    colSpan: undefined,
                    mergedInto: undefined,
                  }
                }
              })
            } else if (current?.mergedInto) {
              const masterColId = current.mergedInto.colId
              changed = true
              if (updatedCells[masterColId]) {
                updatedCells[masterColId] = {
                  ...updatedCells[masterColId],
                  colSpan: undefined,
                  mergedInto: undefined,
                }
              }
              Object.keys(updatedCells).forEach((k) => {
                if (updatedCells[k]?.mergedInto?.colId === masterColId) {
                  updatedCells[k] = {
                    ...updatedCells[k],
                    colSpan: undefined,
                    mergedInto: undefined,
                  }
                }
              })
            }
          }
        })

        return changed ? { ...row, cells: updatedCells } : row
      }),
    }))
  }

  // ── Style Selected Cells (Independent from column header) ────────────
  const handleStyleSelectedCells = (updates: Partial<CellData>) => {
    if (selectedCells.length === 0) return

    setInvoice((prev) => ({
      ...prev,
      rows: prev.rows.map((row) => {
        const cellsToUpdateInRow = selectedCells.filter((c) => c.rowId === row.id)
        if (cellsToUpdateInRow.length === 0) return row

        const updatedCells = { ...row.cells }
        cellsToUpdateInRow.forEach((c) => {
          const current = updatedCells[c.colId] || { value: '' }
          updatedCells[c.colId] = { ...current, ...updates }
        })

        return { ...row, cells: updatedCells }
      }),
    }))
  }

  // Clear content of selected cells
  const handleClearSelectedCells = () => {
    if (selectedCells.length === 0) return
    handleStyleSelectedCells({ value: '' })
  }

  // Style Column Header Only (Independent from cells)
  const handleStyleColumn = (colId: string, updates: Partial<ColumnDef>) => {
    setInvoice((prev) => ({
      ...prev,
      columns: prev.columns.map((col) => (col.id === colId ? { ...col, ...updates } : col)),
    }))
  }

  // ── Reorder Columns (تغيير مكان الأعمدة) ──────────────────────────────
  const handleMoveColumn = (colIdx: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? colIdx - 1 : colIdx + 1
    if (targetIdx < 0 || targetIdx >= invoice.columns.length) return

    setInvoice((prev) => {
      const updated = [...prev.columns]
      const temp = updated[colIdx]
      updated[colIdx] = updated[targetIdx]
      updated[targetIdx] = temp
      return { ...prev, columns: updated }
    })
  }

  // ── Reorder Rows (تغيير مكان الصفوف) ──────────────────────────────────
  const handleMoveRow = (rowIdx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? rowIdx - 1 : rowIdx + 1
    if (targetIdx < 0 || targetIdx >= invoice.rows.length) return

    setInvoice((prev) => {
      const updated = [...prev.rows]
      const temp = updated[rowIdx]
      updated[rowIdx] = updated[targetIdx]
      updated[targetIdx] = temp
      return { ...prev, rows: updated }
    })
  }

  const handleDuplicateRow = (rowIdx: number) => {
    const sourceRow = invoice.rows[rowIdx]
    if (!sourceRow) return

    const newId = `r_${Date.now()}`
    const duplicatedCells: Record<string, CellData> = {}

    Object.entries(sourceRow.cells).forEach(([colId, cell]) => {
      duplicatedCells[colId] = { ...cell, colSpan: undefined, mergedInto: undefined }
    })

    setInvoice((prev) => {
      const updated = [...prev.rows]
      updated.splice(rowIdx + 1, 0, { id: newId, cells: duplicatedCells })
      return { ...prev, rows: updated }
    })
  }

  // ── Drag & Drop Section Handlers ─────────────────────────────────────
  const handleDragStartSection = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString())
    setDraggedSectionIndex(index)
  }

  const handleDragOverSection = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragOverSectionIndex !== index) {
      setDragOverSectionIndex(index)
    }
  }

  const handleDropSection = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (draggedSectionIndex === null || draggedSectionIndex === targetIndex) {
      setDraggedSectionIndex(null)
      setDragOverSectionIndex(null)
      return
    }

    setInvoice((prev) => {
      const updated = [...prev.sections]
      const [movedItem] = updated.splice(draggedSectionIndex, 1)
      updated.splice(targetIndex, 0, movedItem)
      return { ...prev, sections: updated }
    })

    setDraggedSectionIndex(null)
    setDragOverSectionIndex(null)
  }

  const handleDragEndSection = () => {
    setDraggedSectionIndex(null)
    setDragOverSectionIndex(null)
  }

  // Quick Move Section (Up or Down)
  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= invoice.sections.length) return

    setInvoice((prev) => {
      const updated = [...prev.sections]
      const temp = updated[index]
      updated[index] = updated[targetIndex]
      updated[targetIndex] = temp
      return { ...prev, sections: updated }
    })
  }

  // Toggle or Delete Section
  const handleToggleSection = (sectionId: string) => {
    setInvoice((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === sectionId ? { ...s, visible: !s.visible } : s)),
    }))
  }

  const handleDeleteSection = (sectionId: string) => {
    setInvoice((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sectionId),
    }))
  }

  // Reset standard sections
  const handleResetSections = () => {
    const defaultState = createInitialState(currentSymbol)
    setInvoice((prev) => ({
      ...prev,
      showCompanyName: true,
      showCompanySubtitle: true,
      showInvoiceNumber: true,
      showInvoiceDate: true,
      showTaxNumber: true,
      showClientPhone: true,
      showClientAddress: true,
      showSubtotal: true,
      showDiscount: true,
      showTax: false,
      sections: defaultState.sections,
      signaturesList: defaultState.signaturesList,
    }))
  }

  // Add Custom Section
  const handleAddCustomSection = () => {
    if (!customSectionTitle.trim()) return
    const newSection: InvoiceSection = {
      id: `sec_custom_${Date.now()}`,
      type: 'custom',
      title: customSectionTitle.trim(),
      content: customSectionContent.trim(),
      visible: true,
    }
    setInvoice((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }))
    setCustomSectionTitle('')
    setCustomSectionContent('')
    setCustomSectionModalOpen(false)
  }

  // ── Sub-component Customizers ────────────────────────────────────────
  const handleAddCustomClientField = () => {
    const newField: CustomField = {
      id: `cf_${Date.now()}`,
      label: 'البريد أو حقل إضافي',
      value: '',
    }
    setInvoice((prev) => ({
      ...prev,
      customClientFields: [...(prev.customClientFields || []), newField],
    }))
  }

  const handleRemoveCustomClientField = (id: string) => {
    setInvoice((prev) => ({
      ...prev,
      customClientFields: prev.customClientFields.filter((f) => f.id !== id),
    }))
  }

  const handleAddCustomSummaryItem = (type: 'add' | 'subtract') => {
    const newItem: CustomSummaryItem = {
      id: `cs_${Date.now()}`,
      label: type === 'add' ? 'مصاريف شحن ونقل' : 'دفعة مقدمة / عربون',
      amount: 0,
      type,
    }
    setInvoice((prev) => ({
      ...prev,
      customSummaryItems: [...(prev.customSummaryItems || []), newItem],
    }))
  }

  const handleRemoveCustomSummaryItem = (id: string) => {
    setInvoice((prev) => ({
      ...prev,
      customSummaryItems: prev.customSummaryItems.filter((i) => i.id !== id),
    }))
  }

  const handleAddSignature = (type: 'sign' | 'stamp') => {
    const newSig: SignatureItem = {
      id: `sig_${Date.now()}`,
      label: type === 'sign' ? 'توقيع إضافي (المدقق / المشرف)' : 'ختم الفرع',
      type,
    }
    setInvoice((prev) => ({
      ...prev,
      signaturesList: [...(prev.signaturesList || []), newSig],
    }))
  }

  const handleRemoveSignature = (id: string) => {
    setInvoice((prev) => ({
      ...prev,
      signaturesList: prev.signaturesList.filter((s) => s.id !== id),
    }))
  }

  // ── Basic Actions ───────────────────────────────────────────────────
  const handleAddColumn = () => {
    const newId = `col_${Date.now()}`
    const colNumber = invoice.columns.length + 1
    const newCol: ColumnDef = {
      id: newId,
      header: `عمود ${colNumber}`,
      align: 'center',
      width: '120px',
    }
    setInvoice((prev) => ({
      ...prev,
      columns: [...prev.columns, newCol],
      rows: prev.rows.map((r) => ({
        ...r,
        cells: {
          ...r.cells,
          [newId]: { value: '' },
        },
      })),
    }))
  }

  const handleRemoveColumn = (colId: string) => {
    if (invoice.columns.length <= 1) return
    setInvoice((prev) => ({
      ...prev,
      columns: prev.columns.filter((c) => c.id !== colId),
      rows: prev.rows.map((r) => {
        const newCells = { ...r.cells }
        delete newCells[colId]
        return { ...r, cells: newCells }
      }),
    }))
    if (selectedCol === colId) setSelectedCol(null)
    setSelectedCells((prev) => prev.filter((c) => c.colId !== colId))
  }

  const handleAddRow = () => {
    const newId = `r_${Date.now()}`
    const newCells: Record<string, CellData> = {}
    invoice.columns.forEach((col) => {
      if (col.id === 'c_index' || col.header === '#') {
        newCells[col.id] = { value: String(invoice.rows.length + 1), align: 'center' }
      } else if (col.id === 'c_total' || col.header.includes('إجمالي')) {
        newCells[col.id] = { value: '0.00', formula: 'PRODUCT', align: 'center', bold: true }
      } else {
        newCells[col.id] = { value: '', align: col.align }
      }
    })

    setInvoice((prev) => {
      const updatedRows = [...prev.rows, { id: newId, cells: newCells }]
      return { ...prev, rows: updatedRows }
    })
  }

  const handleRemoveRow = (rowId: string) => {
    if (invoice.rows.length <= 1) return
    setInvoice((prev) => ({
      ...prev,
      rows: prev.rows.filter((r) => r.id !== rowId),
    }))
    setSelectedCells((prev) => prev.filter((c) => c.rowId !== rowId))
  }

  const handleCellChange = (rowId: string, colId: string, value: string) => {
    setInvoice((prev) => {
      const totalCol = prev.columns.find((c) => c.header.includes('إجمالي') || c.id === 'c_total')
      const updatedRows = prev.rows.map((row) => {
        if (row.id !== rowId) return row
        const currentCell = row.cells[colId] || { value: '' }
        // Detach auto-calculation formula if user manually types in the total column cell
        const newFormula =
          totalCol && colId === totalCol.id && currentCell.formula === 'PRODUCT'
            ? 'NONE'
            : currentCell.formula
        const newRow: RowDef = {
          ...row,
          cells: {
            ...row.cells,
            [colId]: {
              ...currentCell,
              value,
              formula: newFormula,
            },
          },
        }
        return evaluateRowTotal(newRow, prev.columns)
      })
      return { ...prev, rows: updatedRows }
    })
  }

  // Open Cell Text Modal
  const handleOpenCellTextModal = () => {
    if (selectedCells.length === 0) return
    const first = selectedCells[0]
    const currentVal = invoice.rows.find((r) => r.id === first.rowId)?.cells[first.colId]?.value || ''
    setCellTextBuffer(currentVal)
    setCellTextModalOpen(true)
  }

  const handleSaveCellText = () => {
    if (selectedCells.length === 0) return
    selectedCells.forEach((c) => {
      handleCellChange(c.rowId, c.colId, cellTextBuffer)
    })
    setCellTextModalOpen(false)
  }

  // Apply Formula
  const handleApplyFormula = (type: 'SUM_COL' | 'SUM_ROW' | 'PRODUCT') => {
    if (selectedCells.length === 0) return
    const { rowId, colId } = selectedCells[0]

    if (type === 'PRODUCT') {
      setInvoice((prev) => {
        const updated = prev.rows.map((r) => {
          if (r.id !== rowId) return r
          const cell = r.cells[colId] || { value: '' }
          const modified: RowDef = {
            ...r,
            cells: {
              ...r.cells,
              [colId]: { ...cell, formula: 'PRODUCT', bold: true },
            },
          }
          return evaluateRowTotal(modified, prev.columns)
        })
        return { ...prev, rows: updated }
      })
    } else if (type === 'SUM_COL') {
      let sum = 0
      invoice.rows.forEach((r) => {
        const val = parseFloat((r.cells[colId]?.value || '0').replace(/,/g, ''))
        if (!isNaN(val)) sum += val
      })
      handleCellChange(rowId, colId, sum.toFixed(2))
    } else if (type === 'SUM_ROW') {
      let sum = 0
      const row = invoice.rows.find((r) => r.id === rowId)
      if (row) {
        Object.entries(row.cells).forEach(([key, cell]) => {
          if (key !== colId && key !== 'c_index') {
            const val = parseFloat((cell.value || '0').replace(/,/g, ''))
            if (!isNaN(val)) sum += val
          }
        })
      }
      handleCellChange(rowId, colId, sum.toFixed(2))
    }
  }

  // Upload Logo from Local File
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (uploadEvent) => {
      const base64Url = uploadEvent.target?.result as string
      setInvoice((prev) => ({
        ...prev,
        logoUrl: base64Url,
      }))
    }
    reader.readAsDataURL(file)
  }

  // Upload Image into Selected Cell(s)
  const handleCellImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || selectedCells.length === 0) return
    const reader = new FileReader()
    reader.onload = (uploadEvent) => {
      const base64Url = uploadEvent.target?.result as string
      setInvoice((prev) => {
        const targetCoords = new Set(selectedCells.map((c) => `${c.rowId}:${c.colId}`))
        const updatedRows = prev.rows.map((r) => {
          const newCells = { ...r.cells }
          let changed = false
          Object.keys(newCells).forEach((cId) => {
            if (targetCoords.has(`${r.id}:${cId}`)) {
              newCells[cId] = {
                ...newCells[cId],
                imageUrl: base64Url,
                imageHeight: currentCellImageSize || 50,
                imageWidth: Math.round((currentCellImageSize || 50) * 1.5),
              }
              changed = true
            }
          })
          return changed ? { ...r, cells: newCells } : r
        })
        return { ...prev, rows: updatedRows }
      })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Remove Image from Cell
  const handleRemoveCellImage = (rowId: string, colId: string) => {
    setInvoice((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => {
        if (r.id !== rowId) return r
        const cell = r.cells[colId]
        if (!cell) return r
        const updatedCell = { ...cell }
        delete updatedCell.imageUrl
        delete updatedCell.imageHeight
        delete updatedCell.imageWidth
        return {
          ...r,
          cells: {
            ...r.cells,
            [colId]: updatedCell,
          },
        }
      }),
    }))
  }

  // Resize Image in Selected Cell(s)
  const handleResizeCellImage = (height: number) => {
    setCurrentCellImageSize(height)
    if (selectedCells.length === 0) return
    const targetCoords = new Set(selectedCells.map((c) => `${c.rowId}:${c.colId}`))
    setInvoice((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => {
        const newCells = { ...r.cells }
        let changed = false
        Object.keys(newCells).forEach((cId) => {
          if (targetCoords.has(`${r.id}:${cId}`)) {
            newCells[cId] = {
              ...newCells[cId],
              imageHeight: height,
              imageWidth: Math.round(height * 1.5),
            }
            changed = true
          }
        })
        return changed ? { ...r, cells: newCells } : r
      }),
    }))
  }

  // Load Ready-made Templates
  const handleLoadTemplate = (type: 'sales' | 'service' | 'expenses' | 'blank') => {
    if (type === 'sales') {
      setInvoice(createInitialState(currentSymbol))
    } else if (type === 'service') {
      const base = createInitialState(currentSymbol)
      base.invoiceTitle = 'فاتورة أتعاب واستشارات تقنية'
      base.columns = [
        { id: 'c_index', header: '#', align: 'center', width: '50px' },
        { id: 'c_desc', header: 'وصف الخدمة الاستشارية', align: 'right', width: '50%' },
        { id: 'c_qty', header: 'عدد الساعات', align: 'center', width: '15%' },
        { id: 'c_price', header: 'سعر الساعة', align: 'center', width: '15%' },
        { id: 'c_total', header: 'الإجمالي', align: 'center', width: '20%' },
      ]
      base.rows = [
        {
          id: 'r_1',
          cells: {
            c_index: { value: '1', align: 'center' },
            c_desc: { value: 'تطوير وتخصيص منظومة إدارة الحسابات', align: 'right' },
            c_qty: { value: '25', align: 'center' },
            c_price: { value: '60.00', align: 'center' },
            c_total: { value: '1500.00', formula: 'PRODUCT', align: 'center', bold: true },
          },
        },
      ]
      base.showDiscount = false
      base.showTax = false
      setInvoice(base)
    } else if (type === 'expenses') {
      const base = createInitialState(currentSymbol)
      base.invoiceTitle = 'كشف وسند مصروفات تشغيلية'
      base.columns = [
        { id: 'c_index', header: '#', align: 'center', width: '50px' },
        { id: 'c_date', header: 'تاريخ الإنفاق', align: 'center', width: '20%' },
        { id: 'c_desc', header: 'بيان المصروف', align: 'right', width: '50%' },
        { id: 'c_total', header: 'المبلغ المدفوع', align: 'center', width: '30%' },
      ]
      base.rows = [
        {
          id: 'r_1',
          cells: {
            c_index: { value: '1', align: 'center' },
            c_date: { value: new Date().toISOString().split('T')[0], align: 'center' },
            c_desc: { value: 'شراء قرطاسية ومستلزمات مكتبية', align: 'right' },
            c_total: { value: '240.00', align: 'center', bold: true },
          },
        },
      ]
      base.showDiscount = false
      base.showTax = false
      base.terms = ''
      setInvoice(base)
    } else if (type === 'blank') {
      setInvoice({
        ...createInitialState(currentSymbol),
        companyName: 'اسم الشركة / المؤسسة',
        companySubtitle: '',
        invoiceTitle: 'فاتورة جديدة',
        clientName: '',
        clientPhone: '',
        clientAddress: '',
        columns: [
          { id: 'c_index', header: '#', align: 'center', width: '60px' },
          { id: 'c_desc', header: 'الوصف والبيان', align: 'right', width: '60%' },
          { id: 'c_total', header: 'المبلغ', align: 'center', width: '40%' },
        ],
        rows: [
          {
            id: 'r_1',
            cells: {
              c_index: { value: '1', align: 'center' },
              c_desc: { value: '', align: 'right' },
              c_total: { value: '0.00', align: 'center' },
            },
          },
        ],
        showDiscount: false,
        showTax: false,
        discount: 0,
        taxRate: 0,
        notes: '',
        terms: '',
      })
    }
  }

  // Save Current Invoice Draft to localStorage
  const handleSaveInvoice = () => {
    const assignedFolder = selectedFolderId !== 'all' && selectedFolderId !== 'root' ? selectedFolderId : undefined
    const newEntry: SavedInvoice = {
      id: `inv_${Date.now()}`,
      title: `${invoice.invoiceTitle} - ${invoice.clientName || invoice.invoiceNumber}`,
      date: new Date().toLocaleDateString('ar-LY', { dateStyle: 'short' }),
      data: invoice,
      folderId: assignedFolder,
    }
    const updated = [newEntry, ...savedInvoices.filter((i) => i.id !== newEntry.id)]
    setSavedInvoices(updated)
    try {
      localStorage.setItem('financial_system_excel_invoices', JSON.stringify(updated))
    } catch {}
    setSaveSuccessNotice(true)
    setTimeout(() => setSaveSuccessNotice(false), 2500)
  }

  // Folder Operations
  const handleCreateFolder = () => {
    const trimmed = newFolderName.trim()
    if (!trimmed) return
    const newFolder: InvoiceFolder = {
      id: `folder_${Date.now()}`,
      name: trimmed,
      createdAt: new Date().toLocaleDateString('ar-LY'),
    }
    const updated = [...folders, newFolder]
    setFolders(updated)
    try {
      localStorage.setItem('financial_system_invoice_folders', JSON.stringify(updated))
    } catch {}
    setNewFolderName('')
    setNewFolderDialogOpen(false)
    setSelectedFolderId(newFolder.id)
  }

  const handleRenameFolder = () => {
    if (!editingFolder) return
    const trimmed = editingFolderName.trim()
    if (!trimmed) return
    const updated = folders.map((f) => (f.id === editingFolder.id ? { ...f, name: trimmed } : f))
    setFolders(updated)
    try {
      localStorage.setItem('financial_system_invoice_folders', JSON.stringify(updated))
    } catch {}
    setEditingFolder(null)
    setEditingFolderName('')
  }

  const handleDeleteFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const folder = folders.find((f) => f.id === folderId)
    if (!folder) return
    if (!confirm(`هل أنت متأكد من حذف المجلد "${folder.name}"؟ سيتم نقل الفواتير الموجودة بداخله إلى الفواتير غير المصنفة.`)) {
      return
    }
    const updatedFolders = folders.filter((f) => f.id !== folderId)
    setFolders(updatedFolders)
    try {
      localStorage.setItem('financial_system_invoice_folders', JSON.stringify(updatedFolders))
    } catch {}

    const updatedInvoices = savedInvoices.map((inv) =>
      inv.folderId === folderId ? { ...inv, folderId: undefined } : inv
    )
    setSavedInvoices(updatedInvoices)
    try {
      localStorage.setItem('financial_system_excel_invoices', JSON.stringify(updatedInvoices))
    } catch {}

    if (selectedFolderId === folderId) {
      setSelectedFolderId('all')
    }
  }

  // Invoice Moving & Renaming & Duplicating
  const handleMoveInvoice = (invoiceId: string, targetFId: string) => {
    const folderVal = targetFId === 'root' ? undefined : targetFId
    const updated = savedInvoices.map((inv) =>
      inv.id === invoiceId ? { ...inv, folderId: folderVal } : inv
    )
    setSavedInvoices(updated)
    try {
      localStorage.setItem('financial_system_excel_invoices', JSON.stringify(updated))
    } catch {}
    setMovingInvoice(null)
  }

  const handleRenameInvoice = () => {
    if (!renamingInvoice) return
    const trimmed = renamingInvoiceTitle.trim()
    if (!trimmed) return
    const updated = savedInvoices.map((inv) =>
      inv.id === renamingInvoice.id ? { ...inv, title: trimmed } : inv
    )
    setSavedInvoices(updated)
    try {
      localStorage.setItem('financial_system_excel_invoices', JSON.stringify(updated))
    } catch {}
    setRenamingInvoice(null)
    setRenamingInvoiceTitle('')
  }

  const handleDuplicateInvoice = (item: SavedInvoice, e: React.MouseEvent) => {
    e.stopPropagation()
    const duplicate: SavedInvoice = {
      ...item,
      id: `inv_${Date.now()}`,
      title: `${item.title} (نسخة)`,
      date: new Date().toLocaleDateString('ar-LY', { dateStyle: 'short' }),
    }
    const updated = [duplicate, ...savedInvoices]
    setSavedInvoices(updated)
    try {
      localStorage.setItem('financial_system_excel_invoices', JSON.stringify(updated))
    } catch {}
  }

  // Load Saved Invoice
  const handleLoadSavedInvoice = (item: SavedInvoice) => {
    const loadedData = { ...item.data }
    if (!loadedData.sections || loadedData.sections.length === 0) {
      loadedData.sections = createInitialState(currentSymbol).sections
    }
    if (!loadedData.signaturesList) {
      loadedData.signaturesList = createInitialState(currentSymbol).signaturesList
    }
    setInvoice(loadedData)
    setSavedInvoicesOpen(false)
  }

  // Delete Saved Invoice
  const handleDeleteSavedInvoice = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة المحفوظة نهائياً؟')) {
      return
    }
    const updated = savedInvoices.filter((i) => i.id !== id)
    setSavedInvoices(updated)
    try {
      localStorage.setItem('financial_system_excel_invoices', JSON.stringify(updated))
    } catch {}
  }

  // Export to Excel (.xls)
  const handleExportExcel = () => {
    const isClientVisible = invoice.sections.some((s) => s.id === 'sec_client' && s.visible)
    const isNotesVisible = invoice.sections.some((s) => s.id === 'sec_notes' && s.visible)
    const isTermsVisible = invoice.sections.some((s) => s.id === 'sec_terms' && s.visible)

    exportInvoiceToExcel(
      {
        companyName: invoice.companyName,
        companySubtitle: invoice.companySubtitle,
        invoiceNumberLabel: invoice.invoiceNumberLabel,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDateLabel: invoice.invoiceDateLabel,
        invoiceDate: invoice.invoiceDate,
        taxNumberLabel: invoice.taxNumberLabel,
        taxNumber: invoice.taxNumber,
        showTaxNumber: invoice.showTaxNumber,
        clientHeaderLabel: invoice.clientHeaderLabel,
        clientName: invoice.clientName,
        clientPhoneLabel: invoice.clientPhoneLabel,
        clientPhone: invoice.showClientPhone ? invoice.clientPhone : undefined,
        clientAddressLabel: invoice.clientAddressLabel,
        clientAddress: invoice.showClientAddress ? invoice.clientAddress : undefined,
        customClientFields: invoice.customClientFields,
        currencySymbol: invoice.currencySymbol,
        columns: invoice.columns.map((c) => ({ id: c.id, header: c.header, align: c.align })),
        rows: invoice.rows.map((r) => ({
          cells: Object.fromEntries(
            Object.entries(r.cells).map(([k, v]) => [
              k,
              {
                value: v.value,
                colSpan: v.colSpan,
                mergedInto: v.mergedInto,
                style: { bgColor: v.bgColor, textColor: v.textColor, bold: v.bold },
              },
            ])
          ),
        })),
        showSubtotal: invoice.showSubtotal,
        subtotalLabel: invoice.subtotalLabel,
        subtotal,
        discount: discountAmount,
        showDiscount: invoice.showDiscount,
        discountLabel: invoice.discountLabel,
        tax: taxAmount,
        showTax: invoice.showTax,
        taxLabel: invoice.taxLabel,
        customSummaryItems: invoice.customSummaryItems,
        grandTotalLabel: invoice.grandTotalLabel,
        grandTotal,
        showClient: isClientVisible,
        showNotes: isNotesVisible,
        notesTitle: invoice.notesTitle,
        notes: invoice.notes,
        showTerms: isTermsVisible,
        termsTitle: invoice.termsTitle,
        terms: invoice.terms,
      },
      `${invoice.invoiceTitle || 'فاتورة'}_${invoice.invoiceNumber}.xls`
    )
  }

  // Export to CSV (.csv)
  const handleExportCsv = () => {
    const isClientVisible = invoice.sections.some((s) => s.id === 'sec_client' && s.visible)
    const isNotesVisible = invoice.sections.some((s) => s.id === 'sec_notes' && s.visible)
    const isTermsVisible = invoice.sections.some((s) => s.id === 'sec_terms' && s.visible)

    exportInvoiceToCsv(
      {
        companyName: invoice.companyName,
        companySubtitle: invoice.companySubtitle,
        invoiceNumberLabel: invoice.invoiceNumberLabel,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDateLabel: invoice.invoiceDateLabel,
        invoiceDate: invoice.invoiceDate,
        taxNumberLabel: invoice.taxNumberLabel,
        taxNumber: invoice.taxNumber,
        showTaxNumber: invoice.showTaxNumber,
        clientHeaderLabel: invoice.clientHeaderLabel,
        clientName: invoice.clientName,
        currencySymbol: invoice.currencySymbol,
        columns: invoice.columns.map((c) => ({ id: c.id, header: c.header, align: c.align })),
        rows: invoice.rows,
        showSubtotal: invoice.showSubtotal,
        subtotalLabel: invoice.subtotalLabel,
        subtotal,
        discount: discountAmount,
        showDiscount: invoice.showDiscount,
        discountLabel: invoice.discountLabel,
        tax: taxAmount,
        showTax: invoice.showTax,
        taxLabel: invoice.taxLabel,
        customSummaryItems: invoice.customSummaryItems,
        grandTotalLabel: invoice.grandTotalLabel,
        grandTotal,
        showClient: isClientVisible,
        showNotes: isNotesVisible,
        notesTitle: invoice.notesTitle,
        notes: invoice.notes,
        showTerms: isTermsVisible,
        termsTitle: invoice.termsTitle,
        terms: invoice.terms,
      },
      `${invoice.invoiceTitle || 'فاتورة'}_${invoice.invoiceNumber}.csv`
    )
  }

  // Trigger Print View
  const handlePrint = () => {
    window.print()
  }

  // ── Render Individual Section Content ────────────────────────────────
  const renderSectionContent = (section: InvoiceSection, isPrintPortal: boolean, sIdx: number) => {
    switch (section.type) {
      // 1. Header Section: Company, Title & Logo
      case 'header':
        return (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b-2 border-zinc-900">
              {/* Custom Logo & Controls */}
              {invoice.logoUrl && (
                <div className="relative group shrink-0">
                  <div
                    className={`flex items-center ${
                      invoice.logoAlign === 'center'
                        ? 'justify-center'
                        : invoice.logoAlign === 'left'
                        ? 'justify-start'
                        : 'justify-end'
                    }`}
                  >
                    <img
                      src={invoice.logoUrl}
                      alt="شعار الفاتورة"
                      style={{ height: `${invoice.logoSize}px` }}
                      className="object-contain rounded-lg transition-all"
                    />
                  </div>

                  {/* Logo On-Screen Controls */}
                  {!isPrintPortal && (
                    <div className="absolute -top-3 -left-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1 shadow-md flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      <button
                        type="button"
                        onClick={() =>
                          setInvoice((prev) => ({
                            ...prev,
                            logoSize: Math.max(30, prev.logoSize - 10),
                          }))
                        }
                        className="p-1 text-zinc-600 dark:text-zinc-300 hover:text-cyan-600 rounded cursor-pointer"
                        title="تصغير الشعار (-10px)"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] font-mono font-bold px-1 text-zinc-500">
                        {invoice.logoSize}px
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setInvoice((prev) => ({
                            ...prev,
                            logoSize: Math.min(240, prev.logoSize + 10),
                          }))
                        }
                        className="p-1 text-zinc-600 dark:text-zinc-300 hover:text-cyan-600 rounded cursor-pointer"
                        title="تكبير الشعار (+10px)"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogoSettingsOpen(true)}
                        className="p-1 text-zinc-600 dark:text-zinc-300 hover:text-violet-600 rounded cursor-pointer"
                        title="خيارات حجم ومحاذاة الشعار"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setInvoice((prev) => ({ ...prev, logoUrl: '' }))}
                        className="p-1 text-rose-600 hover:text-rose-700 rounded cursor-pointer"
                        title="حذف الشعار"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Company Details */}
              <div className="flex-1 space-y-1">
                {isPrintPortal ? (
                  <>
                    {invoice.showCompanyName && (
                      <h2 className="text-2xl font-black text-zinc-950">{invoice.companyName}</h2>
                    )}
                    {invoice.showCompanySubtitle && (
                      <p className="text-xs text-zinc-600">{invoice.companySubtitle}</p>
                    )}
                    {invoice.showTaxNumber && invoice.taxNumber && (
                      <p className="text-[11px] text-zinc-500 font-semibold pt-0.5">
                        {invoice.taxNumberLabel}: {invoice.taxNumber}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    {/* Company Name */}
                    {invoice.showCompanyName ? (
                      <div className="relative group/field flex items-center gap-2">
                        <input
                          type="text"
                          value={invoice.companyName}
                          onChange={(e) => setInvoice((prev) => ({ ...prev, companyName: e.target.value }))}
                          placeholder="اسم الشركة / المؤسسة..."
                          className="w-full text-xl sm:text-2xl font-black text-zinc-950 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-zinc-900 focus:outline-none transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setInvoice((prev) => ({ ...prev, showCompanyName: false }))}
                          className="opacity-0 group-hover/field:opacity-100 text-zinc-400 hover:text-rose-600 p-1 cursor-pointer"
                          title="حذف/إخفاء اسم الشركة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setInvoice((prev) => ({ ...prev, showCompanyName: true }))}
                        className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-2.5 h-2.5" /> إضافة اسم الشركة
                      </button>
                    )}

                    {/* Company Subtitle */}
                    {invoice.showCompanySubtitle ? (
                      <div className="relative group/field flex items-center gap-2">
                        <input
                          type="text"
                          value={invoice.companySubtitle}
                          onChange={(e) => setInvoice((prev) => ({ ...prev, companySubtitle: e.target.value }))}
                          placeholder="وصف النشاط التجاري أو الفرع..."
                          className="w-full text-xs sm:text-sm text-zinc-500 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-zinc-900 focus:outline-none transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setInvoice((prev) => ({ ...prev, showCompanySubtitle: false }))}
                          className="opacity-0 group-hover/field:opacity-100 text-zinc-400 hover:text-rose-600 p-1 cursor-pointer"
                          title="حذف/إخفاء وصف النشاط"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setInvoice((prev) => ({ ...prev, showCompanySubtitle: true }))}
                        className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-2.5 h-2.5" /> إضافة وصف النشاط
                      </button>
                    )}

                    {/* Tax Number / Registration */}
                    {invoice.showTaxNumber ? (
                      <div className="relative group/field flex items-center gap-2 pt-1 text-[11px] text-zinc-600">
                        <input
                          type="text"
                          value={invoice.taxNumberLabel}
                          onChange={(e) => setInvoice((prev) => ({ ...prev, taxNumberLabel: e.target.value }))}
                          className="font-bold text-zinc-700 bg-transparent border-b border-transparent hover:border-zinc-300 focus:outline-none w-44"
                          title="انقر لتعديل مسمى هذا الحقل"
                        />
                        <span>:</span>
                        <input
                          type="text"
                          value={invoice.taxNumber}
                          onChange={(e) => setInvoice((prev) => ({ ...prev, taxNumber: e.target.value }))}
                          placeholder="1029384..."
                          className="font-mono text-zinc-800 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-zinc-900 focus:outline-none flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => setInvoice((prev) => ({ ...prev, showTaxNumber: false }))}
                          className="opacity-0 group-hover/field:opacity-100 text-zinc-400 hover:text-rose-600 p-0.5 cursor-pointer"
                          title="حذف بند الرقم الضريبي"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setInvoice((prev) => ({ ...prev, showTaxNumber: true }))}
                        className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer pt-1"
                      >
                        <Plus className="w-2.5 h-2.5" /> إضافة الرقم الضريبي / القيد
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Invoice Meta Box */}
              <div className="w-full sm:w-auto bg-zinc-50 p-4 rounded-xl border border-zinc-200 text-right space-y-1.5 shrink-0">
                {isPrintPortal ? (
                  <>
                    <h3 className="text-base font-extrabold text-zinc-900">{invoice.invoiceTitle}</h3>
                    {invoice.showInvoiceNumber && (
                      <div className="text-xs flex justify-between gap-4">
                        <span className="text-zinc-500 font-semibold">{invoice.invoiceNumberLabel}:</span>
                        <span className="font-mono font-bold text-zinc-950">{invoice.invoiceNumber}</span>
                      </div>
                    )}
                    {invoice.showInvoiceDate && (
                      <div className="text-xs flex justify-between gap-4">
                        <span className="text-zinc-500 font-semibold">{invoice.invoiceDateLabel}:</span>
                        <span className="font-mono font-bold text-zinc-950">{invoice.invoiceDate}</span>
                      </div>
                    )}
                    {invoice.showDueDate && invoice.dueDate && (
                      <div className="text-xs flex justify-between gap-4">
                        <span className="text-zinc-500 font-semibold">{invoice.dueDateLabel}:</span>
                        <span className="font-mono font-bold text-zinc-950">{invoice.dueDate}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      value={invoice.invoiceTitle}
                      onChange={(e) => setInvoice((prev) => ({ ...prev, invoiceTitle: e.target.value }))}
                      className="text-base font-extrabold text-zinc-900 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-zinc-900 focus:outline-none text-right w-full"
                    />

                    {invoice.showInvoiceNumber && (
                      <div className="flex items-center justify-between gap-2 text-xs group/item">
                        <input
                          type="text"
                          value={invoice.invoiceNumberLabel}
                          onChange={(e) =>
                            setInvoice((prev) => ({ ...prev, invoiceNumberLabel: e.target.value }))
                          }
                          className="text-zinc-500 font-semibold bg-transparent border-b border-transparent hover:border-zinc-300 focus:outline-none w-24 text-right"
                        />
                        <span>:</span>
                        <input
                          type="text"
                          value={invoice.invoiceNumber}
                          onChange={(e) =>
                            setInvoice((prev) => ({ ...prev, invoiceNumber: e.target.value }))
                          }
                          className="font-mono font-bold text-zinc-950 bg-transparent text-left w-24 focus:outline-none border-b border-transparent hover:border-zinc-300"
                        />
                        <button
                          type="button"
                          onClick={() => setInvoice((prev) => ({ ...prev, showInvoiceNumber: false }))}
                          className="opacity-0 group-hover/item:opacity-100 text-zinc-400 hover:text-rose-600 p-0.5 cursor-pointer"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}

                    {invoice.showInvoiceDate && (
                      <div className="flex items-center justify-between gap-2 text-xs group/item">
                        <input
                          type="text"
                          value={invoice.invoiceDateLabel}
                          onChange={(e) =>
                            setInvoice((prev) => ({ ...prev, invoiceDateLabel: e.target.value }))
                          }
                          className="text-zinc-500 font-semibold bg-transparent border-b border-transparent hover:border-zinc-300 focus:outline-none w-24 text-right"
                        />
                        <span>:</span>
                        <input
                          type="date"
                          value={invoice.invoiceDate}
                          onChange={(e) =>
                            setInvoice((prev) => ({ ...prev, invoiceDate: e.target.value }))
                          }
                          className="font-mono font-bold text-zinc-950 bg-transparent text-left w-28 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setInvoice((prev) => ({ ...prev, showInvoiceDate: false }))}
                          className="opacity-0 group-hover/item:opacity-100 text-zinc-400 hover:text-rose-600 p-0.5 cursor-pointer"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}

                    {invoice.showDueDate ? (
                      <div className="flex items-center justify-between gap-2 text-xs group/item">
                        <input
                          type="text"
                          value={invoice.dueDateLabel}
                          onChange={(e) =>
                            setInvoice((prev) => ({ ...prev, dueDateLabel: e.target.value }))
                          }
                          className="text-zinc-500 font-semibold bg-transparent border-b border-transparent hover:border-zinc-300 focus:outline-none w-24 text-right"
                        />
                        <span>:</span>
                        <input
                          type="date"
                          value={invoice.dueDate}
                          onChange={(e) =>
                            setInvoice((prev) => ({ ...prev, dueDate: e.target.value }))
                          }
                          className="font-mono font-bold text-zinc-950 bg-transparent text-left w-28 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setInvoice((prev) => ({ ...prev, showDueDate: false }))}
                          className="opacity-0 group-hover/item:opacity-100 text-zinc-400 hover:text-rose-600 p-0.5 cursor-pointer"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setInvoice((prev) => ({
                            ...prev,
                            showDueDate: true,
                            dueDate: new Date().toISOString().split('T')[0],
                          }))
                        }
                        className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer pt-0.5"
                      >
                        <Plus className="w-2.5 h-2.5" /> إضافة تاريخ الاستحقاق
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )

      // 2. Client Details Section
      case 'client':
        return (
          <div className="my-4 p-4 rounded-xl bg-zinc-50/80 border border-zinc-200 text-xs space-y-3">
            <div className="flex items-center justify-between">
              {isPrintPortal ? (
                <span className="text-zinc-600 font-bold block text-xs">
                  {invoice.clientHeaderLabel}:
                </span>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={invoice.clientHeaderLabel}
                    onChange={(e) =>
                      setInvoice((prev) => ({ ...prev, clientHeaderLabel: e.target.value }))
                    }
                    className="text-xs font-bold text-zinc-700 bg-transparent border-b border-transparent hover:border-zinc-300 focus:outline-none w-56"
                  />
                  <span className="text-zinc-400">:</span>
                </div>
              )}

              {!isPrintPortal && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddCustomClientField}
                  className="h-6 text-[10px] text-indigo-600 hover:bg-indigo-50 gap-1 font-bold cursor-pointer"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>إضافة حقل للعميل</span>
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                {isPrintPortal ? (
                  <span className="font-bold text-sm text-zinc-900 block">
                    {invoice.clientName || '—'}
                  </span>
                ) : (
                  <input
                    type="text"
                    value={invoice.clientName}
                    onChange={(e) => setInvoice((prev) => ({ ...prev, clientName: e.target.value }))}
                    placeholder="اسم العميل أو الجهة..."
                    className="w-full font-bold text-sm text-zinc-900 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-zinc-900 focus:outline-none"
                  />
                )}
              </div>

              <div className="space-y-2">
                {invoice.showClientPhone && (
                  <div className="flex items-center gap-2 group/field">
                    {isPrintPortal ? (
                      <span className="text-zinc-500 font-semibold text-[11px]">
                        {invoice.clientPhoneLabel}:
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={invoice.clientPhoneLabel}
                        onChange={(e) =>
                          setInvoice((prev) => ({ ...prev, clientPhoneLabel: e.target.value }))
                        }
                        className="text-[11px] text-zinc-500 font-semibold bg-transparent border-b border-transparent hover:border-zinc-300 focus:outline-none w-24 text-right"
                      />
                    )}

                    {isPrintPortal ? (
                      <span className="font-mono text-zinc-800">{invoice.clientPhone || '—'}</span>
                    ) : (
                      <input
                        type="text"
                        value={invoice.clientPhone}
                        onChange={(e) =>
                          setInvoice((prev) => ({ ...prev, clientPhone: e.target.value }))
                        }
                        placeholder="091-XXXXXXX"
                        className="flex-1 font-mono text-zinc-800 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-zinc-900 focus:outline-none text-left"
                      />
                    )}

                    {!isPrintPortal && (
                      <button
                        type="button"
                        onClick={() => setInvoice((prev) => ({ ...prev, showClientPhone: false }))}
                        className="opacity-0 group-hover/field:opacity-100 text-zinc-400 hover:text-rose-600 p-0.5 cursor-pointer"
                        title="حذف حقل الهاتف"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}

                {invoice.showClientAddress && (
                  <div className="flex items-center gap-2 group/field">
                    {isPrintPortal ? (
                      <span className="text-zinc-500 font-semibold text-[11px]">
                        {invoice.clientAddressLabel}:
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={invoice.clientAddressLabel}
                        onChange={(e) =>
                          setInvoice((prev) => ({ ...prev, clientAddressLabel: e.target.value }))
                        }
                        className="text-[11px] text-zinc-500 font-semibold bg-transparent border-b border-transparent hover:border-zinc-300 focus:outline-none w-24 text-right"
                      />
                    )}

                    {isPrintPortal ? (
                      <span className="text-zinc-800">{invoice.clientAddress || '—'}</span>
                    ) : (
                      <input
                        type="text"
                        value={invoice.clientAddress}
                        onChange={(e) =>
                          setInvoice((prev) => ({ ...prev, clientAddress: e.target.value }))
                        }
                        placeholder="المدينة / المنطقة"
                        className="flex-1 text-zinc-800 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-zinc-900 focus:outline-none"
                      />
                    )}

                    {!isPrintPortal && (
                      <button
                        type="button"
                        onClick={() => setInvoice((prev) => ({ ...prev, showClientAddress: false }))}
                        className="opacity-0 group-hover/field:opacity-100 text-zinc-400 hover:text-rose-600 p-0.5 cursor-pointer"
                        title="حذف حقل العنوان"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}

                {invoice.customClientFields?.map((field) => (
                  <div key={field.id} className="flex items-center gap-2 group/field">
                    {isPrintPortal ? (
                      <span className="text-zinc-500 font-semibold text-[11px]">{field.label}:</span>
                    ) : (
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => {
                          const val = e.target.value
                          setInvoice((prev) => ({
                            ...prev,
                            customClientFields: prev.customClientFields.map((f) =>
                              f.id === field.id ? { ...f, label: val } : f
                            ),
                          }))
                        }}
                        className="text-[11px] text-zinc-500 font-semibold bg-transparent border-b border-transparent hover:border-zinc-300 focus:outline-none w-24 text-right"
                      />
                    )}

                    {isPrintPortal ? (
                      <span className="text-zinc-800">{field.value || '—'}</span>
                    ) : (
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => {
                          const val = e.target.value
                          setInvoice((prev) => ({
                            ...prev,
                            customClientFields: prev.customClientFields.map((f) =>
                              f.id === field.id ? { ...f, value: val } : f
                            ),
                          }))
                        }}
                        placeholder="أدخل القيمة..."
                        className="flex-1 text-zinc-800 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-zinc-900 focus:outline-none"
                      />
                    )}

                    {!isPrintPortal && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomClientField(field.id)}
                        className="opacity-0 group-hover/field:opacity-100 text-zinc-400 hover:text-rose-600 p-0.5 cursor-pointer"
                        title="حذف هذا الحقل"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      // 3. Grid Table Section (With Cell Merging & Row/Col Reordering)
      case 'grid':
        return (
          <div className="my-4 overflow-x-auto select-none">
            {/* Table Control Quick Bar when cells are selected */}
            {!isPrintPortal && selectedCells.length > 0 && (
              <div className="mb-2 p-2 bg-zinc-900 text-white rounded-xl shadow-md flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
                <div className="flex items-center gap-2">
                  <span className="font-bold bg-cyan-600 px-2 py-0.5 rounded-full text-[11px]">
                    تم تحديد {selectedCells.length} خلية
                  </span>

                  {/* Independent Cell Color Picker */}
                  <div className="flex items-center gap-1.5 mr-2">
                    <span className="text-[11px] text-zinc-400">لون الخلية:</span>
                    {COLOR_PALETTES.map((color) => (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => handleStyleSelectedCells({ bgColor: color.bg, textColor: color.text })}
                        style={{ backgroundColor: color.bg }}
                        className="w-4 h-4 rounded-full border border-zinc-500 hover:scale-125 transition-transform cursor-pointer"
                        title={`تغيير لون الخلايا فقط إلى ${color.name}`}
                      />
                    ))}
                  </div>

                  {/* Formatting Buttons */}
                  <div className="flex items-center gap-1 border-r border-zinc-700 pr-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const firstCell = invoice.rows.find((r) => r.id === selectedCells[0]?.rowId)?.cells[selectedCells[0]?.colId]
                        handleStyleSelectedCells({ bold: !firstCell?.bold })
                      }}
                      className="h-7 w-7 p-0 text-white hover:bg-zinc-800 cursor-pointer"
                      title="غامق (Bold)"
                    >
                      <Bold className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const firstCell = invoice.rows.find((r) => r.id === selectedCells[0]?.rowId)?.cells[selectedCells[0]?.colId]
                        handleStyleSelectedCells({ italic: !firstCell?.italic })
                      }}
                      className="h-7 w-7 p-0 text-white hover:bg-zinc-800 cursor-pointer"
                      title="مائل (Italic)"
                    >
                      <Italic className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStyleSelectedCells({ align: 'right' })}
                      className="h-7 w-7 p-0 text-white hover:bg-zinc-800 cursor-pointer"
                      title="محاذاة يمين"
                    >
                      <AlignRight className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStyleSelectedCells({ align: 'center' })}
                      className="h-7 w-7 p-0 text-white hover:bg-zinc-800 cursor-pointer"
                      title="محاذاة وسط"
                    >
                      <AlignCenter className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStyleSelectedCells({ align: 'left' })}
                      className="h-7 w-7 p-0 text-white hover:bg-zinc-800 cursor-pointer"
                      title="محاذاة يسار"
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Merge Cells Button */}
                  {canMergeSelectedCells() && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleMergeCells}
                      className="h-7 gap-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
                      title="دمج الخلايا المحددة أفقياً"
                    >
                      <Combine className="w-3.5 h-3.5" />
                      <span>دمج الخلايا ({selectedCells.length})</span>
                    </Button>
                  )}

                  {/* Unmerge Cells Button */}
                  {hasMergedCellSelected() && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleUnmergeCells}
                      className="h-7 gap-1 border-zinc-600 text-zinc-200 hover:bg-zinc-800 text-xs font-bold cursor-pointer"
                      title="إلغاء الدمج واستعادة الخلايا الأصلية"
                    >
                      <Split className="w-3.5 h-3.5" />
                      <span>إلغاء الدمج</span>
                    </Button>
                  )}

                  {/* Clear Cells Content */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSelectedCells}
                    className="h-7 text-zinc-400 hover:text-white text-xs cursor-pointer"
                    title="مسح محتوى الخلايا المحددة"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                  </Button>

                  {/* Cancel Selection */}
                  <button
                    type="button"
                    onClick={() => setSelectedCells([])}
                    className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer"
                  >
                    إلغاء التحديد
                  </button>
                </div>
              </div>
            )}

            {/* Main Table */}
            <table className="w-full border-collapse border border-zinc-300 text-xs text-right">
              <thead>
                <tr className="bg-zinc-900 text-white">
                  {/* Row drag handle header */}
                  {!isPrintPortal && <th className="w-10 border border-zinc-800 print:hidden text-center">#</th>}

                  {invoice.columns.map((col, cIdx) => {
                    const headerStyle: React.CSSProperties = {
                      width: col.width,
                      backgroundColor: col.bgColor || undefined,
                      color: col.textColor || undefined,
                      textAlign: col.align || 'center',
                    }

                    if (isPrintPortal) {
                      return (
                        <th key={col.id} style={headerStyle} className="p-2.5 font-bold border border-zinc-800">
                          {col.header}
                        </th>
                      )
                    }

                    return (
                      <th
                        key={col.id}
                        style={headerStyle}
                        onClick={() => {
                          setSelectedCol(col.id)
                          setSelectedCells([]) // Independent
                        }}
                        className={`p-2.5 font-bold border border-zinc-800 relative group cursor-pointer ${
                          selectedCol === col.id ? 'ring-2 ring-cyan-400' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          {/* Move Column Left Button */}
                          {cIdx > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleMoveColumn(cIdx, 'left')
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-white rounded cursor-pointer"
                              title="تحريك هذا العمود لليمين"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}

                          <input
                            type="text"
                            value={col.header}
                            onChange={(e) => {
                              const val = e.target.value
                              setInvoice((prev) => ({
                                ...prev,
                                columns: prev.columns.map((c) => (c.id === col.id ? { ...c, header: val } : c)),
                              }))
                            }}
                            className="bg-transparent text-inherit font-bold text-center w-full focus:outline-none focus:bg-zinc-800/80 rounded px-1"
                          />

                          {/* Move Column Right Button */}
                          {cIdx < invoice.columns.length - 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleMoveColumn(cIdx, 'right')
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-white rounded cursor-pointer"
                              title="تحريك هذا العمود لليسار"
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Column Header Controls Dropdown / Actions */}
                        {invoice.columns.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveColumn(col.id)
                            }}
                            className="absolute -top-2 -left-2 bg-rose-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow-xs"
                            title="حذف هذا العمود"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </th>
                    )
                  })}
                  {!isPrintPortal && <th className="w-14 border border-zinc-800 print:hidden text-center">إجراءات</th>}
                </tr>
              </thead>

              <tbody>
                {invoice.rows.map((row, rIdx) => (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      rIdx % 2 === 1 ? 'bg-zinc-50/60' : 'bg-white'
                    } ${dragOverRowIndex === rIdx ? 'border-t-2 border-cyan-500' : ''}`}
                  >
                    {/* Row Handle Column (Move Up / Down & Reorder) */}
                    {!isPrintPortal && (
                      <td className="w-10 p-1 text-center border border-zinc-200 print:hidden text-zinc-400">
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleSelectRow(row.id)}
                            className="text-[10px] font-mono hover:text-cyan-600 font-bold cursor-pointer"
                            title="تحديد كافة خلايا هذا الصف"
                          >
                            {rIdx + 1}
                          </button>
                        </div>
                      </td>
                    )}

                    {/* Table Cells (With colSpan and Merging Check) */}
                    {invoice.columns.map((col) => {
                      const cell = row.cells[col.id] || { value: '' }

                      // If cell is merged into another, skip rendering
                      if (cell.mergedInto) return null

                      const isSelected = isCellSelected(row.id, col.id)
                      const colSpan = cell.colSpan || 1

                      const cellStyle: React.CSSProperties = {
                        backgroundColor: cell.bgColor,
                        color: cell.textColor,
                        fontWeight: cell.bold ? 'bold' : 'normal',
                        fontStyle: cell.italic ? 'italic' : 'normal',
                        textAlign: cell.align || col.align || 'center',
                      }

                      if (isPrintPortal) {
                        return (
                          <td
                            key={col.id}
                            colSpan={colSpan > 1 ? colSpan : undefined}
                            style={cellStyle}
                            className="p-1.5 border border-zinc-300 align-middle"
                          >
                            {cell.imageUrl && (
                              <div className={`flex items-center ${
                                cell.align === 'right' ? 'justify-start' : cell.align === 'left' ? 'justify-end' : 'justify-center'
                              } my-1`}>
                                <img
                                  src={cell.imageUrl}
                                  alt="صورة الخلية"
                                  style={{
                                    maxHeight: `${cell.imageHeight || 50}px`,
                                    maxWidth: `${cell.imageWidth || 80}px`,
                                    objectFit: 'contain',
                                  }}
                                  className="rounded border border-zinc-200"
                                />
                              </div>
                            )}
                            {cell.value ? <div>{cell.value}</div> : !cell.imageUrl ? '—' : null}
                          </td>
                        )
                      }

                      return (
                        <td
                          key={col.id}
                          colSpan={colSpan > 1 ? colSpan : undefined}
                          style={cellStyle}
                          onMouseDown={(e) => {
                            setIsMouseDownOnCells(true)
                            handleCellClick(row.id, col.id, e)
                          }}
                          onMouseEnter={() => handleCellMouseEnter(row.id, col.id)}
                          className={`p-1 border border-zinc-200 transition-all relative cursor-cell align-middle ${
                            isSelected ? 'ring-2 ring-cyan-500 bg-cyan-50/50 z-10' : ''
                          }`}
                        >
                          {/* Cell Image if present */}
                          {cell.imageUrl && (
                            <div className={`relative group/img flex items-center ${
                              cell.align === 'right' ? 'justify-start' : cell.align === 'left' ? 'justify-end' : 'justify-center'
                            } my-1`}>
                              <img
                                src={cell.imageUrl}
                                alt="صورة الخلية"
                                style={{
                                  maxHeight: `${cell.imageHeight || 50}px`,
                                  maxWidth: `${cell.imageWidth || 80}px`,
                                  objectFit: 'contain',
                                }}
                                className="rounded border border-zinc-300 shadow-xs bg-white"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemoveCellImage(row.id, col.id)
                                }}
                                className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 p-0.5 rounded-full bg-rose-600 text-white opacity-0 group-hover/img:opacity-100 transition-opacity hover:scale-110 shadow-xs cursor-pointer z-20"
                                title="إزالة الصورة من الخلية"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}

                          <input
                            type="text"
                            value={cell.value}
                            onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
                            style={cellStyle}
                            className="w-full bg-transparent border-none focus:outline-none p-1 font-inherit text-inherit"
                            placeholder={cell.imageUrl ? 'نص اختياري...' : '-'}
                          />

                          {/* Merged Cell Indicator Badge */}
                          {colSpan > 1 && (
                            <span className="absolute top-0.5 left-0.5 text-[9px] bg-cyan-100 text-cyan-800 px-1 rounded font-bold opacity-60">
                              مدمجة ({colSpan})
                            </span>
                          )}
                        </td>
                      )
                    })}

                    {/* Row Reorder Actions (Up / Down / Duplicate / Delete) */}
                    {!isPrintPortal && (
                      <td className="w-14 p-1 text-center border border-zinc-200 print:hidden">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            disabled={rIdx === 0}
                            onClick={() => handleMoveRow(rIdx, 'up')}
                            className="p-0.5 text-zinc-400 hover:text-cyan-600 disabled:opacity-20 cursor-pointer"
                            title="تحريك هذا الصف لأعلى"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={rIdx === invoice.rows.length - 1}
                            onClick={() => handleMoveRow(rIdx, 'down')}
                            className="p-0.5 text-zinc-400 hover:text-cyan-600 disabled:opacity-20 cursor-pointer"
                            title="تحريك هذا الصف لأسفل"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateRow(rIdx)}
                            className="p-0.5 text-zinc-400 hover:text-indigo-600 cursor-pointer"
                            title="تكرار هذا الصف"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          {invoice.rows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(row.id)}
                              className="p-0.5 text-zinc-400 hover:text-rose-600 cursor-pointer"
                              title="حذف هذا الصف"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Quick Add Row Button & Instruction */}
            {!isPrintPortal && (
              <div className="pt-2 flex items-center justify-between text-xs text-zinc-400 print:hidden">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddRow}
                  className="h-8 gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-bold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة صف جديد</span>
                </Button>

                <span className="text-[11px]">
                  💡 <b>تحديد متعدد:</b> اسحب بالماوس أو اضغط <kbd className="px-1 py-0.5 bg-zinc-200 rounded">Ctrl</kbd> / <kbd className="px-1 py-0.5 bg-zinc-200 rounded">Shift</kbd> لتحديد خلايا متعددة لدمجها أو تلوينها معاً.
                </span>
              </div>
            )}
          </div>
        )

      // 4. Summary Totals Section
      case 'summary':
        return (
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 my-4 pt-4 border-t-2 border-zinc-200">
            {/* Context & Currency Selector */}
            <div className="flex-1 text-xs text-zinc-500 space-y-2">
              {!isPrintPortal && (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>تخصيص بنود وعملة الفاتورة:</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-zinc-400">العملة:</span>
                      <input
                        type="text"
                        value={invoice.currencySymbol}
                        onChange={(e) => setInvoice((prev) => ({ ...prev, currencySymbol: e.target.value }))}
                        className="w-14 text-center font-bold font-mono text-zinc-900 bg-white border border-zinc-300 rounded px-1 py-0.5 text-xs focus:outline-none"
                        title="انقر لتغيير رمز العملة (د.ل، $، ر.س، إلخ)"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddCustomSummaryItem('add')}
                      className="h-6 text-[10px] gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 cursor-pointer font-bold"
                    >
                      <Plus className="w-2.5 h-2.5" /> إضافة بند زيادة (شحن / رسوم)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddCustomSummaryItem('subtract')}
                      className="h-6 text-[10px] gap-1 text-rose-700 border-rose-300 hover:bg-rose-50 cursor-pointer font-bold"
                    >
                      <Plus className="w-2.5 h-2.5" /> إضافة بند خصم (عربون / دفعة)
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Calculation Cards */}
            <div className="w-full sm:w-80 space-y-2 text-xs">
              {/* Subtotal */}
              {invoice.showSubtotal ? (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 group">
                  <div className="flex items-center gap-1">
                    {!isPrintPortal && (
                      <button
                        type="button"
                        onClick={() => setInvoice((prev) => ({ ...prev, showSubtotal: false }))}
                        className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-600 p-0.5 cursor-pointer"
                        title="إخفاء المجموع الفرعي"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    {isPrintPortal ? (
                      <span className="text-zinc-600 font-semibold">{invoice.subtotalLabel}:</span>
                    ) : (
                      <input
                        type="text"
                        value={invoice.subtotalLabel}
                        onChange={(e) => setInvoice((prev) => ({ ...prev, subtotalLabel: e.target.value }))}
                        className="text-zinc-600 font-semibold bg-transparent border-b border-transparent hover:border-zinc-300 focus:outline-none w-28 text-xs"
                      />
                    )}
                  </div>
                  {isPrintPortal ? (
                    <span className="font-mono font-bold text-zinc-900 text-sm">
                      {subtotal.toFixed(2)} {invoice.currencySymbol}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={isSubtotalManual ? String(invoice.customSubtotal) : subtotal.toFixed(2)}
                          onChange={(e) => {
                            const val = e.target.value
                            setInvoice((prev) => ({ ...prev, customSubtotal: val }))
                          }}
                          className={`w-24 px-2 py-0.5 text-left font-mono font-bold text-xs rounded border transition-colors ${
                            isSubtotalManual
                              ? 'bg-amber-50 text-amber-900 border-amber-300 focus:ring-1 focus:ring-amber-500'
                              : 'bg-white text-zinc-900 border-zinc-200 hover:border-zinc-300 focus:border-zinc-400'
                          } focus:outline-none`}
                          title={
                            isSubtotalManual
                              ? `قيمة معدلة يدوياً (المحسوب: ${calculatedSubtotal.toFixed(2)}) - انقر على الزر للاستعادة`
                              : 'انقر لتعديل المجموع الفرعي يدوياً'
                          }
                        />
                      </div>
                      {isSubtotalManual && (
                        <button
                          type="button"
                          onClick={() => setInvoice((prev) => ({ ...prev, customSubtotal: null }))}
                          className="p-1 rounded text-amber-600 hover:bg-amber-100 transition-colors cursor-pointer"
                          title={`استعادة الحساب التلقائي (${calculatedSubtotal.toFixed(2)} ${invoice.currencySymbol})`}
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                      <span className="text-zinc-500 font-semibold text-xs">{invoice.currencySymbol}</span>
                    </div>
                  )}
                </div>
              ) : (
                !isPrintPortal && (
                  <button
                    type="button"
                    onClick={() => setInvoice((prev) => ({ ...prev, showSubtotal: true }))}
                    className="w-full py-1 text-[11px] text-zinc-500 hover:underline flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> إظهار المجموع الفرعي
                  </button>
                )
              )}

              {/* Discount Row */}
              {invoice.showDiscount ? (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-rose-50/60 border border-rose-200/80 group">
                  <div className="flex items-center gap-1.5">
                    {!isPrintPortal && (
                      <button
                        type="button"
                        onClick={() => setInvoice((prev) => ({ ...prev, showDiscount: false, discount: 0 }))}
                        className="text-zinc-400 hover:text-rose-600 p-0.5 rounded cursor-pointer transition-colors"
                        title="حذف بند الخصم نهائياً"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    {isPrintPortal ? (
                      <span className="text-rose-900 font-bold">{invoice.discountLabel}</span>
                    ) : (
                      <input
                        type="text"
                        value={invoice.discountLabel}
                        onChange={(e) => setInvoice((prev) => ({ ...prev, discountLabel: e.target.value }))}
                        className="font-bold text-rose-900 bg-transparent border-b border-transparent hover:border-rose-300 focus:outline-none w-28 text-xs"
                      />
                    )}
                  </div>

                  {isPrintPortal ? (
                    <span className="font-mono font-bold text-rose-600">
                      -{discountAmount.toFixed(2)} {invoice.currencySymbol}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={invoice.discount}
                        onChange={(e) =>
                          setInvoice((prev) => ({ ...prev, discount: parseFloat(e.target.value) || 0 }))
                        }
                        className="w-20 font-mono font-bold text-rose-600 bg-transparent text-left border-b border-rose-300 focus:outline-none"
                      />
                      <span className="text-rose-500 font-semibold">{invoice.currencySymbol}</span>
                    </div>
                  )}
                </div>
              ) : (
                !isPrintPortal && (
                  <button
                    type="button"
                    onClick={() => setInvoice((prev) => ({ ...prev, showDiscount: true, discount: 0 }))}
                    className="w-full py-1.5 px-3 border border-dashed border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>إضافة بند الخصم الممنوح</span>
                  </button>
                )
              )}

              {/* Tax Row */}
              {invoice.showTax ? (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200/80 group">
                  <div className="flex items-center gap-1.5">
                    {!isPrintPortal && (
                      <button
                        type="button"
                        onClick={() => setInvoice((prev) => ({ ...prev, showTax: false, taxRate: 0 }))}
                        className="text-zinc-400 hover:text-rose-600 p-0.5 rounded cursor-pointer transition-colors"
                        title="حذف بند الضريبة نهائياً"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    {isPrintPortal ? (
                      <span className="text-emerald-900 font-bold">
                        {invoice.taxLabel} ({invoice.taxRate}%)
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={invoice.taxLabel}
                        onChange={(e) => setInvoice((prev) => ({ ...prev, taxLabel: e.target.value }))}
                        className="font-bold text-emerald-900 bg-transparent border-b border-transparent hover:border-emerald-300 focus:outline-none w-28 text-xs"
                      />
                    )}
                  </div>

                  {isPrintPortal ? (
                    <span className="font-mono font-bold text-emerald-600">
                      +{taxAmount.toFixed(2)} {invoice.currencySymbol}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={invoice.taxRate}
                        onChange={(e) =>
                          setInvoice((prev) => ({ ...prev, taxRate: parseFloat(e.target.value) || 0 }))
                        }
                        className="w-14 font-mono font-bold text-emerald-600 bg-transparent text-left border-b border-emerald-300 focus:outline-none"
                      />
                      <span className="text-emerald-500 font-semibold">%</span>
                      <span className="text-[10px] text-emerald-700 font-mono">
                        (+{taxAmount.toFixed(2)})
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                !isPrintPortal && (
                  <button
                    type="button"
                    onClick={() => setInvoice((prev) => ({ ...prev, showTax: true, taxRate: 15 }))}
                    className="w-full py-1.5 px-3 border border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>إضافة بند الضريبة المضافة</span>
                  </button>
                )
              )}

              {/* Custom Summary Items */}
              {invoice.customSummaryItems?.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border group ${
                    item.type === 'subtract'
                      ? 'bg-rose-50/40 border-rose-200'
                      : 'bg-emerald-50/40 border-emerald-200'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {!isPrintPortal && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomSummaryItem(item.id)}
                        className="text-zinc-400 hover:text-rose-600 p-0.5 cursor-pointer"
                        title="حذف هذا البند"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    {isPrintPortal ? (
                      <span className="font-bold text-zinc-800">{item.label}</span>
                    ) : (
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) => {
                          const val = e.target.value
                          setInvoice((prev) => ({
                            ...prev,
                            customSummaryItems: prev.customSummaryItems.map((i) =>
                              i.id === item.id ? { ...i, label: val } : i
                            ),
                          }))
                        }}
                        className="font-bold text-zinc-800 bg-transparent border-b border-transparent hover:border-zinc-300 focus:outline-none w-32 text-xs"
                      />
                    )}
                  </div>

                  {isPrintPortal ? (
                    <span
                      className={`font-mono font-bold ${
                        item.type === 'subtract' ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    >
                      {item.type === 'subtract' ? '-' : '+'}
                      {Number(item.amount).toFixed(2)} {invoice.currencySymbol}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className={item.type === 'subtract' ? 'text-rose-600' : 'text-emerald-600'}>
                        {item.type === 'subtract' ? '-' : '+'}
                      </span>
                      <input
                        type="number"
                        value={item.amount}
                        onChange={(e) => {
                          const amt = parseFloat(e.target.value) || 0
                          setInvoice((prev) => ({
                            ...prev,
                            customSummaryItems: prev.customSummaryItems.map((i) =>
                              i.id === item.id ? { ...i, amount: amt } : i
                            ),
                          }))
                        }}
                        className="w-20 font-mono font-bold bg-transparent text-left border-b border-zinc-300 focus:outline-none"
                      />
                      <span className="text-zinc-500 font-semibold">{invoice.currencySymbol}</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Grand Total Final Card */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950 text-white shadow-md">
                {isPrintPortal ? (
                  <span className="font-extrabold text-xs">{invoice.grandTotalLabel}:</span>
                ) : (
                  <input
                    type="text"
                    value={invoice.grandTotalLabel}
                    onChange={(e) => setInvoice((prev) => ({ ...prev, grandTotalLabel: e.target.value }))}
                    className="font-extrabold text-xs bg-transparent border-b border-transparent hover:border-zinc-700 focus:outline-none text-white w-40"
                  />
                )}
                {isPrintPortal ? (
                  <span className="font-mono font-black text-lg text-emerald-400">
                    {grandTotal.toFixed(2)} {invoice.currencySymbol}
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={isGrandTotalManual ? String(invoice.customGrandTotal) : grandTotal.toFixed(2)}
                        onChange={(e) => {
                          const val = e.target.value
                          setInvoice((prev) => ({ ...prev, customGrandTotal: val }))
                        }}
                        className={`w-28 px-2 py-0.5 text-left font-mono font-black text-sm rounded border transition-colors ${
                          isGrandTotalManual
                            ? 'bg-amber-950/60 text-amber-300 border-amber-500/60 focus:ring-1 focus:ring-amber-400'
                            : 'bg-zinc-900 text-emerald-400 border-zinc-700 hover:border-zinc-600 focus:border-zinc-500'
                        } focus:outline-none`}
                        title={
                          isGrandTotalManual
                            ? `المبلغ النهائي معدل يدوياً (المحسوب: ${calculatedGrandTotal.toFixed(2)}) - انقر على الزر للاستعادة`
                            : 'انقر لتعديل المبلغ النهائي يدوياً'
                        }
                      />
                    </div>
                    {isGrandTotalManual && (
                      <button
                        type="button"
                        onClick={() => setInvoice((prev) => ({ ...prev, customGrandTotal: null }))}
                        className="p-1 rounded text-amber-400 hover:bg-amber-900/40 transition-colors cursor-pointer"
                        title={`استعادة الحساب التلقائي (${calculatedGrandTotal.toFixed(2)} ${invoice.currencySymbol})`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <span className="font-bold text-emerald-400 text-sm">{invoice.currencySymbol}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      // 5. Notes Section
      case 'notes':
        return (
          <div className="my-4 text-xs">
            {isPrintPortal ? (
              <span className="text-[11px] font-bold text-zinc-600 block mb-1">
                {invoice.notesTitle}:
              </span>
            ) : (
              <input
                type="text"
                value={invoice.notesTitle}
                onChange={(e) => setInvoice((prev) => ({ ...prev, notesTitle: e.target.value }))}
                className="text-[11px] font-bold text-zinc-700 bg-transparent border-b border-transparent hover:border-zinc-300 focus:outline-none w-56 mb-1 block"
              />
            )}

            {isPrintPortal ? (
              <p className="text-zinc-800 p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 leading-relaxed whitespace-pre-wrap">
                {invoice.notes || '—'}
              </p>
            ) : (
              <textarea
                rows={2}
                value={invoice.notes}
                onChange={(e) => setInvoice((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="أدخل الشروط، طريقة التحويل، أو أي تفاصيل إضافية..."
                className="w-full p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50 text-zinc-800 focus:outline-none focus:border-zinc-900 resize-none transition-colors"
              />
            )}
          </div>
        )

      // 6. Terms Section
      case 'terms':
        return (
          <div className="my-4 text-xs">
            {isPrintPortal ? (
              <span className="text-[11px] font-bold text-zinc-600 block mb-1">
                {invoice.termsTitle}:
              </span>
            ) : (
              <input
                type="text"
                value={invoice.termsTitle}
                onChange={(e) => setInvoice((prev) => ({ ...prev, termsTitle: e.target.value }))}
                className="text-[11px] font-bold text-zinc-700 bg-transparent border-b border-transparent hover:border-zinc-300 focus:outline-none w-56 mb-1 block"
              />
            )}

            {isPrintPortal ? (
              <p className="text-zinc-800 p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 leading-relaxed whitespace-pre-wrap">
                {invoice.terms || '—'}
              </p>
            ) : (
              <textarea
                rows={2}
                value={invoice.terms}
                onChange={(e) => setInvoice((prev) => ({ ...prev, terms: e.target.value }))}
                placeholder="شروط الضمان أو سياسة الاستبدال والاسترجاع..."
                className="w-full p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50 text-zinc-800 focus:outline-none focus:border-zinc-900 resize-none transition-colors"
              />
            )}
          </div>
        )

      // 7. Signatures and Stamp Section
      case 'signatures':
        return (
          <div className="pt-6 my-4 border-t border-zinc-300 text-center text-xs font-bold text-zinc-700">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-start">
              {invoice.signaturesList?.map((sig) => (
                <div key={sig.id} className="p-3 rounded-lg bg-zinc-50/50 border border-zinc-100 group/sig">
                  <div className="flex items-center justify-between pb-3">
                    {isPrintPortal ? (
                      <span className="w-full text-center">{sig.label}</span>
                    ) : (
                      <input
                        type="text"
                        value={sig.label}
                        onChange={(e) => {
                          const val = e.target.value
                          setInvoice((prev) => ({
                            ...prev,
                            signaturesList: prev.signaturesList.map((s) =>
                              s.id === sig.id ? { ...s, label: val } : s
                            ),
                          }))
                        }}
                        className="text-center font-bold text-zinc-800 bg-transparent border-b border-transparent hover:border-zinc-300 focus:outline-none w-full"
                      />
                    )}

                    {!isPrintPortal && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSignature(sig.id)}
                        className="opacity-0 group-hover/sig:opacity-100 text-zinc-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                        title="حذف هذا التوقيع"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {sig.type === 'stamp' ? (
                    <div className="w-20 h-20 mx-auto rounded-full border-2 border-dashed border-zinc-300 flex items-center justify-center text-[10px] text-zinc-400">
                      موضع الختم
                    </div>
                  ) : (
                    <div className="border-b border-dashed border-zinc-400 w-3/4 mx-auto pt-8" />
                  )}
                </div>
              ))}
            </div>

            {!isPrintPortal && (
              <div className="pt-3 flex flex-wrap items-center justify-center gap-2 print:hidden">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddSignature('sign')}
                  className="h-6 text-[10px] gap-1 cursor-pointer font-bold"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>إضافة توقيع مسؤول جديد</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddSignature('stamp')}
                  className="h-6 text-[10px] gap-1 cursor-pointer font-bold"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>إضافة موضع ختم إضافي</span>
                </Button>
              </div>
            )}
          </div>
        )

      // 8. Custom Extra Section
      case 'custom':
        return (
          <div className="my-4 text-xs">
            {isPrintPortal ? (
              <span className="text-[11px] font-bold text-zinc-600 block mb-1">{section.title}:</span>
            ) : (
              <input
                type="text"
                value={section.title}
                onChange={(e) => {
                  const val = e.target.value
                  setInvoice((prev) => ({
                    ...prev,
                    sections: prev.sections.map((s) => (s.id === section.id ? { ...s, title: val } : s)),
                  }))
                }}
                className="text-[11px] font-bold text-zinc-700 bg-transparent border-b border-transparent hover:border-zinc-300 focus:outline-none w-56 mb-1 block"
              />
            )}

            {isPrintPortal ? (
              <p className="text-zinc-800 p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 leading-relaxed whitespace-pre-wrap">
                {section.content || '—'}
              </p>
            ) : (
              <textarea
                rows={2}
                value={section.content || ''}
                onChange={(e) => {
                  const val = e.target.value
                  setInvoice((prev) => ({
                    ...prev,
                    sections: prev.sections.map((s) => (s.id === section.id ? { ...s, content: val } : s)),
                  }))
                }}
                placeholder="أدخل النص أو تفاصيل هذا القسم..."
                className="w-full p-2.5 rounded-lg border border-zinc-200 bg-zinc-50/50 text-zinc-800 focus:outline-none focus:border-zinc-900 resize-none transition-colors"
              />
            )}
          </div>
        )

      default:
        return null
    }
  }

  // Reusable A4 Invoice Sheet Renderer (used both on screen and in print portal)
  const renderInvoiceSheet = (isPrintPortal = false) => (
    <div
      className={`bg-white text-zinc-950 font-arabic ${
        isPrintPortal
          ? 'w-full max-w-full p-4 mx-auto box-border'
          : 'rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 p-8 sm:p-12 relative overflow-hidden'
      }`}
      dir="rtl"
    >
      {/* Accent Top Border Bar (On-screen only) */}
      {!isPrintPortal && (
        <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-emerald-600 via-cyan-600 to-sky-600 print:hidden" />
      )}

      {/* Render All Enabled Sections in Dynamic Order */}
      {invoice.sections.map((section, sIdx) => {
        if (!section.visible) return null

        const isDragging = draggedSectionIndex === sIdx
        const isDragOver = dragOverSectionIndex === sIdx

        return (
          <div
            key={section.id}
            draggable={!isPrintPortal}
            onDragStart={(e) => handleDragStartSection(e, sIdx)}
            onDragOver={(e) => handleDragOverSection(e, sIdx)}
            onDrop={(e) => handleDropSection(e, sIdx)}
            onDragEnd={handleDragEndSection}
            className={`relative group transition-all rounded-xl ${
              !isPrintPortal ? 'hover:ring-1 hover:ring-zinc-300/80 p-2 -m-2' : ''
            } ${isDragging ? 'opacity-40 scale-[0.99]' : ''} ${
              isDragOver ? 'ring-2 ring-cyan-500 bg-cyan-50/30' : ''
            }`}
          >
            {/* Section Floating Action Bar (On-Screen Hover Only) */}
            {!isPrintPortal && (
              <div className="absolute top-0 left-2 -translate-y-1/2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-0.5 shadow-md flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20 print:hidden">
                <div
                  className="flex items-center gap-1 text-[10px] text-zinc-500 cursor-grab active:cursor-grabbing font-bold select-none pr-1"
                  title="اسحب هذا العنصر لإعادة ترتيب الفاتورة"
                >
                  <GripVertical className="w-3.5 h-3.5 text-zinc-400" />
                  <span>سحب</span>
                </div>

                <div className="w-px h-3 bg-zinc-200 dark:bg-zinc-700" />

                <button
                  type="button"
                  disabled={sIdx === 0}
                  onClick={() => handleMoveSection(sIdx, 'up')}
                  className="p-1 text-zinc-500 hover:text-cyan-600 disabled:opacity-30 rounded cursor-pointer"
                  title="تحريك لأعلى"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>

                <button
                  type="button"
                  disabled={sIdx === invoice.sections.length - 1}
                  onClick={() => handleMoveSection(sIdx, 'down')}
                  className="p-1 text-zinc-500 hover:text-cyan-600 disabled:opacity-30 rounded cursor-pointer"
                  title="تحريك لأسفل"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>

                <div className="w-px h-3 bg-zinc-200 dark:bg-zinc-700" />

                <button
                  type="button"
                  onClick={() => handleToggleSection(section.id)}
                  className="p-1 text-rose-500 hover:text-rose-700 rounded cursor-pointer"
                  title="حذف أو إخفاء هذا الكومبوننت من الفاتورة"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Actual Section Body */}
            {renderSectionContent(section, isPrintPortal, sIdx)}
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="min-h-full bg-slate-100/70 dark:bg-zinc-950 font-arabic text-zinc-900 dark:text-zinc-100 pb-16" dir="rtl">
      {/* ── TOP CONTROL TOOLBAR (Hidden during print) ────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 shadow-xs print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Right Section: Title & Badge */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-600 text-white shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold text-zinc-950 dark:text-white">
                  بيئة إنشاء فواتير Exel
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  دمج خلايا وترتيب
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                دمج الخلايا، تحريك الصفوف والأعمدة، تلوين الخلايا بشكل مستقل، والطباعة والتصدير
              </p>
            </div>
          </div>

          {/* Quick Action Tools Bar */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* 1. Add Column Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddColumn}
              className="h-8 gap-1 text-xs border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              title="إضافة عمود جديد إلى الجدول"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>إضافة عمود</span>
            </Button>

            {/* 2. Add Row Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRow}
              className="h-8 gap-1 text-xs border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              title="إضافة صف جديد إلى الجدول"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>إضافة صف</span>
            </Button>

            {/* 3. Text in Cell Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenCellTextModal}
              disabled={selectedCells.length === 0}
              className="h-8 gap-1 text-xs border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-40"
              title="إضافة أو تعديل نص داخل الخلايا المحددة"
            >
              <Type className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>نص الخلية</span>
            </Button>

            {/* 3.5 Insert Image into Cell */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={selectedCells.length === 0}
                  className="h-8 gap-1 text-xs border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-40"
                  title="إدراج أو ضبط صورة داخل الخلية المحددة"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>صورة بالخلية</span>
                  <ChevronDown className="w-3 h-3 text-zinc-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 font-arabic text-xs">
                <DropdownMenuItem
                  onClick={() => cellImageInputRef.current?.click()}
                  className="gap-2 cursor-pointer font-bold"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                  <span>اختيار صورة من الجهاز للخلية</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setCellImageSettingsOpen(true)}
                  className="gap-2 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5 text-violet-500" />
                  <span>تكبير / تصغير حجم صورة الخلية</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    if (selectedCells.length > 0) {
                      selectedCells.forEach((c) => handleRemoveCellImage(c.rowId, c.colId))
                    }
                  }}
                  className="gap-2 cursor-pointer text-rose-600 hover:text-rose-700"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>إزالة الصورة من الخلية المحددة</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Hidden Input for Cell Image Upload */}
            <input
              type="file"
              ref={cellImageInputRef}
              onChange={handleCellImageUpload}
              accept="image/*"
              className="hidden"
            />

            {/* 4. Logo Upload & Resize Controls */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  title="إضافة أو ضبط شعار الفاتورة"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>{invoice.logoUrl ? `الشعار (${invoice.logoSize}px)` : 'إضافة شعار'}</span>
                  <ChevronDown className="w-3 h-3 text-zinc-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 font-arabic text-xs">
                <DropdownMenuItem
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2 cursor-pointer font-bold"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{invoice.logoUrl ? 'رفع شعار بديل من الجهاز' : 'اختيار صورة الشعار من الجهاز'}</span>
                </DropdownMenuItem>
                {invoice.logoUrl && (
                  <>
                    <DropdownMenuItem
                      onClick={() => setLogoSettingsOpen(true)}
                      className="gap-2 cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5 text-violet-500" />
                      <span>تكبير وتصغير وضبط الشعار</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => setInvoice((prev) => ({ ...prev, logoUrl: '' }))}
                      className="gap-2 cursor-pointer text-rose-600 hover:text-rose-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>إزالة الشعار</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLogoUpload}
              accept="image/*"
              className="hidden"
            />

            {/* 5. Formulas Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <Calculator className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>معادلات</span>
                  <ChevronDown className="w-3 h-3 text-zinc-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 font-arabic text-xs">
                <DropdownMenuItem
                  onClick={() => handleApplyFormula('PRODUCT')}
                  className="gap-2 cursor-pointer"
                >
                  <Calculator className="w-3.5 h-3.5 text-cyan-500" />
                  <div>
                    <div className="font-bold">حاصل ضرب (الكمية × السعر)</div>
                    <div className="text-[10px] text-zinc-500">حساب إجمالي الصف تلقائياً</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleApplyFormula('SUM_COL')}
                  className="gap-2 cursor-pointer"
                >
                  <Calculator className="w-3.5 h-3.5 text-emerald-500" />
                  <div>
                    <div className="font-bold">مجموع العمود (SUM Col)</div>
                    <div className="text-[10px] text-zinc-500">جمع أرقام الخلايا في العمود للخلية المحددة</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleApplyFormula('SUM_ROW')}
                  className="gap-2 cursor-pointer"
                >
                  <Calculator className="w-3.5 h-3.5 text-amber-500" />
                  <div>
                    <div className="font-bold">مجموع الصف (SUM Row)</div>
                    <div className="text-[10px] text-zinc-500">جمع قيم خلايا الصف السابق للخلية</div>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 6. Ready Templates Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 text-xs border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                  <span>قوالب جاهزة</span>
                  <ChevronDown className="w-3 h-3 text-zinc-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 font-arabic text-xs">
                <DropdownMenuItem onClick={() => handleLoadTemplate('sales')} className="cursor-pointer">
                  🛒 فاتورة مبيعات ومشتريات
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleLoadTemplate('service')} className="cursor-pointer">
                  🛠️ فاتورة خدمات واستشارات
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleLoadTemplate('expenses')} className="cursor-pointer">
                  📊 كشف حساب ومصروفات
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleLoadTemplate('blank')} className="cursor-pointer text-zinc-500">
                  📄 قالب فارغ للبدء من الصفر
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 7. Components Manager Dialog */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setComponentsManagerOpen(true)}
              className="h-8 gap-1.5 text-xs bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800 hover:bg-cyan-100 cursor-pointer font-bold"
              title="إدارة وحذف وإظهار مكونات الفاتورة"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>إدارة المكونات ({invoice.sections.filter((s) => s.visible).length})</span>
            </Button>

            {/* 8. Saved Invoices Library */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSavedInvoicesOpen(true)}
              className="h-8 gap-1 text-xs border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              title="عرض الفواتير المحفوظة واسترجاعها"
            >
              <FolderOpen className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
              <span>فواتيري ({savedInvoices.length})</span>
            </Button>

            {/* 9. Save Draft Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveInvoice}
              className="h-8 gap-1 text-xs bg-zinc-50 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 cursor-pointer relative"
            >
              {saveSuccessNotice ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">تم الحفظ!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                  <span>حفظ الفاتورة</span>
                </>
              )}
            </Button>

            {/* 10. Export Excel / CSV */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير Exel</span>
                  <ChevronDown className="w-3 h-3 text-emerald-200" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 font-arabic text-xs">
                <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer font-bold">
                  📊 تصدير كملف إكسل (.xls ملون)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCsv} className="cursor-pointer">
                  📑 تصدير كملف جدول (.csv)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 11. Print / PDF Button */}
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="h-8 gap-1 text-xs bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 font-bold shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة / PDF</span>
            </Button>
          </div>
        </div>

        {/* ── COLUMN HEADER ONLY STYLING SUB-TOOLBAR (Appears when a column header is clicked) ── */}
        {selectedCol && selectedCells.length === 0 && (
          <div className="mt-2.5 pt-2 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs bg-cyan-50/50 dark:bg-cyan-950/20 p-2 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="font-bold text-cyan-800 dark:text-cyan-200">
                تنسيق رأس العمود (
                {invoice.columns.find((c) => c.id === selectedCol)?.header || 'العمود'}):
              </span>

              {/* Alignments */}
              <div className="flex items-center border border-zinc-300 dark:border-zinc-700 rounded-md overflow-hidden bg-white dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => handleStyleColumn(selectedCol, { align: 'right' })}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  title="محاذاة لليمين"
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStyleColumn(selectedCol, { align: 'center' })}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer border-r border-l border-zinc-200 dark:border-zinc-700"
                  title="محاذاة للوسط"
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleStyleColumn(selectedCol, { align: 'left' })}
                  className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                  title="محاذاة لليسار"
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Independent Header Color Picker */}
              <div className="flex items-center gap-1.5 mr-2">
                <span className="text-[11px] text-zinc-500">لون خلفية رأس العمود:</span>
                {COLOR_PALETTES.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() =>
                      handleStyleColumn(selectedCol, { bgColor: color.bg, textColor: color.text })
                    }
                    style={{ backgroundColor: color.bg }}
                    className="w-5 h-5 rounded-full border border-zinc-300 dark:border-zinc-600 shadow-2xs hover:scale-110 transition-transform cursor-pointer"
                    title={`تلوين رأس العمود فقط إلى ${color.name}`}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedCol(null)}
              className="text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline cursor-pointer"
            >
              إلغاء تحديد العمود
            </button>
          </div>
        )}
      </header>

      {/* ── MAIN A4 PAPER WORKSPACE CANVAS ─────────────────────────────────── */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400 bg-white/70 dark:bg-zinc-900/70 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              💡 <b>ميزات جديدة:</b> يمكنك الآن <b>دمج الخلايا</b> بتحديدها والضغط على دمج، <b>تحريك الصفوف والأعمدة</b>، و<b>تلوين الخلايا بشكل مستقل تماماً</b> عن رأس العمود!
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCustomSectionModalOpen(true)}
              className="h-7 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 font-bold cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>إضافة قسم مخصص</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setComponentsManagerOpen(true)}
              className="h-7 text-xs text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950 font-bold cursor-pointer"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>إدارة المكونات</span>
            </Button>
          </div>
        </div>

        {/* Live A4 Sheet */}
        {renderInvoiceSheet(false)}
      </main>

      {/* ── LOGO RESIZE & POSITIONING MODAL ────────────────────────────────────── */}
      <Dialog open={logoSettingsOpen} onOpenChange={setLogoSettingsOpen}>
        <DialogContent className="max-w-md font-arabic" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-indigo-500" />
              <span>ضبط وتكبير / تصغير الشعار</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-3">
            <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center min-h-[140px]">
              {invoice.logoUrl ? (
                <img
                  src={invoice.logoUrl}
                  alt="شعار"
                  style={{ height: `${invoice.logoSize}px` }}
                  className="object-contain rounded-lg transition-all"
                />
              ) : (
                <div className="text-xs text-zinc-400">لا يوجد شعار حالياً</div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <Label className="font-bold">حجم وارتفاع الشعار:</Label>
                <span className="font-mono font-bold text-cyan-600">{invoice.logoSize}px</span>
              </div>
              <input
                type="range"
                min="35"
                max="240"
                step="5"
                value={invoice.logoSize}
                onChange={(e) =>
                  setInvoice((prev) => ({ ...prev, logoSize: Number(e.target.value) }))
                }
                className="w-full accent-cyan-600 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-zinc-500">أحجام جاهزة:</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'صغير', size: 45 },
                  { label: 'متوسط', size: 75 },
                  { label: 'كبير', size: 120 },
                  { label: 'ضخم', size: 180 },
                ].map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant={invoice.logoSize === preset.size ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setInvoice((prev) => ({ ...prev, logoSize: preset.size }))}
                    className="h-8 text-xs cursor-pointer font-bold"
                  >
                    {preset.label} ({preset.size}px)
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-zinc-500">محاذاة الشعار:</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'right', label: 'يمين' },
                  { id: 'center', label: 'وسط' },
                  { id: 'left', label: 'يسار' },
                ].map((align) => (
                  <Button
                    key={align.id}
                    type="button"
                    variant={invoice.logoAlign === align.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() =>
                      setInvoice((prev) => ({
                        ...prev,
                        logoAlign: align.id as 'right' | 'center' | 'left',
                      }))
                    }
                    className="h-8 text-xs cursor-pointer font-bold"
                  >
                    {align.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setInvoice((prev) => ({ ...prev, logoUrl: '' }))
                setLogoSettingsOpen(false)
              }}
              className="text-xs gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>إزالة الشعار</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setLogoSettingsOpen(false)}
              className="text-xs cursor-pointer font-bold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
            >
              تم واعتماد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── COMPONENTS MANAGER MODAL ─────────────────────────────────────────── */}
      <Dialog open={componentsManagerOpen} onOpenChange={setComponentsManagerOpen}>
        <DialogContent className="max-w-lg font-arabic" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-cyan-600" />
                <span>إدارة وترتيب مكونات الفاتورة</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetSections}
                className="h-7 text-xs text-zinc-500 hover:text-zinc-800 gap-1 cursor-pointer font-medium"
                title="إعادة تعيين كافة المكونات إلى الوضع الافتراضي"
              >
                <RotateCcw className="w-3 h-3" />
                <span>إعادة ضبط</span>
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-zinc-500">
              قم بتفعيل أو إلغاء أي مكون لا تريده في مؤسستك، أو رتّب أماكن ظهورها بالسحب أو بالأسهم:
            </p>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {invoice.sections.map((section, idx) => (
                <div
                  key={section.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                    section.visible
                      ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-2xs'
                      : 'bg-zinc-50 dark:bg-zinc-900/40 border-dashed border-zinc-300 dark:border-zinc-800 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleToggleSection(section.id)}
                      className={`p-1 rounded-md cursor-pointer transition-colors ${
                        section.visible
                          ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60'
                          : 'text-zinc-400 hover:text-zinc-600'
                      }`}
                      title={section.visible ? 'إخفاء هذا المكون' : 'إظهار هذا المكون'}
                    >
                      {section.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>

                    <div>
                      <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        {section.title}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {section.type === 'header' && 'شعار الشركة، الاسم، رقم وتاريخ الفاتورة'}
                        {section.type === 'client' && 'اسم العميل، الهاتف، العنوان والحقول المخصصة'}
                        {section.type === 'grid' && 'جدول البنود والأسعار والكميات المحاسبي'}
                        {section.type === 'summary' && 'المجموع، الخصم، الضريبة، البنود المالية المضافة'}
                        {section.type === 'notes' && 'ملاحظات الدفع والشروط المرفقة'}
                        {section.type === 'terms' && 'شروط الضمان وسياسة الاسترجاع'}
                        {section.type === 'signatures' && 'التوقيعات المخصصة والأختام'}
                        {section.type === 'custom' && 'قسم نصي مخصص تم إنشاؤه'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveSection(idx, 'up')}
                      className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-20 rounded cursor-pointer"
                      title="تحريك لأعلى"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === invoice.sections.length - 1}
                      onClick={() => handleMoveSection(idx, 'down')}
                      className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-20 rounded cursor-pointer"
                      title="تحريك لأسفل"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    {section.type === 'custom' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSection(section.id)}
                        className="p-1 text-rose-500 hover:text-rose-700 rounded cursor-pointer mr-1"
                        title="حذف نهائي"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setComponentsManagerOpen(false)
                setCustomSectionModalOpen(true)
              }}
              className="w-full h-8 text-xs gap-1.5 border-dashed border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-bold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة قسم نصي مخصص جديد للفاتورة</span>
            </Button>
          </div>

          <DialogFooter>
            <Button
              type="button"
              size="sm"
              onClick={() => setComponentsManagerOpen(false)}
              className="w-full text-xs font-bold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 cursor-pointer"
            >
              حفظ الإعدادات وإغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ADD CUSTOM SECTION MODAL ─────────────────────────────────────────── */}
      <Dialog open={customSectionModalOpen} onOpenChange={setCustomSectionModalOpen}>
        <DialogContent className="max-w-md font-arabic" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-600" />
              <span>إضافة قسم مخصص جديد للفاتورة</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">عنوان القسم الجديد:</Label>
              <input
                type="text"
                value={customSectionTitle}
                onChange={(e) => setCustomSectionTitle(e.target.value)}
                placeholder="مثال: بيانات التحويل البنكي، أو معلومات الشحن والتسليم..."
                className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">محتوى أو تفاصيل القسم:</Label>
              <textarea
                rows={3}
                value={customSectionContent}
                onChange={(e) => setCustomSectionContent(e.target.value)}
                placeholder="أدخل النص أو التفاصيل التي تريد ظهورها في هذا القسم..."
                className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs focus:outline-none focus:border-indigo-600 resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCustomSectionModalOpen(false)}
              className="text-xs cursor-pointer"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAddCustomSection}
              disabled={!customSectionTitle.trim()}
              className="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer disabled:opacity-40"
            >
              إضافة القسم للفاتورة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CELL TEXT MODAL ─────────────────────────────────────────────────── */}
      <Dialog open={cellTextModalOpen} onOpenChange={setCellTextModalOpen}>
        <DialogContent className="max-w-md font-arabic" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Type className="w-5 h-5 text-teal-600" />
              <span>إدخال نص داخل الخلايا المحددة</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label className="text-xs text-zinc-500">
              أدخل النص أو الرقم المطلوب تطبيقه داخل {selectedCells.length} خلية محددة:
            </Label>
            <textarea
              rows={3}
              value={cellTextBuffer}
              onChange={(e) => setCellTextBuffer(e.target.value)}
              className="w-full p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm focus:outline-none focus:border-zinc-900 dark:focus:border-white resize-none"
              placeholder="اكتب المحتوى هنا..."
              autoFocus
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCellTextModalOpen(false)}
              className="text-xs cursor-pointer"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveCellText}
              className="text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white cursor-pointer"
            >
              تأكيد وإدراج
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CELL IMAGE RESIZE MODAL ────────────────────────────────────────── */}
      <Dialog open={cellImageSettingsOpen} onOpenChange={setCellImageSettingsOpen}>
        <DialogContent className="max-w-xs font-arabic" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-600" />
              <span>ضبط حجم صورة الخلية</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>ارتفاع الصورة:</span>
              <span className="font-mono text-purple-600">{currentCellImageSize}px</span>
            </div>
            <input
              type="range"
              min="20"
              max="150"
              value={currentCellImageSize}
              onChange={(e) => handleResizeCellImage(Number(e.target.value))}
              className="w-full accent-purple-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>صغيرة (20px)</span>
              <span>متوسطة (60px)</span>
              <span>كبيرة (150px)</span>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              size="sm"
              onClick={() => setCellImageSettingsOpen(false)}
              className="text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white cursor-pointer w-full"
            >
              حفظ وإغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── SAVED INVOICES & FOLDERS WORKSPACE MODAL ───────────────────────── */}
      <Dialog open={savedInvoicesOpen} onOpenChange={setSavedInvoicesOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] font-arabic p-0 overflow-hidden flex flex-col" dir="rtl">
          {/* Modal Header */}
          <DialogHeader className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-zinc-50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                <FolderTree className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  فواتيري المحفوظة والمجلدات
                </DialogTitle>
                <p className="text-[11px] text-zinc-500">
                  إدارة وتنظيم الفواتير المصممة في مجلدات مع إمكانية التعديل والنقل والاسترجاع
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-48 sm:w-56">
                <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <Input
                  type="text"
                  placeholder="بحث في الفواتير..."
                  value={searchInvoiceTerm}
                  onChange={(e) => setSearchInvoiceTerm(e.target.value)}
                  className="h-8 text-xs pr-8 pl-2 bg-white dark:bg-zinc-900"
                />
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setNewFolderName('')
                  setNewFolderDialogOpen(true)
                }}
                className="h-8 gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shrink-0"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>مجلد جديد</span>
              </Button>
            </div>
          </DialogHeader>

          {/* Modal Main Body (Folders Sidebar + Invoices List) */}
          <div className="flex-1 flex flex-col sm:flex-row overflow-hidden min-h-[440px] max-h-[540px]">
            {/* Right: Folders Sidebar */}
            <div className="w-full sm:w-56 bg-zinc-50 dark:bg-zinc-900/80 border-b sm:border-b-0 sm:border-l border-zinc-200 dark:border-zinc-800 p-2.5 flex flex-col gap-1 overflow-y-auto shrink-0">
              <div className="text-[11px] font-bold text-zinc-400 px-2 py-1">
                تصنيف الفواتير:
              </div>

              {/* All Invoices Button */}
              <button
                type="button"
                onClick={() => setSelectedFolderId('all')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer text-right ${
                  selectedFolderId === 'all'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">جميع الفواتير</span>
                </div>
                <Badge
                  variant={selectedFolderId === 'all' ? 'secondary' : 'outline'}
                  className="text-[10px] h-4 px-1.5 shrink-0"
                >
                  {savedInvoices.length}
                </Badge>
              </button>

              {/* Root / Uncategorized Button */}
              <button
                type="button"
                onClick={() => setSelectedFolderId('root')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer text-right ${
                  selectedFolderId === 'root'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">الرئيسية (عامة)</span>
                </div>
                <Badge
                  variant={selectedFolderId === 'root' ? 'secondary' : 'outline'}
                  className="text-[10px] h-4 px-1.5 shrink-0"
                >
                  {savedInvoices.filter((i) => !i.folderId).length}
                </Badge>
              </button>

              {/* Folders List Divider */}
              <div className="pt-2 pb-1 px-2 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 mt-1">
                <span className="text-[11px] font-bold text-zinc-400">
                  مجلداتي ({folders.length})
                </span>
              </div>

              {/* Custom Folders */}
              <div className="space-y-1">
                {folders.length === 0 ? (
                  <div className="text-center py-4 px-2 text-[11px] text-zinc-400 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg">
                    لا توجد مجلدات بعد. اضغط "مجلد جديد" للإنشاء.
                  </div>
                ) : (
                  folders.map((f) => {
                    const count = savedInvoices.filter((i) => i.folderId === f.id).length
                    const isSelected = selectedFolderId === f.id
                    return (
                      <div
                        key={f.id}
                        onClick={() => setSelectedFolderId(f.id)}
                        className={`group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                          <Folder className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                          <span className="truncate">{f.name}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                              isSelected
                                ? 'bg-emerald-700 text-white'
                                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                            }`}
                          >
                            {count}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingFolder(f)
                              setEditingFolderName(f.name)
                            }}
                            className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity ${
                              isSelected ? 'text-white' : 'text-zinc-400 hover:text-zinc-700'
                            }`}
                            title="تعديل اسم المجلد"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteFolder(f.id, e)}
                            className={`p-1 rounded hover:bg-rose-500/20 opacity-0 group-hover:opacity-100 transition-opacity ${
                              isSelected ? 'text-white hover:text-rose-200' : 'text-zinc-400 hover:text-rose-600'
                            }`}
                            title="حذف المجلد"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Left: Invoices List in Selected Folder */}
            <div className="flex-1 p-3.5 flex flex-col overflow-y-auto bg-white dark:bg-zinc-950">
              {/* Header Bar */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                  <span>المعروض حالياً:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-extrabold border border-emerald-200 dark:border-emerald-800">
                    {selectedFolderId === 'all'
                      ? 'جميع الفواتير'
                      : selectedFolderId === 'root'
                      ? 'الرئيسية (فواتير عامة)'
                      : folders.find((f) => f.id === selectedFolderId)?.name || 'مجلد'}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400">
                  عدد الفواتير: {
                    savedInvoices.filter((inv) => {
                      if (selectedFolderId === 'all') return true
                      if (selectedFolderId === 'root') return !inv.folderId
                      return inv.folderId === selectedFolderId
                    }).length
                  }
                </div>
              </div>

              {/* Invoices Grid / List */}
              <div className="space-y-2 flex-1">
                {(() => {
                  const items = savedInvoices.filter((inv) => {
                    if (selectedFolderId === 'all') {
                      // include
                    } else if (selectedFolderId === 'root') {
                      if (inv.folderId) return false
                    } else {
                      if (inv.folderId !== selectedFolderId) return false
                    }

                    if (searchInvoiceTerm.trim()) {
                      const q = searchInvoiceTerm.toLowerCase()
                      const titleMatch = inv.title.toLowerCase().includes(q)
                      const clientMatch = inv.data.clientName?.toLowerCase().includes(q)
                      const numMatch = inv.data.invoiceNumber?.toLowerCase().includes(q)
                      return titleMatch || clientMatch || numMatch
                    }

                    return true
                  })

                  if (items.length === 0) {
                    return (
                      <div className="text-center py-16 px-4 text-zinc-400 text-xs flex flex-col items-center justify-center gap-2">
                        <FolderOpen className="w-10 h-10 text-zinc-300 dark:text-zinc-700" />
                        <span className="font-bold">لا توجد فواتير في هذا العرض</span>
                        <span className="text-[11px] text-zinc-400 max-w-xs text-center">
                          يمكنك حفظ الفاتورة الحالية في هذا المجلد في أي وقت عبر زر "حفظ الفاتورة" من الشريط العلوي.
                        </span>
                      </div>
                    )
                  }

                  return items.map((item) => {
                    const currentFolder = folders.find((f) => f.id === item.folderId)
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 bg-white dark:bg-zinc-900/50 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        {/* Title & Info */}
                        <div
                          onClick={() => handleLoadSavedInvoice(item)}
                          className="space-y-1 flex-1 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-xs text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                              {item.title}
                            </span>
                            {currentFolder ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <Folder className="w-2.5 h-2.5" />
                                {currentFolder.name}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                عام
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-400 flex items-center gap-3 flex-wrap">
                            <span>📅 {item.date}</span>
                            <span>• 📋 {item.data.rows.length} بند</span>
                            {item.data.clientName && (
                              <span>• 👤 {item.data.clientName}</span>
                            )}
                            {item.data.invoiceNumber && (
                              <span className="font-mono text-zinc-500">#{item.data.invoiceNumber}</span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                          {/* Open / Load Button */}
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleLoadSavedInvoice(item)}
                            className="h-7 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer px-2.5 gap-1"
                          >
                            <span>استرجاع</span>
                            <span>↵</span>
                          </Button>

                          {/* Move to Folder Button */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setMovingInvoice(item)
                              setTargetFolderId(item.folderId || 'root')
                            }}
                            className="h-7 text-xs border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer px-2 gap-1"
                            title="نقل الفاتورة إلى مجلد آخر"
                          >
                            <FolderInput className="w-3.5 h-3.5 text-amber-600" />
                            <span className="hidden md:inline">نقل</span>
                          </Button>

                          {/* Rename Button */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRenamingInvoice(item)
                              setRenamingInvoiceTitle(item.title)
                            }}
                            className="h-7 text-xs border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer px-2 gap-1"
                            title="تعديل اسم الفاتورة"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-zinc-600" />
                          </Button>

                          {/* Duplicate Button */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleDuplicateInvoice(item, e)}
                            className="h-7 text-xs border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer px-2 gap-1"
                            title="تكرار / نسخ الفاتورة"
                          >
                            <Copy className="w-3.5 h-3.5 text-indigo-600" />
                          </Button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSavedInvoice(item.id, e)}
                            className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                            title="حذف هذه الفاتورة نهائياً"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <DialogFooter className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between">
            <div className="text-[11px] text-zinc-500 font-medium">
              💡 يمكنك تصنيف أي فاتورة إلى مجلد عبر زر "نقل"، وسيتم حفظ الفاتورة الحالية في المجلد المحدد تلقائياً.
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSavedInvoicesOpen(false)}
              className="text-xs cursor-pointer"
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CREATE NEW FOLDER DIALOG ────────────────────────────────────────── */}
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent className="max-w-sm font-arabic" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-emerald-600" />
              <span>إنشاء مجلد جديد لتنظيم الفواتير</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
              اسم المجلد:
            </Label>
            <Input
              type="text"
              placeholder="مثال: فواتير المقاولات، توريدات شهر 10..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder()
              }}
              autoFocus
              className="text-xs"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNewFolderDialogOpen(false)}
              className="text-xs cursor-pointer"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleCreateFolder}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            >
              إنشاء المجلد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── RENAME FOLDER DIALOG ────────────────────────────────────────────── */}
      <Dialog open={!!editingFolder} onOpenChange={(open) => !open && setEditingFolder(null)}>
        <DialogContent className="max-w-sm font-arabic" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-zinc-600" />
              <span>تعديل اسم المجلد</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
              الاسم الجديد:
            </Label>
            <Input
              type="text"
              value={editingFolderName}
              onChange={(e) => setEditingFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameFolder()
              }}
              autoFocus
              className="text-xs"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingFolder(null)}
              className="text-xs cursor-pointer"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleRenameFolder}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            >
              حفظ التعديل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MOVE INVOICE TO FOLDER DIALOG ──────────────────────────────────── */}
      <Dialog open={!!movingInvoice} onOpenChange={(open) => !open && setMovingInvoice(null)}>
        <DialogContent className="max-w-sm font-arabic" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <FolderInput className="w-4 h-4 text-amber-600" />
              <span>نقل الفاتورة إلى مجلد</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-800 dark:text-zinc-200">
              📄 الفاتورة: {movingInvoice?.title}
            </div>

            <Label className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
              اختر المجلد المطلوب النقل إليه:
            </Label>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {/* Option Root */}
              <button
                type="button"
                onClick={() => setTargetFolderId('root')}
                className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer text-right ${
                  targetFolderId === 'root'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                    : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-zinc-500" />
                  <span>الرئيسية (بدون مجلد)</span>
                </div>
                {targetFolderId === 'root' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
              </button>

              {/* Created Folders */}
              {folders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTargetFolderId(f.id)}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer text-right ${
                    targetFolderId === f.id
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                      : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Folder className="w-3.5 h-3.5 text-amber-500" />
                    <span className="truncate">{f.name}</span>
                  </div>
                  {targetFolderId === f.id && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMovingInvoice(null)}
              className="text-xs cursor-pointer"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (movingInvoice) {
                  handleMoveInvoice(movingInvoice.id, targetFolderId)
                }
              }}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            >
              تأكيد النقل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── RENAME INVOICE TITLE DIALOG ────────────────────────────────────── */}
      <Dialog open={!!renamingInvoice} onOpenChange={(open) => !open && setRenamingInvoice(null)}>
        <DialogContent className="max-w-sm font-arabic" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-zinc-600" />
              <span>تعديل اسم الفاتورة</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
              عنوان الفاتورة في الأرشيف:
            </Label>
            <Input
              type="text"
              value={renamingInvoiceTitle}
              onChange={(e) => setRenamingInvoiceTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameInvoice()
              }}
              autoFocus
              className="text-xs"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRenamingInvoice(null)}
              className="text-xs cursor-pointer"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleRenameInvoice}
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            >
              حفظ الاسم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── PRINT PORTAL (Mounted to document.body for clean print view) ─────── */}
      {createPortal(
        <div id="printable-excel-invoice" className="hidden print:block font-arabic w-full max-w-full" dir="rtl">
          <style>{`
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            @media print {
              html, body {
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
              }
              body > #root {
                display: none !important;
              }
              #printable-excel-invoice {
                display: block !important;
                visibility: visible !important;
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 auto !important;
                padding: 0 !important;
                box-sizing: border-box !important;
              }
              #printable-excel-invoice * {
                visibility: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          `}</style>
          {renderInvoiceSheet(true)}
        </div>,
        document.body
      )}
    </div>
  )
}
