import { describe, expect, it } from 'vitest'
import guideJson from '@data/guide.json'
import type { Guide, GuideProblem } from '@shared/types'
import { addDays, streaks } from '@shared/dates'
import { currentWeek, recommend, topicStats } from './recommend'
import { INTERVALS, schedule } from './revision'
import { hashSeed, pickNearRating, seededPick } from './potd'
import { topicForTags } from '../sync/topics'

const guide = guideJson as Guide
const byNo = new Map(guide.problems.map((p) => [p.no, p]))
const track = (id: 'A' | 'B' | 'C'): GuideProblem[] => guide.tracks[id].map((n) => byNo.get(n)!)
const empty = { mistakesByTopic: new Map(), shakyByTopic: new Map() }

describe('guide.json', () => {
  it('has all 203 problems across 18 topics', () => {
    expect(guide.problems).toHaveLength(203)
    expect(guide.topics).toHaveLength(18)
    expect(guide.problems.map((p) => p.no)).toEqual(Array.from({ length: 203 }, (_, i) => i + 1))
  })
  it('track A skips the topics the guide says to skip and has no hards above level 2', () => {
    for (const p of track('A')) {
      expect(p.level).toBeLessThanOrEqual(2)
      expect(['Graphs', 'Dynamic Programming', 'Tries', 'Advanced Data Structures']).not.toContain(p.topic)
    }
  })
  it('track B is every 4★+ problem', () => {
    expect(track('B').every((p) => p.priority >= 4)).toBe(true)
  })
})

describe('recommend', () => {
  it('starts a fresh user at Foundation problems in week 1', () => {
    const week = currentWeek(guide.roadmap, 0)
    const recs = recommend({ problems: track('B'), solvedSlugs: new Set(), week, ...empty })
    expect(recs).toHaveLength(5)
    for (const r of recs) {
      expect(r.problem.no).toBeGreaterThanOrEqual(1)
      expect(r.problem.no).toBeLessThanOrEqual(16)
    }
  })

  it('never recommends solved problems or duplicate slugs', () => {
    const solved = new Set(guide.problems.slice(0, 30).map((p) => p.slug))
    const recs = recommend({ problems: track('C'), solvedSlugs: solved, week: null, ...empty }, 50)
    const slugs = recs.map((r) => r.problem.slug)
    expect(slugs.some((s) => solved.has(s))).toBe(false)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('holds back higher-level problems while easier ones in that topic are open', () => {
    const arrays = track('C').filter((p) => p.topic === 'Arrays & Hashing')
    const recs = recommend({ problems: arrays, solvedSlugs: new Set(), week: null, ...empty }, 3)
    expect(recs.every((r) => r.problem.level === 1)).toBe(true)
  })

  it('boosts topics with recent mistakes', () => {
    const base = recommend({ problems: track('C'), solvedSlugs: new Set(), week: null, ...empty }, 200)
    const boosted = recommend({ problems: track('C'), solvedSlugs: new Set(), week: null, mistakesByTopic: new Map([['Graphs', 3]]), shakyByTopic: new Map() }, 200)
    const score = (rs: typeof base, slug: string): number => rs.find((r) => r.problem.slug === slug)!.score
    expect(score(boosted, 'number-of-islands')).toBeGreaterThan(score(base, 'number-of-islands'))
  })

  it('counts cross-listed problems once per topic', () => {
    const stats = topicStats(track('C'), new Set(['maximum-subarray']))
    const arrays = stats.find((s) => s.topic === 'Arrays & Hashing')!
    const greedy = stats.find((s) => s.topic === 'Greedy')!
    expect(arrays.solved).toBe(1)
    expect(greedy.solved).toBe(1)
  })
})

describe('roadmap', () => {
  it('maps days to weeks and stops after week 16', () => {
    expect(currentWeek(guide.roadmap, -1)).toBeNull()
    expect(currentWeek(guide.roadmap, 0)?.week).toBe(1)
    expect(currentWeek(guide.roadmap, 13)?.week).toBe(2)
    expect(currentWeek(guide.roadmap, 16 * 7)).toBeNull()
  })
})

describe('revision schedule', () => {
  const now = new Date(2026, 9, 17, 15, 30).getTime()
  it('climbs on confident reviews and resets on shaky ones', () => {
    let s = schedule(null, 3, now)
    expect(s.intervalDays).toBe(INTERVALS[1])
    s = schedule(s.reps, 3, now)
    expect(s.intervalDays).toBe(INTERVALS[2])
    expect(schedule(s.reps, 2, now).intervalDays).toBe(INTERVALS[2])
    expect(schedule(s.reps, 1, now).intervalDays).toBe(1)
  })
  it('caps at the top of the ladder and due dates land on midnight', () => {
    const s = schedule(99, 3, now)
    expect(s.intervalDays).toBe(INTERVALS.at(-1))
    expect(new Date(s.dueAt).getHours()).toBe(0)
  })
  it('revisits essentials sooner', () => {
    expect(schedule(3, 2, now, true).intervalDays).toBeLessThan(schedule(3, 2, now, false).intervalDays)
  })
})

describe('daily picks', () => {
  const problems = Array.from({ length: 400 }, (_, i) => ({ key: `cf:${i}`, rating: 800 + (i % 28) * 100 }))
  it('is stable for a date and varies across dates', () => {
    const a = pickNearRating(problems, 1200, new Set(), 'cf:2026-10-17')
    expect(pickNearRating(problems, 1200, new Set(), 'cf:2026-10-17')).toEqual(a)
    const picks = new Set(Array.from({ length: 10 }, (_, i) => pickNearRating(problems, 1200, new Set(), `cf:2026-10-${10 + i}`)?.key))
    expect(picks.size).toBeGreaterThan(1)
  })
  it('stays in the rating band and skips solved problems', () => {
    const solved = new Set(problems.filter((p) => p.rating === 1300).map((p) => p.key))
    for (let i = 0; i < 20; i++) {
      const p = pickNearRating(problems, 1200, solved, `d${i}`)!
      expect(p.rating).toBeGreaterThanOrEqual(1250)
      expect(p.rating).toBeLessThanOrEqual(1450)
      expect(solved.has(p.key)).toBe(false)
    }
  })
  it('widens the band rather than returning nothing', () => {
    expect(pickNearRating(problems, 4000, new Set(), 'x')).not.toBeNull()
    expect(seededPick([], 'x')).toBeNull()
    expect(hashSeed('a')).not.toBe(hashSeed('b'))
  })
})

describe('streaks', () => {
  const today = '2026-10-17'
  it('counts consecutive days ending today or yesterday', () => {
    const days = [0, 1, 2, 5, 6].map((d) => addDays(today, -d))
    expect(streaks(days, today)).toEqual({ current: 3, longest: 3 })
    expect(streaks(days.slice(1), today).current).toBe(2)
    expect(streaks([addDays(today, -2)], today).current).toBe(0)
  })
  it('crosses month boundaries', () => {
    const days = ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']
    expect(streaks(days, '2026-10-02')).toEqual({ current: 4, longest: 4 })
  })
})

describe('topicForTags', () => {
  it('maps platform tags to guide topics, most specific first', () => {
    expect(topicForTags(['array', 'hash-table', 'sliding-window'])).toBe('Sliding Window')
    expect(topicForTags(['dp', 'greedy'])).toBe('Dynamic Programming')
    expect(topicForTags(['dfs and similar', 'trees'])).toBe('Graphs')
    expect(topicForTags(['implementation'])).toBeNull()
  })
})
