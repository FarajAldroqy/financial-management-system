import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowDownCircle, ArrowUpCircle, Loader2, User, FileText, Plus, Trash2, Clock, Calendar, RotateCcw } from 'lucide-react'
import type { TransactionCreate, PaymentMethod, TransactionSubtype } from '@/types'
import { cleanAndNormalizeAmount, getLocalDeviceISOString, parseDateSafe } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { useWallet } from '@/context/WalletContext'

const formatForDateTimeLocal = (date: Date = new Date()) => {
  const pad = (num: number) => String(num).padStart(2, '0')
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

interface TransactionModalProps {
  open: boolean
  mode: 'DEPOSIT' | 'WITHDRAWAL'
  onClose: () => void
  onSubmit: (data: TransactionCreate) => Promise<void>
  entities?: string[]
}

export function TransactionModal({ open, mode, onClose, onSubmit, entities = [] }: TransactionModalProps) {
  const { hasPermission } = usePermission()
  const canEditData = hasPermission('edit_data')
  const { activeWallet, activeWalletMeta } = useWallet()

  const isDeposit = mode === 'DEPOSIT'

  const [tab, setTab] = useState<TransactionSubtype>('REGULAR')
  const [clientName, setClientName] = useState('')
  const [personName, setPersonName] = useState('')
  const [invoiceTitle, setInvoiceTitle] = useState('')
  const [invoiceItems, setInvoiceItems] = useState<Array<{ name: string; amount: string }>>([
    { name: '', amount: '' },
  ])
  const [personNames, setPersonNames] = useState<string[]>([''])
  const [amountStr, setAmountStr] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('نقداً')
  const [notes, setNotes] = useState('')
  const [dateTimeLocal, setDateTimeLocal] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [customEntityMode, setCustomEntityMode] = useState(false)

  // When mode changes or modal opens, reset form and default person withdrawal to "الخزينة الكلية"
  useEffect(() => {
    if (open) {
      reset()
    }
  }, [open, mode])

  const reset = () => {
    setTab('REGULAR')
    setClientName(entities[0] || 'الخزينة الكلية')
    setPersonName('')
    setPersonNames([''])
    setInvoiceTitle('')
    setInvoiceItems([{ name: '', amount: '' }])
    setAmountStr('')
    setPaymentMethod('نقداً')
    setDateTimeLocal(formatForDateTimeLocal(new Date()))
    setNotes('')
    setError('')
    setLoading(false)
    setCustomEntityMode(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleTabSwitch = (newTab: TransactionSubtype) => {
    setTab(newTab)
    setError('')
    if (newTab === 'PERSON' && !isDeposit && !clientName) {
      setClientName('الخزينة الكلية')
    }
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value
    const validVal = cleanAndNormalizeAmount(rawVal, amountStr)
    setAmountStr(validVal)
  }

  const handleAddInvoiceItem = () => {
    setInvoiceItems((prev) => [...prev, { name: '', amount: '' }])
  }

  const handleRemoveInvoiceItem = (index: number) => {
    setInvoiceItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleInvoiceItemChange = (index: number, field: 'name' | 'amount', val: string) => {
    setInvoiceItems((prev) => {
      const next = [...prev]
      if (field === 'amount') {
        const valid = cleanAndNormalizeAmount(val, next[index].amount)
        next[index] = { ...next[index], amount: valid }
      } else {
        next[index] = { ...next[index], name: val }
      }
      return next
    })
  }

  const invoiceTotal = invoiceItems.reduce((sum, item) => {
    const val = parseFloat(item.amount.replace(/,/g, ''))
    return sum + (isNaN(val) ? 0 : val)
  }, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!canEditData) {
      setError('عذراً، لا تملك صلاحية إضافة وتعديل البيانات')
      return
    }

    let payload: TransactionCreate

    let finalCreatedAt = getLocalDeviceISOString()
    if (dateTimeLocal) {
      const parsed = parseDateSafe(dateTimeLocal)
      const year = parsed.getFullYear()
      if (isNaN(parsed.getTime()) || year < 2000 || year > 2100) {
        return setError('يرجى التأكد من صحة التاريخ المدخل (السنة يجب أن تكون بين 2000 و 2100)')
      }
      finalCreatedAt = getLocalDeviceISOString(parsed)
    }

    if (tab === 'REGULAR') {
      const amount = parseFloat(amountStr.replace(/,/g, ''))
      if (isNaN(amount) || amount <= 0) {
        return setError('يرجى إدخال مبلغ صحيح أكبر من الصفر')
      }
      if (!clientName.trim()) {
        return setError('يرجى اختيار أو إدخال اسم الجهة / العميل')
      }
      payload = {
        client_name: clientName.trim(),
        type: mode,
        subtype: 'REGULAR',
        amount_cents: Math.round(amount * 100),
        payment_method: paymentMethod,
        notes: notes.trim(),
        status: 'COMPLETED',
        wallet_type: activeWallet || 'LYD',
        created_at: finalCreatedAt,
      }
    } else if (isDeposit) {
      // Deposit from Person
      const amount = parseFloat(amountStr.replace(/,/g, ''))
      if (isNaN(amount) || amount <= 0) {
        return setError('يرجى إدخال مبلغ صحيح أكبر من الصفر')
      }
      if (!personName.trim()) {
        return setError('يرجى إدخال اسم الشخص المودِع')
      }
      if (!clientName.trim()) {
        return setError('يرجى اختيار إحدى جهات المنظومة المراد الإيداع لها')
      }
      payload = {
        client_name: clientName.trim(),
        type: 'DEPOSIT',
        subtype: 'PERSON',
        person_name: personName.trim(),
        amount_cents: Math.round(amount * 100),
        payment_method: paymentMethod,
        notes: notes.trim(),
        status: 'COMPLETED',
        wallet_type: activeWallet || 'LYD',
        created_at: finalCreatedAt,
      }
    } else {
      // Detailed Withdrawal ("سحب تفصيلي")
      if (!invoiceTitle.trim()) {
        return setError('يرجى إدخال عنوان الفاتورة')
      }
      const targetEntity = clientName.trim() || 'الخزينة الكلية'

      if (invoiceItems.length === 0) {
        return setError('يرجى إضافة عنصر واحد على الأقل للفاتورة')
      }

      for (let i = 0; i < invoiceItems.length; i++) {
        const item = invoiceItems[i]
        const val = parseFloat(item.amount.replace(/,/g, ''))
        if (!item.name.trim()) {
          return setError(`يرجى إدخال اسم العنصر في السطر رقم ${i + 1}`)
        }
        if (isNaN(val) || val <= 0) {
          return setError(`يرجى إدخال قيمة صحيحة أكبر من الصفر للعنصر "${item.name.trim() || `#${i + 1}`}"`)
        }
      }

      if (invoiceTotal <= 0) {
        return setError('يرجى التأكد من أن إجمالي قيمة الفاتورة أكبر من الصفر')
      }

      const parsedItems = invoiceItems.map((item) => ({
        name: item.name.trim(),
        amount: parseFloat(item.amount.replace(/,/g, '')),
      }))

      payload = {
        client_name: targetEntity,
        type: 'WITHDRAWAL',
        subtype: 'PERSON',
        person_name: invoiceTitle.trim(),
        person_names: parsedItems.map((it) => `${it.name}: ${it.amount}`),
        items: parsedItems,
        amount_cents: Math.round(invoiceTotal * 100),
        payment_method: paymentMethod,
        notes: notes.trim(),
        status: 'COMPLETED',
        wallet_type: activeWallet || 'LYD',
        created_at: finalCreatedAt,
      }
    }

    setLoading(true)
    try {
      await onSubmit(payload)
      reset()
      onClose()
    } catch {
      setError('حدث خطأ أثناء حفظ المعاملة، يرجى المحاولة مرة أخرى')
    } finally {
      setLoading(false)
    }
  }

  const hasSavedEntities = entities.length > 0
  // Build entities list: الخزينة الكلية first, then the rest sorted alphabetically
  const entitiesList = Array.from(new Set([...entities, 'الخزينة الكلية'])).sort((a, b) => {
    if (a === 'الخزينة الكلية') return -1
    if (b === 'الخزينة الكلية') return 1
    return a.localeCompare(b, 'ar')
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl rounded-2xl p-6" dir="rtl">
        <DialogHeader className="text-right pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-xl ${
                isDeposit
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
              }`}
            >
              {isDeposit ? <ArrowDownCircle className="w-5 h-5" /> : <ArrowUpCircle className="w-5 h-5" />}
            </div>
            <div>
              <DialogTitle className="text-base font-bold font-arabic text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                <span>{isDeposit ? 'تسجيل إيداع جديد' : 'تسجيل سحب جديد'}</span>
                <span className="flex items-center gap-1 text-[11px] font-normal text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                  <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>توقيت الجهاز</span>
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 font-arabic">
                {isDeposit
                  ? 'اختر نوع الإيداع وأدخل البيانات أدناه'
                  : 'اختر نوع السحب وأدخل البيانات أدناه'
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Selection Header */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl my-3 font-arabic text-xs">
          <button
            type="button"
            onClick={() => handleTabSwitch('REGULAR')}
            className={`py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              tab === 'REGULAR'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            {isDeposit ? 'إيداع عادي' : 'سحب عادي'}
          </button>

          <button
            type="button"
            onClick={() => handleTabSwitch('PERSON')}
            className={`py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              tab === 'PERSON'
                ? isDeposit
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-rose-600 text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            {isDeposit ? (
              <>
                <User className="w-3.5 h-3.5" />
                <span>إيداع من شخص</span>
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5" />
                <span>سحب تفصيلي</span>
              </>
            )}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 font-arabic">
          {/* TAB 1: REGULAR DEPOSIT / WITHDRAWAL */}
          {tab === 'REGULAR' && (
            <>
              {/* Entity Dropdown / Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="modal-client" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block text-right">
                    اسم الجهة / العميل
                  </Label>
                  {hasSavedEntities && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomEntityMode((prev) => !prev)
                        setClientName('')
                      }}
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      {customEntityMode ? 'اختيار من قائمة الجهات' : '+ جهة جديدة غير قائمة'}
                    </button>
                  )}
                </div>

                {!customEntityMode && hasSavedEntities ? (
                  <select
                    id="modal-client"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full h-9 px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-arabic text-right cursor-pointer"
                  >
                    <option value="" disabled>-- اختر الجهة --</option>
                    {entitiesList.map((ent) => (
                      <option key={ent} value={ent} className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                        {ent}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="modal-client"
                    placeholder="مثال: شركة المدار الجديد"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 rounded-lg focus-visible:ring-zinc-400 font-arabic text-right"
                    autoComplete="off"
                  />
                )}
              </div>
            </>
          )}

          {/* TAB 2: PERSON DEPOSIT */}
          {tab === 'PERSON' && isDeposit && (
            <>
              {/* Person Name Input */}
              <div className="space-y-1.5">
                <Label htmlFor="modal-person-name" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block text-right">
                  اسم الشخص (المودِع) <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="modal-person-name"
                  type="text"
                  placeholder="أدخل اسم الشخص المودِع..."
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 rounded-lg font-arabic text-right"
                  autoComplete="off"
                />
              </div>

              {/* Target Entity in System */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="modal-target-entity" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block text-right">
                    الجهة المراد الإيداع لها في المنظومة <span className="text-rose-500">*</span>
                  </Label>
                  {hasSavedEntities && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomEntityMode((prev) => !prev)
                        setClientName('')
                      }}
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      {customEntityMode ? 'اختيار من قائمة الجهات' : '+ جهة جديدة'}
                    </button>
                  )}
                </div>

                {!customEntityMode && hasSavedEntities ? (
                  <select
                    id="modal-target-entity"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full h-9 px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-arabic text-right cursor-pointer"
                  >
                    <option value="" disabled>-- اختر جهة الإيداع --</option>
                    {entitiesList.map((ent) => (
                      <option key={ent} value={ent} className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                        {ent}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="modal-target-entity"
                    placeholder="مثال: الخزينة الكلية / فرع النماء"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 rounded-lg focus-visible:ring-zinc-400 font-arabic text-right"
                    autoComplete="off"
                  />
                )}
              </div>
            </>
          )}

          {/* TAB 2: DETAILED WITHDRAWAL */}
          {tab === 'PERSON' && !isDeposit && (
            <>
              {/* Field 1: Invoice Title */}
              <div className="space-y-1.5">
                <Label htmlFor="modal-invoice-title" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block text-right">
                  عنوان الفاتورة <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="modal-invoice-title"
                  type="text"
                  placeholder="أدخل عنوان الفاتورة (مثال: صيانة مكاتب، مشتريات وقود...)"
                  value={invoiceTitle}
                  onChange={(e) => setInvoiceTitle(e.target.value)}
                  className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 rounded-lg font-arabic text-right"
                  autoComplete="off"
                />
              </div>

              {/* Field 2: Source Entity */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="modal-source-entity" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block text-right">
                    اسم الجهة المراد السحب منها <span className="text-rose-500">*</span>
                  </Label>
                  {hasSavedEntities && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomEntityMode((prev) => !prev)
                        setClientName('')
                      }}
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      {customEntityMode ? 'اختيار من قائمة الجهات' : '+ جهة جديدة'}
                    </button>
                  )}
                </div>

                {!customEntityMode ? (
                  <select
                    id="modal-source-entity"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full h-9 px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/40 font-arabic text-right cursor-pointer"
                  >
                    <option value="الخزينة الكلية">🏦 الخزينة الكلية (Vault Main)</option>
                    {entitiesList.filter((e) => e !== 'الخزينة الكلية').map((ent) => (
                      <option key={ent} value={ent} className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                        {ent}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="modal-source-entity"
                    placeholder="مثال: الخزينة الكلية أو اسم الفرع"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 rounded-lg focus-visible:ring-zinc-400 font-arabic text-right"
                    autoComplete="off"
                  />
                )}
              </div>

              {/* Field 3: Invoice Items with Add / Remove */}
              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block text-right">
                    عناصر الفاتورة <span className="text-rose-500">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={handleAddInvoiceItem}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة عنصر آخر</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pl-1 pr-0.5">
                  {invoiceItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-xl border border-zinc-200/70 dark:border-zinc-700/60">
                      <span className="text-[11px] font-bold text-zinc-400 w-5 text-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <Input
                          type="text"
                          placeholder="اسم العنصر"
                          value={item.name}
                          onChange={(e) => handleInvoiceItemChange(idx, 'name', e.target.value)}
                          className="h-8 bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 rounded-lg font-arabic text-right"
                          autoComplete="off"
                        />
                      </div>
                      <div className="w-28 sm:w-32 relative shrink-0">
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="قيمة العنصر"
                          value={item.amount}
                          onChange={(e) => handleInvoiceItemChange(idx, 'amount', e.target.value)}
                          className="h-8 bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 rounded-lg pl-8 font-sans text-left ar-num"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-semibold pointer-events-none">
                          {activeWalletMeta?.symbol || 'د.ل'}
                        </span>
                      </div>
                      {invoiceItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveInvoiceItem(idx)}
                          className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg shrink-0 cursor-pointer"
                          title="حذف هذا العنصر"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Real-time Total Calculation Summary Card */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/50">
                  <span className="text-xs font-bold text-rose-900 dark:text-rose-200">
                    إجمالي قيمة الفاتورة:
                  </span>
                  <span className="text-sm font-extrabold text-rose-700 dark:text-rose-300 ar-num font-sans">
                    {invoiceTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {activeWalletMeta?.symbol || 'د.ل'}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* COMMON FIELD 1: Amount (only for REGULAR or DEPOSIT) */}
          {(tab === 'REGULAR' || isDeposit) && (
            <div className="space-y-1.5">
              <Label htmlFor="modal-amount" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block text-right">
                القيمة ({activeWalletMeta?.labelAr || 'بالدينار'} {activeWalletMeta?.symbol || 'د.ل'}) <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="modal-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amountStr}
                  onChange={handleAmountChange}
                  className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 rounded-lg pl-14 font-sans text-left ar-num"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-semibold font-arabic pointer-events-none">
                  {activeWalletMeta?.symbol || 'د.ل'}
                </span>
              </div>
            </div>
          )}

          {/* COMMON FIELDS: Payment Method & Transaction Date/Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* اسلوب الدفع */}
            <div className="space-y-1.5">
              <Label htmlFor="modal-payment-method" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block text-right">
                اسلوب الدفع
              </Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              >
                <SelectTrigger id="modal-payment-method" className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 rounded-lg font-arabic" dir="rtl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700" dir="rtl">
                  <SelectItem value="نقداً" className="text-xs text-zinc-800 dark:text-zinc-200 font-arabic">نقداً (Cash)</SelectItem>
                  <SelectItem value="بنك" className="text-xs text-zinc-800 dark:text-zinc-200 font-arabic">بنك (Bank)</SelectItem>
                  <SelectItem value="بطاقة" className="text-xs text-zinc-800 dark:text-zinc-200 font-arabic">بطاقة (Card)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* تاريخ ووقت المعاملة */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="modal-datetime" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>تاريخ ووقت المعاملة</span>
                </Label>
                <button
                  type="button"
                  onClick={() => setDateTimeLocal(formatForDateTimeLocal(new Date()))}
                  className="text-[10px] text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-0.5 cursor-pointer font-arabic"
                  title="الرجوع للتوقيت الحالي للجهاز"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>الآن</span>
                </button>
              </div>
              <Input
                id="modal-datetime"
                type="datetime-local"
                value={dateTimeLocal}
                onChange={(e) => setDateTimeLocal(e.target.value)}
                dir="ltr"
                className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 rounded-lg font-mono focus-visible:ring-zinc-400 text-left"
              />
            </div>
          </div>

          {/* COMMON FIELD 3: Reason / Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="modal-notes" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block text-right">
              سبب {isDeposit ? 'الإيداع' : 'السحب'} (ملاحظات - اختياري)
            </Label>
            <Input
              id="modal-notes"
              type="text"
              placeholder="أدخل سبب المعاملة أو أي ملاحظة إضافية..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 rounded-lg font-arabic text-right"
              autoComplete="off"
            />
          </div>

          {/* Error Message Display */}
          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400 font-bold font-arabic text-right bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg border border-rose-200 dark:border-rose-900">
              {error}
            </p>
          )}

          <DialogFooter className="flex-row-reverse gap-2 mt-6">
            <Button
              id="modal-submit-btn"
              type="submit"
              disabled={loading}
              className={`flex-1 text-xs font-arabic font-bold text-white rounded-lg transition-all ${
                isDeposit
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-rose-600 hover:bg-rose-500'
              }`}
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin ml-1.5" />}
              {tab === 'REGULAR'
                ? isDeposit ? 'تأكيد الإيداع العادي' : 'تأكيد السحب العادي'
                : isDeposit ? 'تأكيد الإيداع من شخص' : 'تأكيد السحب التفصيلي'
              }
            </Button>

            <Button
              id="modal-cancel-btn"
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1 text-xs bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 font-arabic rounded-lg"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
