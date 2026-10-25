import { motion } from 'framer-motion'
import { ArrowRight, BellRing, CalendarPlus, ExternalLink, Flag, RefreshCw, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Contest, Platform } from '@shared/types'
import { PLATFORMS, PLATFORM_LABEL } from '@shared/types'
import { Button, Card, CardTitle, Empty, PageHeader, Pill, Segmented, Skeleton, Toggle, cx } from '../components/ui'
import { useApp, useData } from '../lib/store'
import { timeAgo } from '../lib/problem'
import { PLATFORM_TINT, clock, dayLabel, duration, endOf, isLive, relative, timeOf, useNow } from '../lib/contests'

export function Contests(): ReactNode {
  const settings = useApp((s) => s.settings)!
  const setSettings = useApp((s) => s.setSettings)
  // A refresh click forces one network fetch; later refetches (after data changes) use the cache.
  const forceNext = useRef(false)
  const [refreshes, setRefreshes] = useState(0)
  const { data, loading } = useData(() => {
    const force = forceNext.current
    forceNext.current = false
    return window.api.getContests(force)
  }, [refreshes])
  const now = useNow(1000)

  const followed = new Set(settings.contestPlatforms)
  const toggleFollow = (p: Platform): void => {
    const next = followed.has(p) ? settings.contestPlatforms.filter((x) => x !== p) : PLATFORMS.filter((x) => x === p || followed.has(x))
    void setSettings({ contestPlatforms: next })
  }

  const contests = (data?.contests ?? []).filter((c) => endOf(c) > now)
  const [next, ...rest] = contests
  const days = new Map<string, Contest[]>()
  for (const c of rest) {
    const label = dayLabel(c.start, now)
    days.set(label, [...(days.get(label) ?? []), c])
  }
  const errors = Object.keys(data?.errors ?? {}).filter((p) => followed.has(p as Platform)) as Platform[]

  return (
    <div>
      <PageHeader
        title="Contests"
        subtitle="Rated rounds coming up across your platforms. Showing up regularly is practice too."
        action={
          <div className="flex items-center gap-3">
            {data?.fetchedAt && <span className="text-[12px] text-muted">updated {timeAgo(data.fetchedAt)}</span>}
            <Button size="sm" variant="ghost" disabled={loading} onClick={() => {
                forceNext.current = true
                setRefreshes((n) => n + 1)
              }}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[13px] text-muted">Following</span>
        {PLATFORMS.map((p) => (
          <button
            key={p}
            onClick={() => toggleFollow(p)}
            aria-pressed={followed.has(p)}
            className={cx(
              'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition',
              followed.has(p) ? 'border-transparent bg-card text-ink shadow-soft' : 'border-line text-muted hover:text-ink-soft'
            )}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: followed.has(p) ? PLATFORM_TINT[p].dot : 'var(--line)' }} />
            {PLATFORM_LABEL[p]}
          </button>
        ))}
      </div>

      {errors.length > 0 && (
        <p className="mb-4 flex items-center gap-1.5 text-[13px] text-peach-deep">
          <TriangleAlert size={14} /> Couldn’t reach {errors.map((p) => PLATFORM_LABEL[p]).join(', ')}. Showing the last schedule we saw.
        </p>
      )}

      {!data ? (
        <Skeleton className="h-64" />
      ) : !next ? (
        <Card>
          <Empty icon="🏁" title={followed.size ? 'No contests in the next three weeks' : 'Follow a platform to see its contests'}>
            {followed.size ? 'Check back soon. Schedules usually appear a week or two ahead.' : 'Tap a platform above.'}
          </Empty>
        </Card>
      ) : (
        <>
          <NextUp contest={next} now={now} />
          {days.size > 0 && (
            <Card className="mt-6" delay={0.08}>
              <CardTitle icon={<Flag size={18} />}>Coming up</CardTitle>
              <div className="space-y-6">
                {[...days].map(([label, cs]) => (
                  <div key={label}>
                    <div className="mb-2 font-serif text-[15px] font-semibold text-ink-soft">{label}</div>
                    <div className="divide-y divide-line/70">
                      {cs.map((c) => (
                        <ContestRow key={c.id} contest={c} now={now} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      <Card className="mt-6" delay={0.12}>
        <CardTitle icon={<BellRing size={18} />}>Reminders</CardTitle>
        <div className="flex flex-wrap items-center justify-between gap-5">
          <Toggle
            label="Remind me before contests"
            hint="A notification for followed platforms, even when DSA Desk is in the tray."
            checked={settings.contestReminders}
            onChange={(contestReminders) => void setSettings({ contestReminders })}
          />
          <div className={cx('flex items-center gap-3 transition', !settings.contestReminders && 'pointer-events-none opacity-50')}>
            <span className="text-[13px] text-muted">Heads-up</span>
            <Segmented
              value={settings.contestLeadMin}
              onChange={(contestLeadMin) => void setSettings({ contestLeadMin })}
              options={[15, 30, 60].map((m) => ({ value: m, label: `${m} min` }))}
            />
          </div>
        </div>
      </Card>
    </div>
  )
}

function NextUp({ contest: c, now }: { contest: Contest; now: number }): ReactNode {
  const live = isLive(c, now)
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[28px] border border-line bg-card p-8 shadow-soft"
    >
      <div className="pointer-events-none absolute -top-20 -right-12 h-64 w-64 rounded-full opacity-25" style={{ background: PLATFORM_TINT[c.platform].dot }} />
      <div className="pointer-events-none absolute -right-8 -bottom-28 h-52 w-52 rounded-full bg-sage-soft opacity-60" />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-medium text-sage-deep">
            <Flag size={16} /> {live ? 'Live now' : 'Next up'}
            <Pill className={PLATFORM_TINT[c.platform].pill}>{PLATFORM_LABEL[c.platform]}</Pill>
          </div>
          <h2 className="mt-3 max-w-2xl font-serif text-[32px] leading-tight font-semibold">{c.name}</h2>
          <p className="mt-2 text-[15px] text-ink-soft">
            {dayLabel(c.start, now)} · {timeOf(c.start)} – {timeOf(endOf(c))} <span className="text-muted">({duration(c.durationMin)})</span>
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => void window.api.openExternal(c.url)}>
              <ExternalLink size={15} /> {live ? 'Enter contest' : 'Open & register'}
            </Button>
            <CalendarMenu contest={c} />
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12px] font-medium tracking-wide text-muted uppercase">{live ? 'Ends in' : 'Starts in'}</div>
          <div className="mt-1 font-mono text-[40px] leading-none font-medium tabular-nums">{clock((live ? endOf(c) : c.start) - now)}</div>
        </div>
      </div>
    </motion.section>
  )
}

function ContestRow({ contest: c, now }: { contest: Contest; now: number }): ReactNode {
  return (
    <div className="group flex items-center gap-4 py-3">
      <span className="w-[72px] shrink-0 font-mono text-[13px] text-ink-soft tabular-nums">{timeOf(c.start)}</span>
      <Pill className={cx('w-[118px] shrink-0 justify-center', PLATFORM_TINT[c.platform].pill)}>{PLATFORM_LABEL[c.platform]}</Pill>
      <button onClick={() => void window.api.openExternal(c.url)} className="min-w-0 cursor-pointer truncate text-left font-medium hover:text-sage-deep" title={c.name}>
        {c.name}
      </button>
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <span className="text-[12px] text-muted">{duration(c.durationMin)}</span>
        <span className="w-[76px] text-right text-[12px] text-ink-soft tabular-nums">{isLive(c, now) ? 'live' : relative(c.start - now)}</span>
        <div className="opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
          <CalendarMenu contest={c} compact />
        </div>
      </div>
    </div>
  )
}

/** "Add to calendar" with a choice of the Windows calendar app (.ics) or Google Calendar. */
function CalendarMenu({ contest, compact = false }: { contest: Contest; compact?: boolean }): ReactNode {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  const add = (target: 'app' | 'google'): void => {
    setOpen(false)
    window.api.addToCalendar(contest, target).catch((e: Error) => setError(e.message))
  }
  return (
    <div ref={ref} className="relative">
      <Button size={compact ? 'sm' : 'md'} variant={compact ? 'ghost' : 'soft'} title="Add to calendar" onClick={() => setOpen(!open)}>
        <CalendarPlus size={15} /> {!compact && 'Add to calendar'}
      </Button>
      {open && (
        <div className="absolute top-full right-0 z-20 mt-1.5 w-52 rounded-2xl border border-line bg-card p-1.5 shadow-soft">
          <MenuItem onClick={() => add('app')}>Calendar app (.ics)</MenuItem>
          <MenuItem onClick={() => add('google')}>Google Calendar</MenuItem>
        </div>
      )}
      {error && <p className="absolute top-full right-0 mt-1 w-56 text-right text-[11px] text-peach-deep">{error}</p>}
    </div>
  )
}

function MenuItem({ children, onClick }: { children: ReactNode; onClick: () => void }): ReactNode {
  return (
    <button onClick={onClick} className="block w-full cursor-pointer rounded-xl px-3 py-2 text-left text-[13px] text-ink-soft hover:bg-bg-deep">
      {children}
    </button>
  )
}

/** A slim heads-up on Today when a followed contest is live or starts within a day. */
export function ContestBanner(): ReactNode {
  const { data } = useData(() => window.api.getContests())
  const navigate = useNavigate()
  const now = useNow(30_000)
  const c = data?.contests.find((x) => endOf(x) > now && x.start - now < 24 * 60 * 60_000)
  if (!c) return null
  const live = isLive(c, now)
  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate('/contests')}
      className="mt-5 flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-line bg-card px-5 py-3.5 text-left shadow-soft transition hover:border-sage"
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PLATFORM_TINT[c.platform].dot }} />
      <span className="text-[14px]">
        🏁 <span className="font-medium">{c.name}</span>
        <span className="text-muted"> · {PLATFORM_LABEL[c.platform]} · </span>
        {live ? <span className="text-sage-deep">live now</span> : <>starts {relative(c.start - now)} at {timeOf(c.start)}</>}
      </span>
      <ArrowRight size={15} className="ml-auto text-muted" />
    </motion.button>
  )
}
