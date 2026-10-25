// Live checks against the real platform APIs. Run with `npm run smoke:sync`.
// Override the accounts with SMOKE_LC / SMOKE_CF / SMOKE_AC / SMOKE_GFG.
import { describe, expect, it } from 'vitest'
import * as lc from './leetcode'
import * as cf from './codeforces'
import * as ac from './atcoder'
import * as gfg from './gfg'

const LC = process.env.SMOKE_LC ?? 'lee215'
const CF = process.env.SMOKE_CF ?? 'tourist'
const AC = process.env.SMOKE_AC ?? 'tourist'
const GFG = process.env.SMOKE_GFG

describe('LeetCode', () => {
  it('daily challenge', async () => {
    const d = await lc.fetchDaily()
    console.log('LC daily:', d.title, d.difficulty, d.topic)
    expect(d.key).toMatch(/^lc:/)
  })
  it(`profile + recent AC for ${LC}`, async () => {
    const p = await lc.fetchProfile(LC)
    const recent = await lc.fetchRecentAc(LC)
    console.log(`LC ${LC}: solved=${p.solved} rating=${p.rating} contests=${p.history.length} recent=${recent.length}`)
    expect(p.solved).toBeGreaterThan(0)
    expect(recent.every((r) => r.solvedAt! > 1e12)).toBe(true)
  })
})

describe('Codeforces', () => {
  it(`user ${CF}`, async () => {
    const u = await cf.fetchUser(CF)
    const solvedRecent = await cf.fetchSolved(CF, Math.floor(Date.now() / 1000) - 120 * 86400)
    console.log(`CF ${CF}: rating=${u.rating} max=${u.maxRating} solved(120d)=${solvedRecent.length}`, solvedRecent[0]?.title)
    expect(u.rating).toBeGreaterThan(0)
  })
  it('problemset', async () => {
    const ps = await cf.fetchProblemset()
    console.log('CF problemset:', ps.length)
    expect(ps.length).toBeGreaterThan(5000)
  })
})

describe('AtCoder', () => {
  it(`user ${AC}`, async () => {
    const [problems, models] = await Promise.all([ac.fetchProblems(), ac.fetchDifficulties()])
    const titles = new Map(problems.map((p) => [p.id, p.title]))
    const diff = new Map(Object.entries(models).filter(([, m]) => m.difficulty != null).map(([id, m]) => [id, m.difficulty!]))
    const { solved } = await ac.fetchSolved(AC, Math.floor(Date.now() / 1000) - 365 * 86400, titles, diff)
    const hist = await ac.fetchRatingHistory(AC)
    console.log(`AC ${AC}: problems=${problems.length} solved(1y)=${solved.length} rating=${hist.at(-1)?.rating}`, solved[0]?.title)
    expect(problems.length).toBeGreaterThan(1000)
    expect(hist.length).toBeGreaterThan(0)
  })
})

describe('GeeksforGeeks', () => {
  it('problem of the day', async () => {
    const p = await gfg.fetchPotd()
    console.log('GFG POTD:', p.title, p.difficulty, p.topic, p.key)
    expect(p.key).toMatch(/^gfg:[^/]+$/)
  })
  it.runIf(!!GFG)(`solved list for ${GFG}`, async () => {
    const s = await gfg.fetchSolved(GFG!)
    console.log(`GFG ${GFG}: solved=${s.length}`)
    expect(Array.isArray(s)).toBe(true)
  })
})

describe('Contests', () => {
  for (const [name, fetch] of [['LeetCode', lc.fetchContests], ['Codeforces', cf.fetchContests], ['AtCoder', ac.fetchContests], ['GeeksforGeeks', gfg.fetchContests]] as const) {
    it(`${name} upcoming`, async () => {
      const cs = await fetch()
      console.log(`${name} contests: ${cs.length}`, cs.slice(0, 2).map((c) => `${c.name} @ ${new Date(c.start).toISOString()} (${c.durationMin}m)`))
      expect(cs.every((c) => c.start > 1.7e12 && c.durationMin > 0 && c.url.startsWith('https://'))).toBe(true)
    })
  }
})
