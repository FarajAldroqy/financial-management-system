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
import { ArrowDownCircle, ArrowUpCircle, Loader2, User, Users, Plus, Trash2 } from 'lucide-react'
import type { TransactionCreate, PaymentMethod, TransactionSubtype } from '@/types'
import { cleanAndNormalizeAmount } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { useWallet } from '@/context/WalletContext'

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
  const [personNames, setPersonNames] = useState<string[]>([''])
  const [amountStr, setAmountStr] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('نقداً')
  const [notes, setNotes] = useState('')
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
    setAmountStr('')
    setPaymentMethod('نقداً')
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
    setError('')

    if (!canEditData) {
      setError('عذراً، لا تملك صلاحية إضافة وتعديل البيانات')
      return
    }

    const amount = parseFloat(amountStr.replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) {
      return setError('يرجى إدخال مبلغ صحيح أكبر من الصفر')
    }

    let payload: TransactionCreate

    if (tab === 'REGULAR') {
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
      }
    } else if (isDeposit) {
      // Deposit from Person
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
      }
    } else {
      // Withdrawal for Persons
      const validPersons = personNames.map((p) => p.trim()).filter(Boolean)
      if (validPersons.length === 0) {
        return setError('يرجى إدخال اسم شخص واحد على الأقل وتسليمه المبلغ')
      }
      const targetEntity = clientName.trim() || 'الخزينة الكلية'
      payload = {
        client_name: targetEntity,
        type: 'WITHDRAWAL',
        subtype: 'PERSON',
        person_name: validPersons.join(' ، '),
        person_names: validPersons,
        amount_cents: Math.round(amount * 100),
        payment_method: paymentMethod,
        notes: notes.trim(),
        status: 'COMPLETED',
        wallet_type: activeWallet || 'LYD',
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
      <DialogContent className="sm:max-w-lg bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl rounded-2xl p-6 overflow-hidden" dir="rtl">
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
              <DialogTitle className="text-base font-bold font-arabic text-zinc-900 dark:text-zinc-100">
                {isDeposit ? 'تسجيل إيداع جديد' : 'تسجيل سحب جديد'}
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
            className={`py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
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
            className={`py-2 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
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
                <Users className="w-3.5 h-3.5" />
                <span>سحب للأشخاص</span>
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

          {/* TAB 2: PERSON WITHDRAWAL */}
          {tab === 'PERSON' && !isDeposit && (
            <>
              {/* Dynamic Multiple Person Names Input List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block text-right">
                    أسماء الأشخاص المراد تسليم المبلغ لهم <span className="text-rose-500">*</span>
                  </Label>
                  <button
                    type="button"
                    onClick={handleAddPersonField}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة شخص آخر</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto pl-1">
                  {personNames.map((pName, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        type="text"
                        placeholder={`اسم الشخص (${idx + 1})...`}
                        value={pName}
                        onChange={(e) => handlePersonNameChange(idx, e.target.value)}
                        className="bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100 rounded-lg font-arabic text-right flex-1"
                        autoComplete="off"
                      />
                      {personNames.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemovePersonField(idx)}
                          className="h-9 w-9 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg shrink-0"
                          title="حذف هذا الشخص"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Source Entity (Vault / Branch Selection) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="modal-source-entity" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block text-right">
                    الجهة المراد السحب منها المال <span className="text-rose-500">*</span>
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
            </>
          )}

          {/* COMMON FIELD 1: Amount */}
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

          {/* COMMON FIELD 2: Payment Method */}
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
                <SelectItem value="تحويل مصرفي" className="text-xs text-zinc-800 dark:text-zinc-200 font-arabic">تحويل مصرفي (Bank Transfer)</SelectItem>
                <SelectItem value="بطاقة" className="text-xs text-zinc-800 dark:text-zinc-200 font-arabic">بطاقة (Card)</SelectItem>
              </SelectContent>
            </Select>
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
                : isDeposit ? 'تأكيد الإيداع من شخص' : 'تأكيد السحب للأشخاص'
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
