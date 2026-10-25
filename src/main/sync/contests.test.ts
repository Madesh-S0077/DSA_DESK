import { describe, expect, it } from 'vitest'
import type { Contest } from '@shared/types'
import { contestIcs, googleCalendarUrl } from '@shared/calendar'
import { parseUpcoming } from './atcoder'
import { parseEvents } from './gfg'

// Trimmed from https://atcoder.jp/contests/?lang=en
const ATCODER_HTML = `
<div id="contest-table-action"><table><tbody><tr><td>running</td></tr></tbody></table></div>
<div id="contest-table-upcoming">
  <h3>Upcoming Contests</h3>
  <table class="table"><thead><tr><th>Start Time</th></tr></thead><tbody>
    <tr>
      <td class="text-center"><a href='http://www.timeanddate.com/worldclock/fixedtime.html?iso=20261024T2100&p1=248' target='blank'><time class='fixtime fixtime-full'>2026-10-24 21:00:00+0900</time></a></td>
      <td ><span title="Algorithm">Ⓐ</span><span class="user-blue">◉</span> <a href="/contests/abc481">SMBC Programming Contest #2 (AtCoder Beginner Contest 481）</a></td>
      <td class="text-center">01:40</td>
      <td class="text-center"> - 1999</td>
    </tr>
    <tr>
      <td class="text-center"><time class='fixtime fixtime-full'>2026-10-30 19:00:00+0900</time></td>
      <td ><a href="/contests/ahc074">HACK TO THE FUTURE 2027 &amp; friends</a></td>
      <td class="text-center">240:00</td>
      <td class="text-center">All</td>
    </tr>
  </tbody></table>
</div>
<div id="contest-table-recent"><table><tbody><tr><td class="text-center"><time>2026-10-01 21:00:00+0900</time></td><td><a href="/contests/abc470">old</a></td><td class="text-center">01:40</td></tr></tbody></table></div>`

describe('AtCoder schedule', () => {
  it('reads only the upcoming table, with offsets and long durations', () => {
    const cs = parseUpcoming(ATCODER_HTML)
    expect(cs.map((c) => c.id)).toEqual(['ac:abc481', 'ac:ahc074'])
    expect(cs[0].start).toBe(Date.UTC(2026, 9, 24, 12, 0))
    expect(cs[0].durationMin).toBe(100)
    expect(cs[0].url).toBe('https://atcoder.jp/contests/abc481')
    expect(cs[1].durationMin).toBe(240 * 60)
    expect(cs[1].name).toBe('HACK TO THE FUTURE 2027 & friends')
  })
  it('returns nothing when the page layout changes', () => {
    expect(parseUpcoming('<html></html>')).toEqual([])
  })
})

describe('GFG events', () => {
  it('treats times as India local time', () => {
    const [c] = parseEvents({ results: { upcoming: [{ slug: 'weekly-1', name: 'Weekly 1', start_time: '2026-10-25T19:00:00', end_time: '2026-10-25T20:30:00' }] } })
    expect(c.start).toBe(Date.UTC(2026, 9, 25, 13, 30))
    expect(c.durationMin).toBe(90)
    expect(c.url).toBe('https://www.geeksforgeeks.org/contest/weekly-1')
    expect(parseEvents({})).toEqual([])
  })
})

describe('calendar export', () => {
  const c: Contest = {
    id: 'cf:2278', platform: 'codeforces', name: 'Codeforces Round, Div. 3', url: 'https://codeforces.com/contests/2278',
    start: Date.UTC(2026, 9, 28, 14, 35), durationMin: 135
  }
  it('writes a valid single-event calendar with a reminder', () => {
    const ics = contestIcs(c, Date.UTC(2026, 9, 20))
    expect(ics).toContain('DTSTART:20261028T143500Z')
    expect(ics).toContain('DTEND:20261028T165000Z')
    expect(ics).toContain('SUMMARY:Codeforces Round\\, Div. 3')
    expect(ics).toContain('TRIGGER:-PT30M')
    expect(ics.split('\r\n').filter((l) => l.startsWith('BEGIN:')).length).toBe(3)
  })
  it('builds a Google Calendar link with the same times', () => {
    const u = new URL(googleCalendarUrl(c))
    expect(u.host).toBe('calendar.google.com')
    expect(u.searchParams.get('dates')).toBe('20261028T143500Z/20261028T165000Z')
  })
})
