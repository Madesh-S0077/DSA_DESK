import type { Store } from '../db'
import type { GuideProblem, Platform, SyncResult } from '@shared/types'
import { PLATFORM_LABEL } from '@shared/types'
import { DAY_MS } from '@shared/dates'
import * as lc from './leetcode'
import * as cf from './codeforces'
import * as ac from './atcoder'
import * as gfg from './gfg'
import { topicForTags } from './topics'
import { schedule } from '../engine/revision'

export interface SyncContext {
  store: Store
  guideBySlug: Map<string, GuideProblem>
  essential: Set<number>
}

const running = new Map<Platform, Promise<SyncResult>>()

/** Runs one platform's sync; concurrent calls for the same platform share a single run. */
export function syncPlatform(ctx: SyncContext, platform: Platform): Promise<SyncResult> {
  const existing = running.get(platform)
  if (existing) return existing
  const p = run(ctx, platform).finally(() => running.delete(platform))
  running.set(platform, p)
  return p
}

async function run(ctx: SyncContext, platform: Platform): Promise<SyncResult> {
  const { store } = ctx
  const settings = store.getSettings()
  const username = settings.usernames[platform].trim()
  if (!username) return { platform, ok: false, added: 0, message: 'No username set' }
  try {
    const added = await SYNCERS[platform](ctx, username, settings.lcSession.trim())
    store.setSyncState(platform, { lastSync: Date.now(), error: null, solved: countSolved(store, platform) })
    return { platform, ok: true, added, message: added ? `${added} new solve${added > 1 ? 's' : ''}` : 'Up to date' }
  } catch (e) {
    const message = (e as Error).message || 'Sync failed'
    store.setSyncState(platform, { error: message })
    return { platform, ok: false, added: 0, message: `${PLATFORM_LABEL[platform]}: ${message}` }
  }
}

function countSolved(store: Store, platform: Platform): number {
  const prefix = PREFIX[platform]
  return [...store.solvedKeys()].filter((k) => k.startsWith(prefix)).length
}

const PREFIX: Record<Platform, string> = { leetcode: 'lc:', codeforces: 'cf:', atcoder: 'ac:', gfg: 'gfg:' }

type Syncer = (ctx: SyncContext, username: string, lcSession: string) => Promise<number>

/** Synced sheet problems join the revision queue at a neutral confidence. */
function scheduleSheetRevision(ctx: SyncContext, key: string, solvedAt: number, guide: GuideProblem | undefined): void {
  if (!guide || ctx.store.getRevision(key)) return
  const s = schedule(null, 2, solvedAt, ctx.essential.has(guide.no))
  // Old solves surface as due now rather than piling up as "overdue by months".
  ctx.store.setRevision({ key, ...s, dueAt: Math.max(s.dueAt, Date.now() - DAY_MS) })
}

