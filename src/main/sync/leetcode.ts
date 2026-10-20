import { getJson } from './http'
import { topicForTags } from './topics'
import type { ExternalPick } from '@shared/types'

const ENDPOINT = 'https://leetcode.com/graphql'

interface GqlResponse<T> {
  data?: T
  errors?: { message: string }[]
}

async function gql<T>(query: string, variables: Record<string, unknown> = {}, session = ''): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Referer: 'https://leetcode.com/'
  }
  if (session) {
    // LeetCode accepts any matching csrftoken cookie/header pair alongside the session.
    headers.Cookie = `LEETCODE_SESSION=${session}; csrftoken=dsadesk`
    headers['x-csrftoken'] = 'dsadesk'
  }
  const res = await getJson<GqlResponse<T>>(ENDPOINT, { method: 'POST', headers, body: JSON.stringify({ query, variables }) })
  if (res.errors?.length) throw new Error(`LeetCode: ${res.errors[0].message}`)
  if (!res.data) throw new Error('LeetCode: empty response')
  return res.data
}

export interface LcSolved {
  slug: string
  title: string
  difficulty?: string
  tags?: string[]
  /** Unix ms, when known. */
  solvedAt?: number
}

export async function fetchDaily(): Promise<ExternalPick> {
  const d = await gql<{
    activeDailyCodingChallengeQuestion: {
      date: string
      link: string
      question: { title: string; titleSlug: string; difficulty: string; topicTags: { slug: string; name: string }[] }
    }
  }>(`query { activeDailyCodingChallengeQuestion { date link question { title titleSlug difficulty topicTags { slug name } } } }`)
  const q = d.activeDailyCodingChallengeQuestion
  const tags = q.question.topicTags.map((t) => t.slug)
  return {
    key: `lc:${q.question.titleSlug}`,
    platform: 'leetcode',
    title: q.question.title,
    url: `https://leetcode.com${q.link}`,
    difficulty: q.question.difficulty,
    topic: topicForTags(tags),
    tags: q.question.topicTags.map((t) => t.name),
    date: q.date
  }
}

export async function fetchProfile(username: string): Promise<{ solved: number; rating: number | null; history: { t: number; rating: number }[] }> {
  const d = await gql<{
    matchedUser: { submitStatsGlobal: { acSubmissionNum: { difficulty: string; count: number }[] } } | null
    userContestRanking: { rating: number } | null
    userContestRankingHistory: { attended: boolean; rating: number; contest: { startTime: number } }[] | null
  }>(
    `query p($username: String!) {
      matchedUser(username: $username) { submitStatsGlobal { acSubmissionNum { difficulty count } } }
      userContestRanking(username: $username) { rating }
      userContestRankingHistory(username: $username) { attended rating contest { startTime } }
    }`,
    { username }
  )
  if (!d.matchedUser) throw new Error(`LeetCode user "${username}" not found`)
  const all = d.matchedUser.submitStatsGlobal.acSubmissionNum.find((x) => x.difficulty === 'All')
  return {
    solved: all?.count ?? 0,
    rating: d.userContestRanking ? Math.round(d.userContestRanking.rating) : null,
    history: (d.userContestRankingHistory ?? [])
      .filter((h) => h.attended)
      .map((h) => ({ t: h.contest.startTime * 1000, rating: Math.round(h.rating) }))
  }
}

/** Public endpoint: only the ~20 most recent accepted submissions, but with timestamps. */
export async function fetchRecentAc(username: string): Promise<LcSolved[]> {
  const d = await gql<{ recentAcSubmissionList: { title: string; titleSlug: string; timestamp: string }[] | null }>(
    `query r($username: String!, $limit: Int!) { recentAcSubmissionList(username: $username, limit: $limit) { title titleSlug timestamp } }`,
    { username, limit: 20 }
  )
  return (d.recentAcSubmissionList ?? []).map((s) => ({ slug: s.titleSlug, title: s.title, solvedAt: Number(s.timestamp) * 1000 }))
}

/** With a session cookie: every problem the account has accepted (no timestamps). */
export async function fetchAllSolved(session: string): Promise<LcSolved[]> {
  const out: LcSolved[] = []
  const limit = 100
  for (let skip = 0; ; skip += limit) {
    const d = await gql<{
      problemsetQuestionList: {
        total: number
        questions: { titleSlug: string; title: string; difficulty: string; status: string | null; topicTags: { slug: string }[] }[]
      }
    }>(
      `query l($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
        problemsetQuestionList: questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
          total: totalNum
          questions: data { titleSlug title difficulty status topicTags { slug } }
        }
      }`,
      { categorySlug: '', limit, skip, filters: { status: 'AC' } },
      session
    )
    const page = d.problemsetQuestionList
    for (const q of page.questions) {
      if (q.status === 'ac') out.push({ slug: q.titleSlug, title: q.title, difficulty: q.difficulty, tags: q.topicTags.map((t) => t.slug) })
    }
    if (skip + limit >= page.total || page.questions.length === 0) break
  }
  return out
}

export async function fetchQuestionMeta(slug: string): Promise<{ difficulty: string; tags: string[] } | null> {
  const d = await gql<{ question: { difficulty: string; topicTags: { slug: string }[] } | null }>(
    `query q($titleSlug: String!) { question(titleSlug: $titleSlug) { difficulty topicTags { slug } } }`,
    { titleSlug: slug }
  )
  return d.question ? { difficulty: d.question.difficulty, tags: d.question.topicTags.map((t) => t.slug) } : null
}
