import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { ShoppingBag, Sparkles } from 'lucide-react'
import { playLoginSuccessSound } from '@/lib/soundEffects'
import logoImg from '@/assets/logo.png'

interface WelcomeSplashProps {
  displayName: string
  onComplete: () => void
}

export function WelcomeSplash({ displayName, onComplete }: WelcomeSplashProps) {
  useEffect(() => {
    playLoginSuccessSound()
    const timer = setTimeout(() => {
      onComplete()
    }, 2000)

    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 transition-colors duration-500 dir-rtl font-arabic select-none overflow-hidden app-drag-region">
      {/* Background Centered Gradient Glow (MJS Dual Neon) */}
      <div className="bg-gradient-to-tr from-cyan-500/25 via-fuchsia-500/20 to-transparent blur-3xl w-80 h-80 rounded-full absolute pointer-events-none" />

      {/* Main Animated Content Box */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center text-center p-6 space-y-5"
      >
        {/* Emblem Container */}
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-white dark:bg-slate-900 flex items-center justify-center shadow-xl shadow-cyan-500/25 border-2 border-cyan-500/40 overflow-hidden p-1">
            <img
              src={logoImg}
              alt="شعار منظومة إدارة مالية"
              className="w-full h-full object-cover"
            />
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 300 }}
            className="absolute -top-1.5 -right-1.5 w-7 h-7 bg-cyan-400 dark:bg-cyan-400 text-slate-950 rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-slate-950"
          >
            <Sparkles className="w-4 h-4" />
          </motion.div>
        </div>

        {/* Dynamic Welcome Text */}
        <div className="space-y-1">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white"
          >
            مرحباً {displayName}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="text-xs text-slate-500 dark:text-slate-400 font-medium"
          >
            جاري تجهيز منظومة إدارة مالية...
          </motion.p>
        </div>

        {/* Pulsing Loading Bar */}
        <motion.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 192 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="h-1.5 w-48 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden relative mt-2"
        >
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{
              repeat: Infinity,
              duration: 1.2,
              ease: 'easeInOut',
            }}
            className="h-full w-full bg-gradient-to-r from-fuchsia-500 via-indigo-500 to-cyan-400 rounded-full"
          />
        </motion.div>
      </motion.div>
    </div>
  )
}
