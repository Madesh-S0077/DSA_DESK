import { CalendarClock, Check, ExternalLink, Swords, Timer } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { GuideProblem, Simulation } from '@shared/types'
import { addDays, dateKey, parseDateKey } from '@shared/dates'
import { Button, Card, CardTitle, DifficultyPill, Empty, Modal, PageHeader, Pill, Skeleton } from '../components/ui'
import { ReviewItem } from './Today'
import { useApp, useData } from '../lib/store'
import { guideRef, timeboxFor } from '../lib/problem'

export function Revision(): ReactNode {
  const { data } = useData(() => window.api.getRevisions())
  const guide = useApp((s) => s.guide)
  const [sim, setSim] = useState<Simulation | null>(null)

  if (!data || !guide) return <Skeleton className="h-96" />
  const endOfToday = parseDateKey(addDays(dateKey(), 1)).getTime()
  const due = data.filter((r) => r.dueAt < endOfToday)
  const weekEnd = parseDateKey(addDays(dateKey(), 8)).getTime()
  const upcoming = data.filter((r) => r.dueAt >= endOfToday && r.dueAt < weekEnd)

  return (
    <div>
      <PageHeader title="Revision" subtitle="Spaced repetition keeps patterns fresh. Re-solve cold, without notes." />

      <div className="grid grid-cols-5 gap-5">
        <Card className="col-span-3">
          <CardTitle icon={<Check size={18} />} action={<span className="text-[13px] text-muted">{due.length} due</span>}>Due now</CardTitle>
          {due.length === 0 ? (
            <Empty icon="🍃" title="All caught up">Solve something new today. It’ll come back for review tomorrow.</Empty>
          ) : (
            <div className="space-y-3">
              {due.map((r) => (
                <ReviewItem key={r.key} problemKey={r.key} title={r.problem.title} url={r.problem.url} overdue={r.overdueDays} />
              ))}
            </div>
          )}
        </Card>

        <Card className="col-span-2">
          <CardTitle icon={<CalendarClock size={18} />}>Coming up this week</CardTitle>
          {upcoming.length === 0 ? (
            <p className="text-[13px] text-muted">Nothing scheduled in the next 7 days.</p>
          ) : (
            <div className="space-y-2.5">
              {upcoming.map((r) => (
                <div key={r.key} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="truncate">{r.problem.title}</span>
                  <span className="shrink-0 text-muted">{new Date(r.dueAt).toLocaleDateString(undefined, { weekday: 'short' })}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 rounded-2xl bg-bg-deep p-4 text-[12px] leading-relaxed text-muted">
            The rhythm: 1 → 3 → 7 → 14 → 30 → 60 days. “Nailed it” moves a problem up a step, “Okay” repeats the step, “Shaky” starts it over. The 50 Essentials come round a little sooner.
          </div>
        </Card>
      </div>

      <h2 className="mt-10 mb-1 flex items-center gap-2 font-serif text-[20px] font-semibold">
        <Swords size={18} className="text-sage-deep" /> Interview simulations
      </h2>
      <p className="mb-4 text-[13px] text-muted">Each set mixes topics like a real 45–60 minute loop. Time yourself, with no looking up solutions.</p>
      <div className="grid grid-cols-5 gap-4">
        {guide.simulations.map((s) => {
          const ps = s.problems.map((n) => guide.problems.find((p) => p.no === n)!)
          return (
            <Card key={s.id} pad="p-5" className="flex flex-col">
              <div className="text-[12px] text-muted">Simulation {s.id}</div>
              <div className="mt-1 font-serif text-[15px] leading-snug font-semibold">{s.name}</div>
              <ul className="mt-3 mb-4 space-y-1 text-[12px] text-ink-soft">
                {ps.map((p) => (
                  <li key={p.no} className="truncate">· {p.title}</li>
                ))}
              </ul>
              <Button className="mt-auto" size="sm" variant="soft" onClick={() => setSim(s)}>
                <Timer size={14} /> Start
              </Button>
            </Card>
          )
        })}
      </div>

      <SimulationRunner sim={sim} problems={sim ? sim.problems.map((n) => guide.problems.find((p) => p.no === n)!) : []} onClose={() => setSim(null)} />
    </div>
  )
}

function SimulationRunner({ sim, problems, onClose }: { sim: Simulation | null; problems: GuideProblem[]; onClose: () => void }): ReactNode {
  const total = problems.reduce((a, p) => a + timeboxFor(p.difficulty), 0) * 60
  const [elapsed, setElapsed] = useState(0)
  const [done, setDone] = useState<Set<number>>(new Set())
  const openSolve = useApp((s) => s.openSolve)
  const solved = useApp((s) => s.sheet.solved)

  useEffect(() => {
    setElapsed(0)
    setDone(new Set())
    if (!sim) return
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [sim])

  const remaining = total - elapsed
  const shown = Math.abs(remaining)
  const time = `${remaining < 0 ? '+' : ''}${String(Math.floor(shown / 60)).padStart(2, '0')}:${String(shown % 60).padStart(2, '0')}`

  return (
    <Modal open={!!sim} onClose={onClose} title={sim ? `Simulation ${sim.id}` : ''} width={620}>
      <div className="-mt-2 mb-5 flex items-center justify-between">
        <span className="text-[13px] text-muted">{sim?.name}</span>
        <span className={`font-mono text-[28px] tabular-nums ${remaining < 0 ? 'text-peach-deep' : ''}`}>{time}</span>
      </div>
      <div className="space-y-2.5">
        {problems.map((p, i) => (
          <div key={p.no} className="flex items-center gap-3 rounded-2xl border border-line bg-bg/60 p-3.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sage-soft text-[12px] font-semibold text-sage-deep">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{p.title}</div>
              <div className="mt-0.5 flex items-center gap-2">
                <DifficultyPill difficulty={p.difficulty} />
                <span className="text-[12px] text-muted">~{timeboxFor(p.difficulty)} min</span>
                {solved[p.slug] && <Pill className="bg-sage-soft text-sage-deep">solved before</Pill>}
              </div>
            </div>
            <Button size="sm" variant="soft" onClick={() => void window.api.openExternal(p.url)}><ExternalLink size={14} /></Button>
            <Button
              size="sm"
              variant={done.has(p.no) ? 'ghost' : 'primary'}
              disabled={done.has(p.no)}
              onClick={() => {
                setDone((d) => new Set(d).add(p.no))
                openSolve(guideRef(p))
              }}
            >
              {done.has(p.no) ? 'Done' : 'Solved'}
            </Button>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <span className="text-[13px] text-muted">{done.size}/{problems.length} complete</span>
        <Button variant="ghost" onClick={onClose}>{done.size === problems.length ? 'Finish' : 'End early'}</Button>
      </div>
    </Modal>
  )
}
