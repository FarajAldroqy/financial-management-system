import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWallet, WALLETS, type WalletType } from '@/context/WalletContext'
import logoImg from '@/assets/logo.png'

// Wallet card definition
interface CardDef {
  type: WalletType
  flag: string
  gradientFrom: string
  gradientTo: string
  glowColor: string
  borderColor: string
  badgeBg: string
  badgeText: string
}

const CARDS: CardDef[] = [
  {
    type: 'LYD',
    flag: '🇱🇾',
    gradientFrom: '#0e7490',
    gradientTo: '#164e63',
    glowColor: 'rgba(6,182,212,0.45)',
    borderColor: 'rgba(6,182,212,0.5)',
    badgeBg: 'rgba(6,182,212,0.15)',
    badgeText: '#22d3ee',
  },
  {
    type: 'USD',
    flag: '🇺🇸',
    gradientFrom: '#065f46',
    gradientTo: '#064e3b',
    glowColor: 'rgba(16,185,129,0.45)',
    borderColor: 'rgba(16,185,129,0.5)',
    badgeBg: 'rgba(16,185,129,0.15)',
    badgeText: '#34d399',
  },
]

export function WalletSelectScreen() {
  const { selectWallet } = useWallet()
  const [hovered, setHovered] = useState<WalletType | null>(null)
  const [selecting, setSelecting] = useState<WalletType | null>(null)

  const handleSelect = (type: WalletType) => {
    if (selecting) return
    setSelecting(type)
    // Brief delay so the press animation plays before transition
    setTimeout(() => selectWallet(type), 480)
  }

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-hidden select-none font-arabic"
      style={{
        background: 'radial-gradient(ellipse at 50% 30%, #0f172a 0%, #070b14 100%)',
      }}
      dir="rtl"
    >
      {/* Ambient background glows */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 25% 60%, rgba(6,182,212,0.12) 0%, transparent 55%),
            radial-gradient(circle at 75% 40%, rgba(16,185,129,0.10) 0%, transparent 55%)
          `,
        }}
      />

      {/* Top logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center gap-3 mb-10"
      >
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border-2 border-amber-500/40 shadow-xl shadow-cyan-500/20 flex items-center justify-center overflow-hidden p-0.5">
          <img src={logoImg} alt="شعار منظومة إدارة مالية" className="w-full h-full object-cover" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-white tracking-tight leading-none">منظومة إدارة مالية</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">إدارة السيولة والخزينة</p>
        </div>
      </motion.div>

      {/* Instruction heading */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 text-center mb-8"
      >
        <h2 className="text-xl font-bold text-white mb-1">اختر نوع المحفظة</h2>
        <p className="text-sm text-slate-400">يتم فصل كل محفظة بشكل تام عن الأخرى</p>
      </motion.div>

      {/* Wallet Cards Row */}
      <div className="relative z-10 flex items-center justify-center gap-6 px-4 w-full max-w-xl">
        {CARDS.map((card, idx) => {
          const meta = WALLETS[card.type]
          const isHovered = hovered === card.type
          const isSelecting = selecting === card.type
          const isOtherSelecting = selecting !== null && selecting !== card.type

          return (
            <motion.button
              key={card.type}
              id={`wallet-card-${card.type.toLowerCase()}`}
              initial={{ opacity: 0, y: 28, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.28 + idx * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => handleSelect(card.type)}
              onMouseEnter={() => setHovered(card.type)}
              onMouseLeave={() => setHovered(null)}
              disabled={!!selecting}
              className="relative flex-1 min-w-0 max-w-[200px] rounded-3xl cursor-pointer outline-none disabled:cursor-default"
              style={{
                boxShadow: isHovered || isSelecting
                  ? `0 0 40px ${card.glowColor}, 0 8px 32px rgba(0,0,0,0.4)`
                  : '0 4px 24px rgba(0,0,0,0.35)',
                border: `1.5px solid ${isHovered || isSelecting ? card.borderColor : 'rgba(255,255,255,0.08)'}`,
                background: `linear-gradient(145deg, ${card.gradientFrom}80, ${card.gradientTo}cc)`,
                opacity: isOtherSelecting ? 0.35 : 1,
                transform: isSelecting ? 'scale(1.04)' : isHovered ? 'scale(1.025)' : 'scale(1)',
                transition: 'transform 0.25s ease, opacity 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
              }}
            >
              {/* Inner card content */}
              <div className="flex flex-col items-center justify-center gap-4 p-7">
                {/* Flag / Emoji */}
                <motion.div
                  animate={{ scale: isSelecting ? [1, 1.25, 1] : 1 }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                  className="text-5xl leading-none"
                  aria-hidden
                >
                  {card.flag}
                </motion.div>

                {/* Currency symbol badge */}
                <div
                  className="px-3 py-1 rounded-full text-sm font-extrabold"
                  style={{ background: card.badgeBg, color: card.badgeText }}
                >
                  {meta.symbol}
                </div>

                {/* Name */}
                <div className="text-center">
                  <p className="text-base font-extrabold text-white leading-tight">{meta.labelAr}</p>
                  <p className="text-xs text-slate-400 mt-0.5 font-mono">{meta.type}</p>
                </div>

                {/* Selection ripple indicator */}
                <AnimatePresence>
                  {isSelecting && (
                    <motion.div
                      key="ripple"
                      initial={{ scale: 0, opacity: 1 }}
                      animate={{ scale: 2.5, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5 }}
                      className="absolute inset-0 rounded-3xl"
                      style={{ border: `2px solid ${card.badgeText}` }}
                    />
                  )}
                </AnimatePresence>
              </div>

              {/* Subtle shimmer line at top */}
              <div
                className="absolute inset-x-4 top-0 h-px rounded-full"
                style={{ background: `linear-gradient(90deg, transparent, ${card.badgeText}60, transparent)` }}
              />
            </motion.button>
          )
        })}
      </div>

      {/* Footer separator note */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65, duration: 0.5 }}
        className="relative z-10 mt-10 text-xs text-slate-600 text-center font-medium"
      >
        لكل محفظة جهاتها وخزينتها المنفصلة تماماً
      </motion.p>
    </div>
  )
}
