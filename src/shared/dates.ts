// Local-time date helpers. Streaks and "today" follow the user's wall clock, not UTC.

export const DAY_MS = 86_400_000

export function dateKey(t: number | Date = Date.now()): string {
  const d = typeof t === 'number' ? new Date(t) : t
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, n: number): string {
  const d = parseDateKey(key)
  d.setDate(d.getDate() + n)
  return dateKey(d)
}

/** Whole calendar days from `a` to `b` (both YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDateKey(b).getTime() - parseDateKey(a).getTime()) / DAY_MS)
}

/** Current and longest run of consecutive active days. Today being empty doesn't break the current streak yet. */
export function streaks(activeDays: Iterable<string>, today: string): { current: number; longest: number } {
  const set = new Set(activeDays)
  let current = 0
  let cursor = set.has(today) ? today : addDays(today, -1)
  while (set.has(cursor)) {
    current++
    cursor = addDays(cursor, -1)
  }
  let longest = 0
  for (const day of set) {
    if (set.has(addDays(day, -1))) continue
    let len = 1
    while (set.has(addDays(day, len))) len++
    longest = Math.max(longest, len)
  }
  return { current, longest }
}
