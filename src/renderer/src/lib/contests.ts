import { useEffect, useState } from 'react'
import type { Contest, Platform } from '@shared/types'
import { addDays, dateKey } from '@shared/dates'

/** A soft tint per platform, so a schedule reads at a glance. Pill classes plus a dot colour. */
export const PLATFORM_TINT: Record<Platform, { pill: string; dot: string }> = {
  leetcode: { pill: 'bg-butter-soft text-butter-deep', dot: 'var(--butter)' },
  codeforces: { pill: 'bg-lavender/20 text-ink-soft', dot: 'var(--lavender)' },
  atcoder: { pill: 'bg-sage-soft text-sage-deep', dot: 'var(--sage)' },
  gfg: { pill: 'bg-peach-soft text-peach-deep', dot: 'var(--peach)' }
}

/** Current time, re-rendered every `everyMs`. */
export function useNow(everyMs = 1000): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [everyMs])
  return now
}

export const endOf = (c: Contest): number => c.start + c.durationMin * 60_000
export const isLive = (c: Contest, now: number): boolean => c.start <= now && now < endOf(c)

const pad = (n: number): string => String(n).padStart(2, '0')

/** "3d 04:12:09" or "04:12:09". */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400)
  const hms = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
  return d ? `${d}d ${hms}` : hms
}

/** "in 2d 4h", "in 3h 12m", "in 8m". */
export function relative(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000))
  if (m < 60) return `in ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `in ${h}h ${m % 60}m`
  return `in ${Math.floor(h / 24)}d ${h % 24}h`
}

export function duration(min: number): string {
  const h = Math.floor(min / 60)
  if (h >= 48) return `${Math.round(h / 24)} days`
  return h ? `${h}h${min % 60 ? ` ${min % 60}m` : ''}` : `${min}m`
}

export const timeOf = (t: number): string => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

/** "Today", "Tomorrow", or "Saturday, 24 Oct". */
export function dayLabel(t: number, now = Date.now()): string {
  const k = dateKey(t)
  if (k === dateKey(now)) return 'Today'
  if (k === addDays(dateKey(now), 1)) return 'Tomorrow'
  return new Date(t).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })
}
