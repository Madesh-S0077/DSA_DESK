import type { GuideProblem, Recommendation, RoadmapWeek, TopicStat } from '@shared/types'

export interface RecommendInput {
  /** Sheet problems in the chosen track. */
  problems: GuideProblem[]
  solvedSlugs: Set<string>
  /** Current roadmap week, if the roadmap is running. */
  week: RoadmapWeek | null
  /** Recent mistake count per topic. */
  mistakesByTopic: Map<string, number>
  /** Solves marked with confidence 1 per topic. */
  shakyByTopic: Map<string, number>
  /** The target company that asks this problem, if any. */
  targetFor?: (p: GuideProblem) => string | null
}

/** Solved share per topic within the track; weakness rises as coverage falls. */
export function topicStats(problems: GuideProblem[], solvedSlugs: Set<string>): TopicStat[] {
  const by = new Map<string, { solved: number; total: number; seen: Set<string> }>()
  for (const p of problems) {
    const t = by.get(p.topic) ?? { solved: 0, total: 0, seen: new Set() }
    // Cross-listed problems (same slug in two topics) count once per topic.
    if (!t.seen.has(p.slug)) {
      t.seen.add(p.slug)
      t.total++
      if (solvedSlugs.has(p.slug)) t.solved++
    }
    by.set(p.topic, t)
  }
  return [...by].map(([topic, { solved, total }]) => ({ topic, solved, total, weakness: total ? 1 - solved / total : 0 }))
}

/**
 * Score unsolved sheet problems:
 *   priority*2 + roadmap bonus + weakness bonus + target-company bonus − level-gap penalty
 * The level gate keeps 🔴 problems back while easier ones in the same topic are still open,
 * matching the guide's "work top-to-bottom within a topic" rule.
 */
export function recommend(input: RecommendInput, limit = 5): Recommendation[] {
  const { problems, solvedSlugs, week, mistakesByTopic, shakyByTopic, targetFor } = input
  const stats = new Map(topicStats(problems, solvedSlugs).map((s) => [s.topic, s]))

  const minOpenLevel = new Map<string, number>()
  for (const p of problems) {
    if (solvedSlugs.has(p.slug)) continue
    minOpenLevel.set(p.topic, Math.min(minOpenLevel.get(p.topic) ?? 9, p.level))
  }

  const seen = new Set<string>()
  const out: Recommendation[] = []
  for (const p of [...problems].sort((a, b) => a.no - b.no)) {
    if (solvedSlugs.has(p.slug) || seen.has(p.slug)) continue
    seen.add(p.slug)

    const reasons: string[] = []
    let score = p.priority * 2
    if (p.priority === 5) reasons.push('Must do')

    if (week?.from != null && week.to != null) {
      if (p.no >= week.from && p.no <= week.to) {
        score += 6
        reasons.push(`Week ${week.week} roadmap`)
      } else if (p.no < week.from) {
        score += 2
        reasons.push('Roadmap backlog')
      }
    }

    const st = stats.get(p.topic)
    const started = st && st.solved > 0
    const pressure = Math.min(3, (mistakesByTopic.get(p.topic) ?? 0) + (shakyByTopic.get(p.topic) ?? 0))
    if (st && started) score += 3 * st.weakness
    if (pressure > 0) {
      score += pressure
      reasons.push(`Shore up ${p.topic}`)
    } else if (st && started && st.weakness >= 0.6) {
      reasons.push(`Weak topic: ${p.topic}`)
    }

    const company = targetFor?.(p)
    if (company) {
      score += 3
      reasons.push(`Asked at ${company}`)
    }

    const gap = p.level - (minOpenLevel.get(p.topic) ?? p.level)
    score -= gap * 5

    out.push({ problem: p, score: Math.round(score * 10) / 10, reasons })
  }
  return out.sort((a, b) => b.score - a.score || a.problem.no - b.problem.no).slice(0, limit)
}

/** Roadmap week for a given day, or null before the start / after the last week. */
export function currentWeek(roadmap: RoadmapWeek[], daysSinceStart: number): RoadmapWeek | null {
  if (daysSinceStart < 0) return null
  return roadmap[Math.floor(daysSinceStart / 7)] ?? null
}
