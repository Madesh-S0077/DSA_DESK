import { getJson, getText, throttle } from './http'
import type { Contest } from '@shared/types'

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

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#039': "'" }
const decode = (s: string): string => s.replace(/&(amp|lt|gt|quot|#0?39);/g, (_, e: string) => ENTITIES[e])

/**
 * AtCoder publishes its schedule only as HTML: rows of the "Upcoming Contests" table carry
 * `<time>2026-10-24 21:00:00+0900</time>`, `<a href="/contests/abc481">name</a>` and a `01:40` duration.
 */
export function parseUpcoming(html: string): Contest[] {
  const at = html.indexOf('id="contest-table-upcoming"')
  if (at < 0) return []
  const table = html.slice(at, html.indexOf('</table>', at))
  const out: Contest[] = []
  for (const row of table.split('<tr>').slice(1)) {
    const time = row.match(/<time[^>]*>(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d)([+-]\d\d)(\d\d)<\/time>/)
    const link = row.match(/<a href="\/contests\/([^"]+)">([^<]+)<\/a>/)
    const dur = row.match(/<td class="text-center">(\d+):(\d\d)<\/td>/)
    if (!time || !link || !dur) continue
    out.push({
      id: `ac:${link[1]}`,
      platform: 'atcoder',
      name: decode(link[2]).trim(),
      url: `https://atcoder.jp/contests/${link[1]}`,
      start: Date.parse(`${time[1]}T${time[2]}${time[3]}:${time[4]}`),
      durationMin: Number(dur[1]) * 60 + Number(dur[2])
    })
  }
  return out
}

export async function fetchContests(): Promise<Contest[]> {
  return parseUpcoming(await getText('https://atcoder.jp/contests/?lang=en'))
}
