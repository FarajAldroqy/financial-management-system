import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Trash2, X } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface DeleteConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  description?: string
}

export function DeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'حذف المعاملة',
  description = 'هل أنت تأكد من رغبتك في حذف هذا العنصر؟ لا يمكن التراجع عن هذا الإجراء.',
}: DeleteConfirmModalProps) {
  const { hasPermission } = usePermission()
  const canDeleteItems = hasPermission('delete_items')

  // Global safety guarantee: Never leave document.body pointerEvents as 'none'
  useEffect(() => {
    document.body.style.pointerEvents = 'auto'
    return () => {
      document.body.style.pointerEvents = 'auto'
    }
  }, [open])

  // Escape key handler
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const handleConfirm = () => {
    if (!canDeleteItems) {
      alert('عذراً، لا تملك صلاحية الحذف')
      onClose()
      return
    }
    // Ensure body interaction is never frozen
    document.body.style.pointerEvents = 'auto'
    onConfirm()
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-arabic select-none">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl rounded-2xl p-6 overflow-hidden"
            dir="rtl"
          >
            {/* Close 'X' Button */}
            <button
              onClick={onClose}
              className="absolute left-4 top-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header Content */}
            <div className="text-right">
              <div className="flex items-center gap-3.5 mb-2">
                <div className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center shrink-0 shadow-xs">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-arabic text-zinc-900 dark:text-zinc-100">
                    {title}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-arabic mt-0.5 leading-relaxed">
                    {description}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 mt-6 font-arabic">
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 h-9.5 px-4 text-xs bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>تأكيد الحذف النهائي</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-9.5 px-4 text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
