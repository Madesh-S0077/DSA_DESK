import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { LEVELS } from '../lib/problem'

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ')
}

export function Card({
  children, className, delay = 0, pad = 'p-6'
}: { children: ReactNode; className?: string; delay?: number; pad?: 'p-0' | 'p-5' | 'p-6' }): ReactNode {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
      className={cx('relative rounded-[var(--radius-card)] border border-line bg-card shadow-soft', pad, className)}
    >
      {children}
    </motion.section>
  )
}

export function CardTitle({ children, icon, action }: { children: ReactNode; icon?: ReactNode; action?: ReactNode }): ReactNode {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-serif text-[17px] font-semibold text-ink">
        {icon && <span className="text-sage-deep">{icon}</span>}
        {children}
      </h2>
      {action}
    </div>
  )
}

type Variant = 'primary' | 'soft' | 'ghost' | 'peach'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-sage-deep text-white hover:brightness-105 dark:text-bg',
  soft: 'bg-sage-soft text-sage-deep hover:brightness-[0.97]',
  peach: 'bg-peach-soft text-peach-deep hover:brightness-[0.97]',
  ghost: 'text-ink-soft hover:bg-bg-deep'
}

export function Button({
  variant = 'soft', size = 'md', className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }): ReactNode {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl font-medium transition active:scale-[0.98] disabled:cursor-default disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        VARIANTS[variant],
        className
      )}
    >
      {children}
    </button>
  )
}

const DIFF: Record<string, string> = {
  Easy: 'bg-sage-soft text-sage-deep',
  Medium: 'bg-butter-soft text-butter-deep',
  Hard: 'bg-peach-soft text-peach-deep'
}

export function Pill({ children, className }: { children: ReactNode; className?: string }): ReactNode {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium', className)}>{children}</span>
}

export function DifficultyPill({ difficulty, rating }: { difficulty?: string | null; rating?: number | null }): ReactNode {
  if (!difficulty && rating == null) return null
  return (
    <Pill className={DIFF[difficulty ?? ''] ?? 'bg-bg-deep text-ink-soft'}>
      {difficulty}
      {rating != null && <span className="opacity-75">· {rating}</span>}
    </Pill>
  )
}

export function LevelPill({ level }: { level: 1 | 2 | 3 | 4 }): ReactNode {
  return (
    <Pill className="bg-bg-deep text-ink-soft" >
      <span className="text-[10px]">{LEVELS[level].emoji}</span>
      {LEVELS[level].label}
    </Pill>
  )
}

export function Stars({ n }: { n: number }): ReactNode {
  return (
    <span className="text-[11px] tracking-tight text-butter-deep" title={`Priority ${n}/5`}>
      {'★'.repeat(n)}
      <span className="text-line">{'★'.repeat(5 - n)}</span>
    </span>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }): ReactNode {
  return (
    <header className="mb-7 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-[32px] leading-tight font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

export function ProgressRing({
  value, max, size = 120, stroke = 10, color = 'var(--sage)', children
}: { value: number; max: number; size?: number; stroke?: number; color?: string; children?: ReactNode }): ReactNode {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, value / max) : 0
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-deep)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

export function Bar({ value, max, color = 'var(--sage)' }: { value: number; max: number; color?: string }): ReactNode {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-bg-deep">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  )
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }): ReactNode {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted">
      {icon && <div className="mb-1 text-3xl">{icon}</div>}
      <p className="font-serif text-[16px] text-ink-soft">{title}</p>
      {children && <div className="max-w-sm text-[13px]">{children}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }): ReactNode {
  return <div className={cx('animate-pulse rounded-xl bg-bg-deep', className)} />
}

export function Modal({ open, onClose, title, children, width = 480 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number }): ReactNode {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgb(40_34_26/0.35)] p-6 backdrop-blur-[2px]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog" aria-label={title}
            className="w-full rounded-[24px] border border-line bg-card p-7 shadow-soft"
            style={{ maxWidth: width }}
            initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22 }}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="font-serif text-[22px] font-semibold">{title}</h2>
              <button onClick={onClose} className="cursor-pointer rounded-lg p-1 text-muted hover:bg-bg-deep" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }): ReactNode {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted/70 outline-none transition focus:border-sage focus:ring-2 focus:ring-sage-soft'

export function Segmented<T extends string | number>({
  value, onChange, options
}: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }): ReactNode {
  return (
    <div className="inline-flex rounded-xl bg-bg-deep p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-medium transition',
            value === o.value ? 'bg-card text-ink shadow-soft' : 'text-muted hover:text-ink-soft'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }): ReactNode {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer rounded-full transition', checked ? 'bg-sage' : 'bg-line')}
      >
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
      <div>
        <div className="text-[14px] font-medium">{label}</div>
        <div className="mt-0.5 text-[12px] text-muted">{hint}</div>
      </div>
    </div>
  )
}
