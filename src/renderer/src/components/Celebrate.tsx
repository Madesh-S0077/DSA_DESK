import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'
import { useApp } from '../lib/store'

const COLORS = ['var(--sage)', 'var(--peach)', 'var(--butter)', 'var(--lavender)', 'var(--sage-deep)']

/** A gentle shower of falling leaves when the daily goal is reached. */
export function Celebrate(): ReactNode {
  const count = useApp((s) => s.celebrate)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!count) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setActive(true)
    const t = setTimeout(() => setActive(false), 4200)
    return () => clearTimeout(t)
  }, [count])

  return (
    <AnimatePresence>
      {active && (
        <motion.div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" exit={{ opacity: 0 }}>
          {Array.from({ length: 36 }).map((_, i) => {
            const left = (i * 37) % 100
            const delay = (i % 12) * 0.12
            const drift = ((i * 53) % 120) - 60
            return (
              <motion.svg
                key={i} width={18} height={18} viewBox="0 0 20 20" className="absolute -top-6" style={{ left: `${left}%` }}
                initial={{ y: -20, x: 0, rotate: 0, opacity: 1 }}
                animate={{ y: '105vh', x: drift, rotate: 360 + i * 20, opacity: [1, 1, 0.8] }}
                transition={{ duration: 3 + (i % 5) * 0.3, delay, ease: 'easeIn' }}
              >
                <path d="M10 1 C 17 5, 17 14, 10 19 C 3 14, 3 5, 10 1 Z" fill={COLORS[i % COLORS.length]} />
              </motion.svg>
            )
          })}
          <motion.div
            className="absolute top-10 left-1/2 -translate-x-1/2 rounded-2xl border border-line bg-card px-6 py-3 font-serif text-[18px] shadow-soft"
            initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', delay: 0.2 }}
          >
            🌿 Daily goal complete. Lovely work.
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
