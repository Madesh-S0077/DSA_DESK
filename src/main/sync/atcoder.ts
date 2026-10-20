import { getJson, throttle } from './http'

const KENKOOOO = 'https://kenkoooo.com/atcoder'
const gate = throttle(1100)

export interface AcProblem {
  id: string
  contest_id: string
  title: string
  name?: string
}

export interface AcSolved {
  key: string
  title: string
  url: string
  solvedAt: number
  rating: number | null
}

export const acUrl = (contestId: string, problemId: string): string =>
  `https://atcoder.jp/contests/${contestId}/tasks/${problemId}`

/** kenkoooo's difficulty model is clipped below 400 in AtCoder Problems' UI; mirror that so ratings stay sane. */
export function clipDifficulty(d: number): number {
  return Math.round(d >= 400 ? d : 400 / Math.exp(1 - d / 400))
}

/** AC submissions since `fromSec` (inclusive), paged 500 at a time as the API returns them. */
export async function fetchSolved(
  user: string,
  fromSec: number,
  titles: Map<string, string>,
  difficulty: Map<string, number>
): Promise<{ solved: AcSolved[]; lastSec: number }> {
  const out = new Map<string, AcSolved>()
  let from = fromSec
  let lastSec = fromSec
  for (;;) {
    await gate()
    const subs = await getJson<{ id: number; epoch_second: number; problem_id: string; contest_id: string; result: string }[]>(
      `${KENKOOOO}/atcoder-api/v3/user/submissions?user=${encodeURIComponent(user)}&from_second=${from}`,
      {},
      60_000
    )
    for (const s of subs) {
      lastSec = Math.max(lastSec, s.epoch_second)
      if (s.result !== 'AC') continue
      const prev = out.get(s.problem_id)
      if (prev && prev.solvedAt <= s.epoch_second * 1000) continue
      const d = difficulty.get(s.problem_id)
      out.set(s.problem_id, {
        key: `ac:${s.problem_id}`,
        title: titles.get(s.problem_id) ?? s.problem_id,
        url: acUrl(s.contest_id, s.problem_id),
        solvedAt: s.epoch_second * 1000,
        rating: d == null ? null : clipDifficulty(d)
      })
    }
    if (subs.length < 500) break
    from = Math.max(...subs.map((s) => s.epoch_second)) + 1
  }
  return { solved: [...out.values()], lastSec }
}

export async function fetchProblems(): Promise<AcProblem[]> {
  await gate()
  return getJson<AcProblem[]>(`${KENKOOOO}/resources/problems.json`, {}, 60_000)
}

export async function fetchDifficulties(): Promise<Record<string, { difficulty?: number }>> {
  await gate()
  return getJson(`${KENKOOOO}/resources/problem-models.json`, {}, 60_000)
}

export async function fetchRatingHistory(user: string): Promise<{ t: number; rating: number }[]> {
  const h = await getJson<{ IsRated: boolean; NewRating: number; EndTime: string }[]>(
    `https://atcoder.jp/users/${encodeURIComponent(user)}/history/json`
  )
  return h.filter((x) => x.IsRated).map((x) => ({ t: Date.parse(x.EndTime), rating: x.NewRating }))
}
