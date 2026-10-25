import type { AiHelpKind, ProblemDetails, ProblemRef } from '@shared/types'
import { PLATFORM_LABEL } from '@shared/types'
import { getJson, HttpError } from './sync/http'

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
/** Long statements are trimmed; the model only needs enough to explain them. */
const STATEMENT_MAX = 6000

export interface AiContext {
  problem: ProblemRef
  /** Plain-text statement when we could fetch it (LeetCode only). */
  statement?: string | null
  /** The guide's notes for this problem, when it is in the sheet. */
  details?: ProblemDetails | null
}

const SYSTEM = `You are a patient DSA tutor helping a student prepare for coding interviews and placements.
Write in plain text: short paragraphs or "- " bullets, no markdown headers, no bold, no tables.
Never write code or pseudocode in any language.
If you are not sure which problem this is and no statement is given, say so briefly instead of guessing.`

const TASK: Record<AiHelpKind, string> = {
  explain: `Explain what this problem is asking, in simple words.
- Restate the task and what the input and output are.
- Walk through one small example step by step.
- Point out which constraints or edge cases matter.
Do NOT hint at the technique, pattern or algorithm that solves it.`,
  hint: `Give ONE minimal hint: one or two sentences that point the student at the key observation.
Do not name the algorithm or data structure if you can avoid it, and do not describe the full approach.`,
  approach: `Explain how to solve it.
- The core idea and why it works.
- The steps of the approach, in order (in words, no code).
- Time and space complexity.
- Edge cases and common mistakes.`
}

export function buildPrompt(kind: AiHelpKind, ctx: AiContext): { system: string; user: string } {
  const { problem: p, statement, details } = ctx
  const meta = [
    `Problem: ${p.title}`,
    `Platform: ${PLATFORM_LABEL[p.platform]}`,
    `Link: ${p.url}`,
    p.difficulty && `Difficulty: ${p.difficulty}`,
    p.rating && `Rating: ${p.rating}`,
    p.topic && `Topic: ${p.topic}`
  ]
  // The guide's notes give the answer away, so only the approach gets them.
  const notes =
    kind === 'approach' && details
      ? [
          details.pattern && `Pattern: ${details.pattern}`,
          details.concept && `Key concept: ${details.concept}`,
          details.approach && `Reference approach: ${details.approach}`,
          details.insight && `Insight: ${details.insight}`
        ]
      : []
  const text = statement
    ? `\nStatement:\n${statement.length > STATEMENT_MAX ? `${statement.slice(0, STATEMENT_MAX)}\n[…truncated]` : statement}`
    : ''
  const reference = notes.some(Boolean) ? `\nStudy-guide notes (use them, but explain in your own words):\n${notes.filter(Boolean).join('\n')}` : ''
  return { system: SYSTEM, user: `${meta.filter(Boolean).join('\n')}${text}${reference}\n\nTask:\n${TASK[kind]}` }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
}

export async function callGemini(key: string, model: string, prompt: { system: string; user: string }): Promise<string> {
  let res: GeminiResponse
  try {
    res = await getJson<GeminiResponse>(
      `${ENDPOINT}/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompt.system }] },
          contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
          generationConfig: { temperature: 0.4 }
        })
      },
      60_000
    )
  } catch (e) {
    throw new Error(friendlyError(e, model))
  }
  const text = res.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? '').join('').trim()
  if (text) return text
  if (res.promptFeedback?.blockReason) throw new Error(`Gemini declined to answer (${res.promptFeedback.blockReason}).`)
  throw new Error('Gemini returned an empty answer. Try again.')
}

export function friendlyError(e: unknown, model: string): string {
  if (e instanceof HttpError) {
    if (e.status === 400 || e.status === 401 || e.status === 403) return 'Gemini rejected the key. Check it in Settings → AI help.'
    if (e.status === 404) return `Gemini has no model called “${model}”. Change it in Settings → AI help.`
    if (e.status === 429) return 'Free-tier limit reached. Wait a minute and try again.'
    if (e.status >= 500) return 'Gemini is having trouble right now. Try again shortly.'
  }
  return 'Couldn’t reach Gemini. Check your internet connection.'
}