const SYNCERS: Record<Platform, Syncer> = {
  async leetcode(ctx, username, session) {
    const { store, guideBySlug } = ctx
    const state = store.getSyncState('leetcode')
    const profile = await lc.fetchProfile(username)
    store.setSyncState('leetcode', { rating: profile.rating, maxRating: Math.max(0, ...profile.history.map((h) => h.rating)) || null })
    store.setRatingHistory('leetcode', profile.history)

    let added = 0
    const firstSync = state.lastSync == null

    const record = async (s: lc.LcSolved, source: 'sync' | 'import', solvedAt: number): Promise<void> => {
      const key = `lc:${s.slug}`
      const g = guideBySlug.get(s.slug)
      let difficulty = s.difficulty ?? g?.difficulty ?? null
      let topic = g?.topic ?? (s.tags ? topicForTags(s.tags) : null)
      if (!g && !store.getProblem(key) && (!difficulty || !topic)) {
        const meta = await lc.fetchQuestionMeta(s.slug).catch(() => null)
        difficulty ??= meta?.difficulty ?? null
        topic ??= meta ? topicForTags(meta.tags) : null
      }
      store.upsertProblem({
        key, platform: 'leetcode', title: s.title, url: `https://leetcode.com/problems/${s.slug}/`,
        difficulty, topic, guideNo: g?.no ?? null
      })
      if (store.addSolve(key, { solvedAt, source, confidence: null, timeTakenMin: null })) {
        added++
        if (source === 'sync') scheduleSheetRevision(ctx, key, solvedAt, g)
      }
    }

    if (session) {
      // Full history has no timestamps: the first import is undated; later new ones are dated "now".
      for (const s of await lc.fetchAllSolved(session)) await record(s, firstSync ? 'import' : 'sync', Date.now())
    }
    for (const s of await lc.fetchRecentAc(username)) await record(s, 'sync', s.solvedAt!)
    return added
  },

  async codeforces(ctx, handle) {
    const { store } = ctx
    const state = store.getSyncState('codeforces')
    const user = await cf.fetchUser(handle)
    const history = await cf.fetchRatingHistory(handle)
    store.setSyncState('codeforces', { rating: user.rating, maxRating: user.maxRating })
    store.setRatingHistory('codeforces', history)

    const solved = await cf.fetchSolved(handle, state.cursor)
    let added = 0
    store.transaction(() => {
      for (const s of solved) {
        store.upsertProblem({ key: s.key, platform: 'codeforces', title: s.title, url: s.url, rating: s.rating, topic: s.topic, difficulty: cfDifficulty(s.rating) })
        if (store.addSolve(s.key, { solvedAt: s.solvedAt, source: 'sync', confidence: null, timeTakenMin: null })) added++
      }
    })
    const newest = Math.max(state.cursor ?? 0, ...solved.map((s) => Math.floor(s.solvedAt / 1000)))
    store.setSyncState('codeforces', { cursor: newest || null })
    return added
  },

  async atcoder(ctx, user) {
    const { store } = ctx
    const state = store.getSyncState('atcoder')
    const { titles, difficulty } = await atcoderMeta(store)
    const history = await ac.fetchRatingHistory(user)
    store.setRatingHistory('atcoder', history)
    store.setSyncState('atcoder', {
      rating: history.at(-1)?.rating ?? null,
      maxRating: history.length ? Math.max(...history.map((h) => h.rating)) : null
    })

    const { solved, lastSec } = await ac.fetchSolved(user, state.cursor ?? 0, titles, difficulty)
    let added = 0
    store.transaction(() => {
      for (const s of solved) {
        store.upsertProblem({ key: s.key, platform: 'atcoder', title: s.title, url: s.url, rating: s.rating, difficulty: cfDifficulty(s.rating) })
        if (store.addSolve(s.key, { solvedAt: s.solvedAt, source: 'sync', confidence: null, timeTakenMin: null })) added++
      }
    })
    store.setSyncState('atcoder', { cursor: lastSec + 1 })
    return added
  },

  async gfg(ctx, handle) {
    const { store } = ctx
    const firstSync = store.getSyncState('gfg').lastSync == null
    const solved = await gfg.fetchSolved(handle)
    let added = 0
    const now = Date.now()
    store.transaction(() => {
      for (const s of solved) {
        store.upsertProblem({ key: s.key, platform: 'gfg', title: s.title, url: s.url, difficulty: s.difficulty })
        if (store.addSolve(s.key, { solvedAt: now, source: firstSync ? 'import' : 'sync', confidence: null, timeTakenMin: null })) added++
      }
    })
    return added
  }
}

/** Rough Easy/Medium/Hard band for rated problems so cross-platform stats line up. */
export function cfDifficulty(rating: number | null | undefined): string | null {
  if (rating == null) return null
  return rating < 1300 ? 'Easy' : rating < 1900 ? 'Medium' : 'Hard'
}

export async function atcoderMeta(store: Store): Promise<{ titles: Map<string, string>; difficulty: Map<string, number>; contest: Map<string, string> }> {
  type Meta = { titles: [string, string][]; difficulty: [string, number][]; contest: [string, string][] }
  let meta = store.cacheGet<Meta>('atcoder-meta', 7 * DAY_MS)
  if (!meta) {
    const [problems, models] = await Promise.all([ac.fetchProblems(), ac.fetchDifficulties()])
    meta = {
      titles: problems.map((p) => [p.id, p.title]),
      contest: problems.map((p) => [p.id, p.contest_id]),
      difficulty: Object.entries(models)
        .filter(([, m]) => m.difficulty != null)
        .map(([id, m]) => [id, m.difficulty!])
    }
    store.cacheSet('atcoder-meta', meta)
  }
  return { titles: new Map(meta.titles), difficulty: new Map(meta.difficulty), contest: new Map(meta.contest) }
}
