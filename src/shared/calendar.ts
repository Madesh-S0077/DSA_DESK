import type { Contest } from './types'
import { PLATFORM_LABEL } from './types'

/** 20261024T120000Z */
const utc = (t: number): string => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

export function googleCalendarUrl(c: Contest): string {
  const qs = new URLSearchParams({
    action: 'TEMPLATE',
    text: c.name,
    dates: `${utc(c.start)}/${utc(c.start + c.durationMin * 60_000)}`,
    details: `${PLATFORM_LABEL[c.platform]} contest\n${c.url}`,
    location: c.url
  })
  return `https://calendar.google.com/calendar/render?${qs}`
}

/** RFC 5545 text escaping. */
const esc = (s: string): string => s.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n')

/** A single-event .ics with a reminder 30 minutes before the start. */
export function contestIcs(c: Contest, now = Date.now()): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DSA Desk//Contests//EN',
    'BEGIN:VEVENT',
    `UID:${c.id}@dsa-desk`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(c.start)}`,
    `DTEND:${utc(c.start + c.durationMin * 60_000)}`,
    `SUMMARY:${esc(c.name)}`,
    `DESCRIPTION:${esc(`${PLATFORM_LABEL[c.platform]} contest\n${c.url}`)}`,
    `URL:${c.url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(c.name)}`,
    'TRIGGER:-PT30M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    ''
  ].join('\r\n')
}
