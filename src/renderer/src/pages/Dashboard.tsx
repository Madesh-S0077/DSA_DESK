import { motion } from 'framer-motion'
import { ArrowRight, CalendarDays, Flame, Mountain, Target } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { PLATFORM_LABEL } from '@shared/types'
import { Bar, Button, Card, CardTitle, ProgressRing, Skeleton } from '../components/ui'
import { Heatmap } from '../components/Heatmap'
import { StreakPlant } from '../components/StreakPlant'
import { useApp, useData } from '../lib/store'
import { plural, timeAgo } from '../lib/problem'

function greeting(name: string): { hello: string; vibe: string } {
  const h = new Date().getHours()
  const who = name ? `, ${name}` : ''
  if (h < 5) return { hello: `Burning the midnight oil${who}?`, vibe: '🌙 Quiet hours are great for deep work. Don’t forget to sleep.' }
  if (h < 12) return { hello: `Good morning${who}`, vibe: '☀️ A fresh mind is the best debugger.' }
  if (h < 17) return { hello: `Good afternoon${who}`, vibe: '🍵 Tea, one problem, then a stretch.' }
  return { hello: `Good evening${who}`, vibe: '☕ Focus time. One more pattern before the day ends.' }
}

export function Dashboard(): ReactNode {
  const { data, loading } = useData(() => window.api.getDashboard())
  const settings = useApp((s) => s.settings)
  const guide = useApp((s) => s.guide)
  const navigate = useNavigate()
  const { hello, vibe } = greeting(settings?.name ?? '')

  // A pattern "core idea" from the guide as the thought of the day.
  const thought = useMemo(() => {
    if (!guide) return null
    const day = Math.floor(Date.now() / 86_400_000)
    const t = guide.topics[day % guide.topics.length]
    return { topic: t.name, text: t.card.core }
  }, [guide])

  if (loading && !data) return <DashboardSkeleton />
  if (!data) return null
  const goalDone = data.solvedToday >= data.dailyGoal

  return (
    <div>
      <header className="mb-8 flex items-end justify-between gap-6">
        <div>
          <motion.h1 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="font-serif text-[34px] leading-tight font-semibold tracking-tight">
            {hello}
          </motion.h1>
          <p className="mt-1.5 text-[15px] text-muted">{vibe}</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/today')}>
          Today’s problems <ArrowRight size={16} />
        </Button>
      </header>

      <div className="grid grid-cols-3 gap-5">
        <Card delay={0.02} className="flex items-center gap-4">
          <StreakPlant streak={data.streak} doneToday={data.solvedToday > 0} size={112} />
          <div>
            <div className="flex items-center gap-1.5 text-[13px] text-muted">
              <Flame size={14} className="text-peach-deep" /> Streak
            </div>
            <div className="font-serif text-[40px] leading-none font-semibold">
              {data.streak}
              <span className="ml-1 text-[16px] font-normal text-muted">{data.streak === 1 ? 'day' : 'days'}</span>
            </div>
            <div className="mt-2 text-[12px] text-muted">
              {data.solvedToday === 0 && data.streak > 0 ? 'Water it today to keep it growing' : `Longest: ${plural(data.longestStreak, 'day')}`}
            </div>
          </div>
        </Card>

        <Card delay={0.06} className="flex items-center gap-5">
          <ProgressRing value={data.solvedToday} max={data.dailyGoal} size={112} color={goalDone ? 'var(--sage)' : 'var(--butter)'}>
            <div>
              <div className="font-serif text-[28px] leading-none font-semibold">
                {data.solvedToday}
                <span className="text-[15px] text-muted">/{data.dailyGoal}</span>
              </div>
              <div className="mt-1 text-[11px] text-muted">today</div>
            </div>
          </ProgressRing>
          <div>
            <div className="flex items-center gap-1.5 text-[13px] text-muted">
              <Target size={14} className="text-sage-deep" /> Daily goal
            </div>
            <div className="mt-1 font-serif text-[18px] leading-snug">
              {goalDone ? 'Done for today 🌿' : `${plural(data.dailyGoal - data.solvedToday, 'problem')} to go`}
            </div>
            <div className="mt-1 text-[12px] text-muted">{data.totalSolved} solved all-time</div>
          </div>
        </Card>

        <Card delay={0.1} className="flex items-center gap-5">
          <ProgressRing value={data.trackDone} max={data.trackTotal} size={112} color="var(--lavender)">
            <div>
              <div className="font-serif text-[24px] leading-none font-semibold">{Math.round((data.trackDone / Math.max(1, data.trackTotal)) * 100)}%</div>
              <div className="mt-1 text-[11px] text-muted">Track {data.track}</div>
            </div>
          </ProgressRing>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[13px] text-muted">
              <CalendarDays size={14} className="text-sage-deep" /> {data.week ? `Week ${data.weekNumber} of 16` : 'Roadmap'}
            </div>
            <div className="mt-1 line-clamp-2 font-serif text-[16px] leading-snug" title={data.week?.topics}>
              {data.week?.topics ?? (data.weekNumber > 16 ? 'Roadmap complete 🎓' : 'Starts soon')}
            </div>
            {data.weekTotal > 0 && (
              <div className="mt-2">
                <Bar value={data.weekDone} max={data.weekTotal} color="var(--lavender)" />
                <div className="mt-1 text-[11px] text-muted">{data.weekDone}/{data.weekTotal} this week</div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card delay={0.14} className="mt-5">
        <CardTitle icon={<Mountain size={18} />}>A year of practice</CardTitle>
        <Heatmap days={data.heatmap} />
      </Card>

      <div className="mt-5 grid grid-cols-5 gap-5">
        <Card delay={0.18} className="col-span-2">
          <CardTitle>Needs a little love</CardTitle>
          {data.weakTopics.length === 0 ? (
            <p className="text-[13px] text-muted">Every topic in your track is complete. Time for revision!</p>
          ) : (
            <div className="space-y-4">
              {data.weakTopics.map((t) => (
                <div key={t.topic}>
                  <div className="mb-1.5 flex justify-between text-[13px]">
                    <span className="font-medium">{t.topic}</span>
                    <span className="text-muted">{t.solved}/{t.total}</span>
                  </div>
                  <Bar value={t.solved} max={t.total} color="var(--peach)" />
                </div>
              ))}
            </div>
          )}
          {thought && (
            <div className="mt-6 rounded-2xl bg-bg-deep p-4 text-[13px] leading-relaxed text-ink-soft">
              <div className="mb-1 text-[11px] font-medium tracking-wide text-muted uppercase">Thought of the day · {thought.topic}</div>
              {thought.text}
            </div>
          )}
        </Card>

        <Card delay={0.22} className="col-span-3">
          <CardTitle action={<Button size="sm" variant="ghost" onClick={() => navigate('/settings')}>Manage</Button>}>Platforms</CardTitle>
          <div className="grid grid-cols-2 gap-3">
            {data.platforms.map((p) => (
              <div key={p.platform} className="rounded-2xl border border-line bg-bg/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{PLATFORM_LABEL[p.platform]}</span>
                  {p.error ? (
                    <span className="text-[11px] text-peach-deep" title={p.error}>sync issue</span>
                  ) : (
                    <span className="text-[11px] text-muted">{p.username ? timeAgo(p.lastSync) : 'not linked'}</span>
                  )}
                </div>
                {p.username ? (
                  <div className="mt-2 flex items-baseline gap-4">
                    <div>
                      <div className="font-serif text-[24px] leading-none font-semibold">{p.solved}</div>
                      <div className="text-[11px] text-muted">solved</div>
                    </div>
                    {p.rating != null && (
                      <div>
                        <div className="font-serif text-[24px] leading-none font-semibold">{p.rating}</div>
                        <div className="text-[11px] text-muted">rating{p.maxRating ? ` · max ${p.maxRating}` : ''}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button onClick={() => navigate('/settings')} className="mt-2 cursor-pointer text-[13px] text-sage-deep hover:underline">
                    Add username →
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function DashboardSkeleton(): ReactNode {
  return (
    <div>
      <Skeleton className="mb-8 h-12 w-80" />
      <div className="grid grid-cols-3 gap-5">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="mt-5 h-48" />
    </div>
  )
}
