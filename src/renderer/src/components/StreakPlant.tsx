import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * The streak as a little potted plant: a sprout at day 1, more leaves as the streak grows,
 * a flower from two weeks on. It wilts (greys) when today is still empty.
 */
export function StreakPlant({ streak, doneToday, size = 120 }: { streak: number; doneToday: boolean; size?: number }): ReactNode {
  // Leaves come in pairs so even a 1-day sprout looks balanced.
  const leaves = streak === 0 ? 0 : Math.min(6, 2 * Math.ceil(streak / 4))
  const stemHeight = streak === 0 ? 0 : 24 + Math.min(30, streak * 3)
  const flower = streak >= 14
  const leafColor = doneToday ? 'var(--sage)' : 'var(--muted)'
  const baseY = 78
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-label={`${streak}-day streak`}>
      {/* stem */}
      <motion.path
        d={`M50 ${baseY} C 48 ${baseY - stemHeight / 2}, 52 ${baseY - stemHeight / 2}, 50 ${baseY - stemHeight}`}
        stroke={leafColor} strokeWidth={2.5} fill="none" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9 }}
      />
      {Array.from({ length: leaves }).map((_, i) => {
        const y = baseY - 10 - (Math.floor(i / 2) * (stemHeight - 14)) / Math.max(1, leaves / 2)
        const left = i % 2 === 0
        return (
          <motion.ellipse
            key={i}
            cx={left ? 43 : 57} cy={y} rx={7} ry={3.6}
            transform={`rotate(${left ? -30 : 30} ${left ? 43 : 57} ${y})`}
            fill={leafColor}
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 + i * 0.08, type: 'spring', stiffness: 220 }}
          />
        )
      })}
      {flower && (
        <motion.g initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.9, type: 'spring' }} style={{ transformOrigin: `50px ${baseY - stemHeight}px` }}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx={50} cy={baseY - stemHeight - 5} rx={3.4} ry={5.5} fill="var(--peach)" transform={`rotate(${a} 50 ${baseY - stemHeight})`} />
          ))}
          <circle cx={50} cy={baseY - stemHeight} r={3} fill="var(--butter)" />
        </motion.g>
      )}
      {streak === 0 && <circle cx={50} cy={baseY - 2} r={2.2} fill="var(--muted)" />}
      {/* pot */}
      <path d="M33 78 h34 l-4 16 h-26 z" fill="var(--peach)" />
      <rect x={31} y={74} width={38} height={6} rx={2} fill="var(--peach-deep)" />
    </svg>
  )
}
