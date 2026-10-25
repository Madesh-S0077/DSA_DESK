import { describe, expect, it } from 'vitest'
import type { ProblemRef } from '@shared/types'
import { buildPrompt, friendlyError } from './ai'
import { HttpError } from './sync/http'
import { htmlToText } from './sync/leetcode'

const twoSum: ProblemRef = { key: 'lc:two-sum', platform: 'leetcode', title: 'Two Sum', url: 'https://leetcode.com/problems/two-sum/', difficulty: 'Easy', topic: 'Arrays & Hashing' }
const details = { pattern: 'Hash map complement lookup', approach: 'Store seen values in a map' }

describe('buildPrompt', () => {
  it('always forbids code and names the problem', () => {
    for (const kind of ['explain', 'hint', 'approach'] as const) {
      const { system, user } = buildPrompt(kind, { problem: twoSum })
      expect(system).toMatch(/never write code/i)
      expect(user).toContain('Problem: Two Sum')
      expect(user).toContain('Platform: LeetCode')
    }
  })
  it('only shares the guide notes with the approach', () => {
    expect(buildPrompt('approach', { problem: twoSum, details }).user).toContain('Hash map complement lookup')
    expect(buildPrompt('hint', { problem: twoSum, details }).user).not.toContain('Hash map complement lookup')
    expect(buildPrompt('explain', { problem: twoSum, details }).user).not.toContain('Store seen values')
  })
  it('includes and truncates the statement', () => {
    const user = buildPrompt('explain', { problem: twoSum, statement: 'x'.repeat(10_000) }).user
    expect(user).toContain('Statement:')
    expect(user).toContain('[…truncated]')
    expect(user.length).toBeLessThan(8000)
  })
  it('skips missing metadata', () => {
    const cf: ProblemRef = { key: 'cf:1520A', platform: 'codeforces', title: 'Do Not Be Distracted!', url: 'https://codeforces.com/problemset/problem/1520/A', rating: 800 }
    const { user } = buildPrompt('hint', { problem: cf })
    expect(user).toContain('Rating: 800')
    expect(user).not.toContain('Difficulty:')
    expect(user).not.toContain('Statement:')
  })
})

describe('friendlyError', () => {
  it('maps Gemini statuses to readable messages', () => {
    expect(friendlyError(new HttpError('x', 400), 'm')).toMatch(/key/)
    expect(friendlyError(new HttpError('x', 404), 'gemini-x')).toContain('gemini-x')
    expect(friendlyError(new HttpError('x', 429), 'm')).toMatch(/limit/)
    expect(friendlyError(new TypeError('fetch failed'), 'm')).toMatch(/internet/)
  })
})

describe('htmlToText', () => {
  it('turns LeetCode statement HTML into readable text', () => {
    const html = '<p>Given <code>nums</code> &amp; <code>target</code>.</p><ul><li>2 &lt;= n &lt;= 10<sup>4</sup></li></ul>'
    expect(htmlToText(html)).toBe('Given nums & target.\n- 2 <= n <= 10^4')
  })
})
