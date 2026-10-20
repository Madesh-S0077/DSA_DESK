import { DAY_MS } from '@shared/dates'

/** Spacing ladder in days. Confidence 3 climbs a rung, 2 repeats it, 1 drops back to the start. */
export const INTERVALS = [1, 3, 7, 14, 30, 60]

export interface Schedule {
  reps: number
  intervalDays: number
  dueAt: number
}

export function schedule(prevReps: number | null, confidence: number, now: number, essential = false): Schedule {
  let reps: number
  if (prevReps == null) reps = confidence >= 3 ? 1 : 0
  else if (confidence >= 3) reps = prevReps + 1
  else if (confidence === 2) reps = prevReps
  else reps = 0

  let intervalDays = INTERVALS[Math.min(reps, INTERVALS.length - 1)]
  // The guide's 50 Essential problems should be solvable "almost from memory": revisit them sooner.
  if (essential) intervalDays = Math.max(1, Math.ceil(intervalDays * 0.7))

  return { reps, intervalDays, dueAt: startOfDay(now) + intervalDays * DAY_MS }
}

function startOfDay(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
