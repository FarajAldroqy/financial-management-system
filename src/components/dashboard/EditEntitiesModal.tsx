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
import { Edit3, AlertCircle, Check, Building2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { logUserAction } from '@/lib/auditLogger'
import { useWallet } from '@/context/WalletContext'

interface EntityOption {
  name: string
  depositedCents: number
  withdrawnCents: number
  netCents: number
  transactionCount: number
  isSystemFixed?: boolean
}

interface EditEntitiesModalProps {
  open: boolean
  onClose: () => void
  entities: EntityOption[]
  onSuccess: (oldName: string, newName: string) => void
}

export function EditEntitiesModal({
  open,
  onClose,
  entities,
  onSuccess,
}: EditEntitiesModalProps) {
  const { activeWallet, activeWalletMeta } = useWallet()
  const [selectedEntityName, setSelectedEntityName] = useState<string>('')
  const [newName, setNewName] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // All entities are editable
  const selectableEntities = entities

  useEffect(() => {
    if (open) {
      setError(null)
      setIsSubmitting(false)
      const firstEditable = selectableEntities[0]?.name ?? ''
      setSelectedEntityName(firstEditable)
      setNewName(firstEditable)
    }
  }, [open, entities])

  const handleSelectChange = (name: string) => {
    setSelectedEntityName(name)
    setNewName(name)
    setError(null)
  }

  const selectedEntity = entities.find((e) => e.name === selectedEntityName)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedNew = newName.trim()
    const trimmedOld = selectedEntityName.trim()

    if (!trimmedOld) {
      setError('يرجى اختيار جهة للتعديل')
      return
    }

    if (!trimmedNew) {
      setError('يرجى إدخال الاسم الجديد للجهة')
      return
    }

    if (trimmedNew === trimmedOld) {
      setError('الاسم الجديد متطابق مع الاسم الحالي')
      return
    }

    // Check if newName already exists for a different entity
    const alreadyExists = entities.some(
      (e) => e.name.trim().toLowerCase() === trimmedNew.toLowerCase() && e.name.trim() !== trimmedOld
    )
    if (alreadyExists) {
      setError('يوجد جهة مسجلة سابقاً بنفس هذا الاسم')
      return
    }

    setIsSubmitting(true)
    try {
      if (window.electronAPI?.updateEntityName) {
        const res = await window.electronAPI.updateEntityName({
          oldName: trimmedOld,
          newName: trimmedNew,
          walletType: activeWallet || 'LYD',
        })
        if (!res.success) {
          setError(res.message || 'حدث خطأ أثناء تعديل بيانات الجهة')
          setIsSubmitting(false)
          return
        }
      }

      logUserAction('EDIT_ENTITY', 'الخزينة والجهات', 'تعديل اسم جهة بالخزينة', `من: ${trimmedOld} إلى: ${trimmedNew}`)
      onSuccess(trimmedOld, trimmedNew)
      onClose()
    } catch (err) {
      console.error('Failed to update entity name:', err)
      setError('فشل تعديل التسمية. يرجى المحاولة لاحقاً')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-lg bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl rounded-2xl p-6 font-arabic"
        dir="rtl"
      >
        <DialogHeader className="text-right">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold font-arabic text-zinc-900 dark:text-white">
                تعديل بيانات ورقم التسمية للجهة
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 font-arabic mt-1">
                قم باختيار الجهة المراد تعديل تسميتها لتحديث سجل معاملاتها المالية بالكامل بالخزينة
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Select Entity to Edit */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
              اختر الجهة المراد تعديل اسمها:
            </label>
            {selectableEntities.length === 0 ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 p-2 border rounded-lg bg-zinc-50 dark:bg-zinc-800">
                لا توجد جهات قابلة للتعديل
              </p>
            ) : (
              <select
                value={selectedEntityName}
                onChange={(e) => handleSelectChange(e.target.value)}
                className="w-full h-10 px-3 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-arabic"
              >
                {selectableEntities.map((ent) => (
                  <option key={ent.name} value={ent.name}>
                    {ent.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Selected Entity Summary Card */}
          {selectedEntity && (
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 space-y-1 text-xs">
              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                <span className="flex items-center gap-1 font-bold">
                  <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                  الاسم الحالي:
                </span>
                <span className="font-extrabold text-zinc-900 dark:text-white">{selectedEntity.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 text-[11px] ar-num">
                <div>
                  <span className="text-zinc-500">إجمالي المودعات: </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    +{formatCurrency(selectedEntity.depositedCents, activeWalletMeta?.symbol)}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">إجمالي المسحوبات: </span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    -{formatCurrency(selectedEntity.withdrawnCents, activeWalletMeta?.symbol)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* New Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block">
              الاسم الجديد للجهة:
            </label>
            <Input
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value)
                setError(null)
              }}
              placeholder="أدخل الاسم الجديد للجهة..."
              className="h-10 text-xs bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-xl focus-visible:ring-emerald-500 font-arabic"
            />
          </div>

          <DialogFooter className="flex-row-reverse gap-2 pt-2">
            <Button
              type="submit"
              disabled={isSubmitting || selectableEntities.length === 0}
              className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-arabic font-bold rounded-xl shadow-xs gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديل'}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="px-4 text-xs font-arabic border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
