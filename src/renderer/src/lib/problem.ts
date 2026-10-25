import type { Guide, GuideProblem, ProblemDetails, ProblemRef } from '@shared/types'

export const LEVELS = {
  1: { emoji: '🟢', label: 'Foundation' },
  2: { emoji: '🔵', label: 'Pattern Building' },
  3: { emoji: '🟠', label: 'Interview' },
  4: { emoji: '🔴', label: 'MAANG' }
} as const

export function guideRef(p: GuideProblem): ProblemRef {
  return { key: `lc:${p.slug}`, platform: 'leetcode', title: p.title, url: p.url, difficulty: p.difficulty, topic: p.topic, guideNo: p.no }
}

/** A short nudge for focus mode: the problem's pattern, else its topic's recognition signals. */
export function hintFor(guide: Guide, p: GuideProblem): string {
  const d = p.details.seeAlso ? (guide.problems.find((x) => x.no === p.details.seeAlso)?.details ?? p.details) : p.details
  const parts = [d.pattern && `Pattern: ${d.pattern}`, d.concept && `Key idea: ${d.concept}`].filter(Boolean)
  if (parts.length) return parts.join('\n')
  return guide.topics.find((t) => t.name === p.topic)?.card.signals ?? ''
}

/** Interview timebox from the guide: ~20 min medium, ~35 min hard. */
export function timeboxFor(difficulty?: string | null): number {
  return difficulty === 'Hard' ? 35 : difficulty === 'Easy' ? 15 : 20
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

export function timeAgo(t: number | null): string {
  if (!t) return 'never'
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

/** "Amazon, Google · Extremely frequently asked", or "Asked everywhere". */
export function companyLine(d: ProblemDetails): string {
  const names = [...(d.companies ?? []), ...(d.everywhere ? [d.companies?.length ? 'and everywhere else' : 'Asked everywhere'] : [])].join(', ')
  return d.companyNote ? `${names} · ${d.companyNote}` : names
}
