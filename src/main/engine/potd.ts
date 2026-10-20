// Deterministic daily picks: the same date always yields the same problem.

export function hashSeed(s: string): number {
  // FNV-1a
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function seededPick<T>(items: T[], seed: string): T | null {
  if (!items.length) return null
  return items[hashSeed(seed) % items.length]
}

export interface Rated {
  key: string
  rating: number | null | undefined
}

/**
 * An unsolved problem slightly above the user's level. Widens the band step by step if it's empty
 * (e.g. very high ratings, or a newcomer with no rating yet).
 */
export function pickNearRating<T extends Rated>(
  problems: T[],
  rating: number,
  solved: Set<string>,
  seed: string,
  band: [number, number] = [50, 250]
): T | null {
  const open = problems.filter((p) => p.rating != null && !solved.has(p.key))
  for (const widen of [0, 150, 400, 1000]) {
    const lo = rating + band[0] - widen
    const hi = rating + band[1] + widen
    const pick = seededPick(
      open.filter((p) => p.rating! >= lo && p.rating! <= hi),
      seed
    )
    if (pick) return pick
  }
  return null
}
