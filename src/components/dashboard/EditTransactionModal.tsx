import { useState, useEffect, useRef } from 'react'
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
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  Clock,
  Edit3,
  Loader2,
  Plus,
  Trash2,
  User,
  Users,
  Wallet,
  FileText,
} from 'lucide-react'
import type { Transaction, TransactionUpdate, PaymentMethod, TransactionSubtype } from '@/types'
import { cleanAndNormalizeAmount, normalizeArabicNumerals } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { useWallet } from '@/context/WalletContext'
import { logUserAction } from '@/lib/auditLogger'
import { playClickSound } from '@/lib/soundEffects'

interface EditTransactionModalProps {
  open: boolean
  transaction: Transaction | null
  onClose: () => void
  onSuccess: (updatedTx: Transaction) => void
  entities?: string[]
}

const formatForDateTimeLocal = (dateStr: string) => {
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    const pad = (num: number) => String(num).padStart(2, '0')
    const year = d.getFullYear()
    const month = pad(d.getMonth() + 1)
    const day = pad(d.getDate())
    const hours = pad(d.getHours())
    const minutes = pad(d.getMinutes())
    return `${year}-${month}-${day}T${hours}:${minutes}`
  } catch {
    return ''
  }
}

export function EditTransactionModal({
  open,
  transaction,
  onClose,
  onSuccess,
  entities = [],
}: EditTransactionModalProps) {
  const { hasPermission } = usePermission()
  const canEditData = hasPermission('edit_data')
  const { activeWalletMeta } = useWallet()

  const [type, setType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT')
  const [subtype, setSubtype] = useState<TransactionSubtype>('REGULAR')
  const [clientName, setClientName] = useState('')
  const [personName, setPersonName] = useState('')
  const [personNames, setPersonNames] = useState<string[]>([''])
  const [amountStr, setAmountStr] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | string>('نقداً')
  const [dateTimeLocal, setDateTimeLocal] = useState('')
  const [notes, setNotes] = useState('')
  const [walletType, setWalletType] = useState<'LYD' | 'USD'>('LYD')
  const [customEntityMode, setCustomEntityMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const initialDateTimeRef = useRef('')

  // Pre-fill state when modal opens with transaction
  useEffect(() => {
    if (open && transaction) {
      setType(transaction.type)
      setSubtype(transaction.subtype || 'REGULAR')
      setClientName(transaction.client_name || '')
      setPersonName(transaction.person_name || '')
      if (Array.isArray(transaction.person_names) && transaction.person_names.length > 0) {
        setPersonNames(transaction.person_names)
      } else if (transaction.person_name) {
        setPersonNames([transaction.person_name])
      } else {
        setPersonNames([''])
      }
      setAmountStr(((transaction.amount_cents || 0) / 100).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }))
      setPaymentMethod(transaction.payment_method === 'تحويل مصرفي' ? 'بنك' : (transaction.payment_method || 'نقداً'))
      const formattedDate = formatForDateTimeLocal(transaction.created_at)
      setDateTimeLocal(formattedDate)
      initialDateTimeRef.current = formattedDate
      setNotes(transaction.notes || '')
      setWalletType(transaction.wallet_type || 'LYD')
      setError('')
      setLoading(false)
      setCustomEntityMode(false)
    }
  }, [open, transaction])

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value
    const validVal = cleanAndNormalizeAmount(rawVal, amountStr)
    setAmountStr(validVal)
  }

  const handleAddPersonField = () => {
    setPersonNames((prev) => [...prev, ''])
  }

  const handleRemovePersonField = (index: number) => {
    setPersonNames((prev) => prev.filter((_, i) => i !== index))
  }

  const handlePersonNameChange = (index: number, val: string) => {
    setPersonNames((prev) => {
      const next = [...prev]
      next[index] = val
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transaction) return
    setError('')

    if (!canEditData) {
      setError('عذراً، لا تملك صلاحية تعديل بيانات المعاملات')
      return
    }

    const normalizedStr = normalizeArabicNumerals(amountStr).replace(/,/g, '').trim()
    const amount = parseFloat(normalizedStr)
    if (isNaN(amount) || amount <= 0 || !isFinite(amount)) {
      setError('يرجى إدخال مبلغ مالي صحيح أكبر من الصفر')
      return
    }
    const amountCents = Math.round(Number(amount.toFixed(2)) * 100)

    const finalClient = clientName.trim()
    if (!finalClient) {
      setError('يرجى اختيار أو كتابة اسم الجهة')
      return
    }

    let finalCreatedAt = transaction.created_at
    if (dateTimeLocal && dateTimeLocal !== initialDateTimeRef.current) {
      const parsed = new Date(dateTimeLocal)
      const year = parsed.getFullYear()
      if (isNaN(parsed.getTime()) || year < 2000 || year > 2100) {
        setError('يرجى التأكد من صحة التاريخ المدخل (السنة يجب أن تكون بين 2000 و 2100)')
        return
      }
      finalCreatedAt = parsed.toISOString()
    }

    // Sync newly typed entity name into custom entities registry so it is immediately visible in Treasury
    try {
      const key = `salla_${walletType}_treasury_custom_entities`
      const saved = localStorage.getItem(key)
      const list: string[] = saved ? JSON.parse(saved) : []
      if (!list.includes(finalClient)) {
        list.push(finalClient)
        localStorage.setItem(key, JSON.stringify(list))
        if (walletType === 'LYD') {
          localStorage.setItem('salla_treasury_custom_entities', JSON.stringify(list))
        }
      }
    } catch (storageErr) {
      console.error('Failed to sync entity name to storage:', storageErr)
    }

    const validPersons = personNames.map((p) => p.trim()).filter(Boolean)

    const payload: TransactionUpdate = {
      id: transaction.id,
      client_name: finalClient,
      type,
      subtype,
      amount_cents: amountCents,
      payment_method: paymentMethod,
      notes: notes.trim(),
      wallet_type: walletType,
      created_at: finalCreatedAt,
    }

    if (subtype === 'PERSON') {
      if (type === 'DEPOSIT') {
        if (!personName.trim()) {
          setError('يرجى إدخال اسم الشخص المودِع')
          return
        }
        payload.person_name = personName.trim()
        payload.person_names = [personName.trim()]
      } else {
        if (validPersons.length === 0) {
          setError('يرجى إدخال اسم شخص واحد على الأقل')
          return
        }
        payload.person_name = validPersons.join(' ، ')
        payload.person_names = validPersons
      }
    } else {
      payload.person_name = ''
      payload.person_names = []
    }

    setLoading(true)
    try {
      playClickSound()
      let updated: Transaction | undefined

      if (window.electronAPI?.updateTransaction) {
        const res = await window.electronAPI.updateTransaction(payload)
        if (!res.success) {
          throw new Error(res.error || 'فشل التعديل')
        }
        updated = res.data
      }

      const fallbackUpdated: Transaction = {
        ...transaction,
        ...payload,
        created_at: finalCreatedAt,
        person_name: payload.person_name || '',
        person_names: payload.person_names || [],
        notes: payload.notes || '',
      }

      logUserAction(
        'EDIT_TRANSACTION',
        'مالية',
        'تعديل معاملة مالية بالكامل',
        `معاملة #${transaction.id} - ${finalClient} - ${amount} ${walletType}`
      )

      onSuccess(updated || fallbackUpdated)
      onClose()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'حدث خطأ أثناء حفظ التعديلات، يرجى المحاولة مرة أخرى')
    } finally {
      setLoading(false)
    }
  }

  // Combined entities list
  const entitiesList = Array.from(new Set([...entities, clientName, 'الخزينة الكلية'])).filter(Boolean).sort((a, b) => {
    if (a === 'الخزينة الكلية') return -1
    if (b === 'الخزينة الكلية') return 1
    return a.localeCompare(b, 'ar')
  })

  const isDeposit = type === 'DEPOSIT'

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-xl max-h-[92vh] overflow-y-auto bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl rounded-2xl p-6"
        dir="rtl"
      >
        <DialogHeader className="text-right pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-sm">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold font-arabic text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>تعديل المعاملة المالية</span>
                {transaction && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                    #{transaction.id}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 font-arabic mt-0.5">
                يمكنك تعديل أي بيانات في المعاملة بما فيها التاريخ والمبلغ والجهة والتفاصيل
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 text-xs font-arabic rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* نوع المعاملة: إيداع أو سحب */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold font-arabic text-zinc-700 dark:text-zinc-300">
              نوع المعاملة المالية
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('DEPOSIT')}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-xs font-bold font-arabic transition-all ${
                  isDeposit
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/30'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-750'
                }`}
              >
                <ArrowDownCircle className="w-4 h-4" />
                <span>إيداع (وارد)</span>
              </button>

              <button
                type="button"
                onClick={() => setType('WITHDRAWAL')}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-xs font-bold font-arabic transition-all ${
                  !isDeposit
                    ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-500/30'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-750'
                }`}
              >
                <ArrowUpCircle className="w-4 h-4" />
                <span>سحب (صادر)</span>
              </button>
            </div>
          </div>

          {/* تبويب التصنيف: عادي / عهدة أشخاص */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold font-arabic text-zinc-700 dark:text-zinc-300">
              تصنيف المعاملة
            </Label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setSubtype('REGULAR')}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold font-arabic transition-all ${
                  subtype === 'REGULAR'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                معاملة عادية / جهة
              </button>
              <button
                type="button"
                onClick={() => setSubtype('PERSON')}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold font-arabic flex items-center justify-center gap-1.5 transition-all ${
                  subtype === 'PERSON'
                    ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
                }`}
              >
                {type === 'WITHDRAWAL' ? <FileText className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                <span>{type === 'WITHDRAWAL' ? 'سحب تفصيلي' : 'إيداع من شخص'}</span>
              </button>
            </div>
          </div>

          {/* الجهة المستهدفة */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold font-arabic text-zinc-700 dark:text-zinc-300">
                الجهة / الحساب
              </Label>
              <button
                type="button"
                onClick={() => setCustomEntityMode(!customEntityMode)}
                className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline font-arabic cursor-pointer"
              >
                {customEntityMode ? 'اختيار من القائمة' : '+ كتابة جهة مخصصة'}
              </button>
            </div>

            {customEntityMode ? (
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="اكتب اسم الجهة..."
                className="font-arabic text-xs bg-zinc-50 dark:bg-zinc-800/60"
              />
            ) : (
              <Select value={clientName} onValueChange={(val) => setClientName(val)}>
                <SelectTrigger className="w-full font-arabic text-xs bg-zinc-50 dark:bg-zinc-800/60">
                  <SelectValue placeholder="اختر الجهة..." />
                </SelectTrigger>
                <SelectContent dir="rtl" className="max-h-56">
                  {entitiesList.map((ent) => (
                    <SelectItem key={ent} value={ent} className="font-arabic text-xs">
                      {ent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* تفاصيل الأشخاص في حالة عهدة */}
          {subtype === 'PERSON' && (
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-3">
              {isDeposit ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold font-arabic text-zinc-700 dark:text-zinc-300">
                    اسم الشخص المودِع
                  </Label>
                  <Input
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    placeholder="اسم الشخص المسلم للإيداع..."
                    className="font-arabic text-xs bg-white dark:bg-zinc-800"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold font-arabic text-zinc-700 dark:text-zinc-300">
                      أسماء الأشخاص المستلمين للعهدة
                    </Label>
                    <button
                      type="button"
                      onClick={handleAddPersonField}
                      className="text-[11px] font-arabic text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      إضافة شخص آخر
                    </button>
                  </div>
                  {personNames.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={p}
                        onChange={(e) => handlePersonNameChange(idx, e.target.value)}
                        placeholder={`اسم الشخص ${idx + 1}...`}
                        className="font-arabic text-xs bg-white dark:bg-zinc-800 flex-1"
                      />
                      {personNames.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePersonField(idx)}
                          className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer transition-colors"
                          title="حذف هذا الشخص"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* المبلغ والعملة */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold font-arabic text-zinc-700 dark:text-zinc-300">
                المبلغ ({walletType === 'USD' ? '$ دولار' : 'د.ل دينار'})
              </Label>
              <Input
                type="text"
                inputMode="decimal"
                value={amountStr}
                onChange={handleAmountChange}
                placeholder="0.00"
                dir="ltr"
                className="text-left font-mono font-bold text-sm bg-zinc-50 dark:bg-zinc-800/60"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold font-arabic text-zinc-700 dark:text-zinc-300">
                المحفظة
              </Label>
              <Select value={walletType} onValueChange={(val: 'LYD' | 'USD') => setWalletType(val)}>
                <SelectTrigger className="w-full font-arabic text-xs bg-zinc-50 dark:bg-zinc-800/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="LYD" className="font-arabic text-xs">
                    دينار ليبي (LYD)
                  </SelectItem>
                  <SelectItem value="USD" className="font-arabic text-xs">
                    دولار أمريكي (USD)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* طريقة الدفع وتاريخ المعاملة */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold font-arabic text-zinc-700 dark:text-zinc-300">
                طريقة الدفع
              </Label>
              <Select value={paymentMethod} onValueChange={(val) => setPaymentMethod(val)}>
                <SelectTrigger className="w-full font-arabic text-xs bg-zinc-50 dark:bg-zinc-800/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="نقداً" className="font-arabic text-xs">
                    نقداً (كاش)
                  </SelectItem>
                  <SelectItem value="بنك" className="font-arabic text-xs">
                    بنك
                  </SelectItem>
                  <SelectItem value="صك" className="font-arabic text-xs">
                    صك مصدق / شيك
                  </SelectItem>
                  <SelectItem value="بطاقة" className="font-arabic text-xs">
                    بطاقة إلكترونية
                  </SelectItem>
                  <SelectItem value="أخرى" className="font-arabic text-xs">
                    أخرى
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* تاريخ وتوقيت المعاملة - Editable DateTime */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold font-arabic text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>تاريخ ووقت المعاملة</span>
              </Label>
              <Input
                type="datetime-local"
                value={dateTimeLocal}
                onChange={(e) => setDateTimeLocal(e.target.value)}
                dir="ltr"
                className="font-mono text-xs bg-zinc-50 dark:bg-zinc-800/60"
              />
            </div>
          </div>

          {/* الملاحظات */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold font-arabic text-zinc-700 dark:text-zinc-300">
              الملاحظات والتفاصيل
            </Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اكتب أي تفاصيل أو ملاحظات عن المعاملة..."
              rows={2}
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 p-2.5 text-xs font-arabic text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="font-arabic text-xs"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="font-arabic text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  جاري الحفظ...
                </span>
              ) : (
                'حفظ التعديلات'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
