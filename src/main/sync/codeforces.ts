import { getJson, throttle } from './http'
import { topicForTags } from './topics'

const API = 'https://codeforces.com/api'
const gate = throttle(2100)

interface CfResponse<T> {
  status: 'OK' | 'FAILED'
  comment?: string
  result: T
}

async function call<T>(method: string, params: Record<string, string | number>): Promise<T> {
  await gate()
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
  let res: CfResponse<T>
  try {
    res = await getJson<CfResponse<T>>(`${API}/${method}?${qs}`, {}, 60_000)
  } catch (e) {
    // Codeforces returns 400 with a JSON comment for unknown handles; surface something readable.
    throw new Error(`Codeforces ${method}: ${(e as Error).message}`)
  }
  if (res.status !== 'OK') throw new Error(`Codeforces: ${res.comment ?? 'request failed'}`)
  return res.result
}

export interface CfProblem {
  contestId?: number
  problemsetName?: string
  index: string
  name: string
  rating?: number
  tags: string[]
}

export interface CfSolved {
  key: string
  title: string
  url: string
  rating: number | null
  topic: string | null
  solvedAt: number
}

export function cfKey(p: CfProblem): string {
  return `cf:${p.contestId ?? p.problemsetName}${p.index}`
}

export function cfUrl(p: CfProblem): string {
  if (!p.contestId) return `https://codeforces.com/problemsets/${p.problemsetName}/problem/99999/${p.index}`
  return p.contestId >= 100000
    ? `https://codeforces.com/gym/${p.contestId}/problem/${p.index}`
    : `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`
}

export async function fetchUser(handle: string): Promise<{ rating: number | null; maxRating: number | null }> {
  const [u] = await call<{ rating?: number; maxRating?: number }[]>('user.info', { handles: handle })
  return { rating: u.rating ?? null, maxRating: u.maxRating ?? null }
}

export async function fetchRatingHistory(handle: string): Promise<{ t: number; rating: number }[]> {
  const r = await call<{ ratingUpdateTimeSeconds: number; newRating: number }[]>('user.rating', { handle })
  return r.map((x) => ({ t: x.ratingUpdateTimeSeconds * 1000, rating: x.newRating }))
}

/**
 * Accepted submissions newer than `sinceSec` (all of them when null). Submissions come newest-first,
 * so incremental syncs page until they reach already-seen ones.
 */
export async function fetchSolved(handle: string, sinceSec: number | null): Promise<CfSolved[]> {
  const out = new Map<string, CfSolved>()
  const pageSize = sinceSec == null ? 10_000 : 200
  for (let from = 1; ; from += pageSize) {
    const subs = await call<{ creationTimeSeconds: number; verdict?: string; problem: CfProblem }[]>('user.status', {
      handle,
      from,
      count: pageSize
    })
    let reachedSeen = false
    for (const s of subs) {
      if (sinceSec != null && s.creationTimeSeconds <= sinceSec) {
        reachedSeen = true
        continue
      }
      if (s.verdict !== 'OK') continue
      const key = cfKey(s.problem)
      const prev = out.get(key)
      const solvedAt = s.creationTimeSeconds * 1000
      if (!prev || solvedAt < prev.solvedAt) {
        out.set(key, {
          key,
          title: `${s.problem.contestId ?? ''}${s.problem.index}. ${s.problem.name}`,
          url: cfUrl(s.problem),
          rating: s.problem.rating ?? null,
          topic: topicForTags(s.problem.tags),
          solvedAt
        })
      }
    }
    if (reachedSeen || subs.length < pageSize) break
  }
  return [...out.values()]
}

export async function fetchProblemset(): Promise<CfProblem[]> {
  const r = await call<{ problems: CfProblem[] }>('problemset.problems', {})
  return r.problems
}
