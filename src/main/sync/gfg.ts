// GeeksforGeeks has no official API. These are the endpoints its own website calls; they may change.
import { getJson } from './http'
import { topicForTags } from './topics'
import type { Contest, ExternalPick } from '@shared/types'

export async function fetchPotd(): Promise<ExternalPick> {
  const p = await getJson<{
    problem_name: string
    problem_url: string
    difficulty: string
    date: string
    tags?: { topic_tags?: string[] }
  }>('https://practiceapi.geeksforgeeks.org/api/vr/problems-of-day/problem/today/')
  // https://www.geeksforgeeks.org/problems/<slug>/1
  const slug = p.problem_url.match(/\/problems\/([^/]+)/)?.[1] ?? p.problem_name
  const tags = p.tags?.topic_tags ?? []
  return {
    key: `gfg:${slug}`,
    platform: 'gfg',
    title: p.problem_name,
    url: p.problem_url,
    difficulty: p.difficulty,
    topic: topicForTags(tags.map((t) => t.toLowerCase().replace(/\s+/g, '-'))),
    tags,
    date: p.date?.slice(0, 10)
  }
}

export interface GfgSolved {
  key: string
  title: string
  url: string
  difficulty: string
}

/** Every problem the user has solved (no timestamps). */
export async function fetchSolved(handle: string): Promise<GfgSolved[]> {
  const r = await getJson<{
    status: string
    message?: string
    result: Record<string, Record<string, { pname: string; slug: string; lang?: string }>>
  }>('https://practiceapi.geeksforgeeks.org/api/v1/user/problems/submissions/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle, requestType: '', year: '', month: '' })
  })
  if (r.status !== 'success') throw new Error(`GeeksforGeeks: ${r.message ?? 'user not found'}`)
  const out: GfgSolved[] = []
  for (const [difficulty, problems] of Object.entries(r.result ?? {})) {
    for (const p of Object.values(problems)) {
      out.push({
        key: `gfg:${p.slug}`,
        title: p.pname,
        url: `https://www.geeksforgeeks.org/problems/${p.slug}/1`,
        difficulty: difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase()
      })
    }
  }
  return out
}

interface GfgEvent {
  slug: string
  name: string
  start_time: string
  end_time: string
}

/** GFG event times are India local time without an offset. */
const ist = (t: string): number => Date.parse(`${t}+05:30`)

export function parseEvents(r: { results?: { upcoming?: GfgEvent[] } }): Contest[] {
  return (r.results?.upcoming ?? []).map((e) => ({
    id: `gfg:${e.slug}`,
    platform: 'gfg',
    name: e.name,
    url: `https://www.geeksforgeeks.org/contest/${e.slug}`,
    start: ist(e.start_time),
    durationMin: Math.round((ist(e.end_time) - ist(e.start_time)) / 60_000)
  }))
}

export async function fetchContests(): Promise<Contest[]> {
  return parseEvents(await getJson('https://practiceapi.geeksforgeeks.org/api/vr/events/?page_number=1&sub_type=all&type=contest'))
}
