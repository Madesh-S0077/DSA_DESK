import { ArrowRight, Building2, Target } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CompanyStat } from '@shared/types'
import { listCompanies } from '@shared/companies'
import { Bar, Button, Card, CardTitle, DifficultyPill, Empty, PageHeader, ProgressRing, Skeleton, Stars, cx } from '../components/ui'
import { ProblemActions } from '../components/ProblemActions'
import { useApp, useData } from '../lib/store'
import { guideRef, hintFor, plural } from '../lib/problem'

const DIFF_COLOR = { Easy: 'var(--sage)', Medium: 'var(--butter)', Hard: 'var(--peach)' } as const

export function Companies(): ReactNode {
  const guide = useApp((s) => s.guide)!
  const settings = useApp((s) => s.settings)!
  const setSettings = useApp((s) => s.setSettings)
  const { data } = useData(() => window.api.getCompanies())
  const companies = useMemo(() => listCompanies(guide), [guide])
  const targets = settings.targetCompanies

  const toggle = (company: string): void => {
    const next = targets.includes(company) ? targets.filter((c) => c !== company) : [...targets, company]
    void setSettings({ targetCompanies: companies.map((c) => c.company).filter((c) => next.includes(c)) })
  }

  return (
    <div>
      <PageHeader title="Company Prep" subtitle="Pick where you’re interviewing. Their problems rise to the top of your recommendations." />

      <Card className="mb-6">
        <CardTitle icon={<Target size={18} />}>Your target companies</CardTitle>
        <div className="flex flex-wrap gap-2">
          {companies.map(({ company, count }) => {
            const on = targets.includes(company)
            return (
              <button
                key={company}
                onClick={() => toggle(company)}
                aria-pressed={on}
                className={cx(
                  'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition',
                  on ? 'border-sage bg-sage-soft text-sage-deep' : 'border-line text-ink-soft hover:bg-bg-deep'
                )}
              >
                {company}
                <span className={cx('text-[11px] tabular-nums', on ? 'text-sage-deep/80' : 'text-muted')}>{count}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-4 text-[12px] text-muted">
          {targets.length
            ? `Problems asked at ${targets.join(', ')} get a boost in Today’s picks. Counts include the guide’s “asked everywhere” classics.`
            : 'Nothing picked yet, so below are the four companies the guide mentions most.'}
        </p>
      </Card>

      {!data ? (
        <div className="grid grid-cols-2 gap-5">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : data.length === 0 ? (
        <Card>
          <Empty icon={<Building2 />} title="Pick a company to see your readiness" />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-5">
          {data.map((c, i) => (
            <CompanyCard key={c.company} stat={c} delay={Math.min(i * 0.05, 0.3)} />
          ))}
        </div>
      )}
    </div>
  )
}

function readinessNote(c: CompanyStat): string {
  const pct = c.total ? c.solved / c.total : 0
  if (pct >= 1) return 'Every problem done. Keep them fresh with revision.'
  if (c.mustDoLeft) return `${plural(c.mustDoLeft, 'must-do')} left. Start there.`
  if (pct >= 0.75) return 'Nearly there. Polish the hards.'
  return 'Steady progress. Keep going.'
}

function CompanyCard({ stat: c, delay }: { stat: CompanyStat; delay: number }): ReactNode {
  const guide = useApp((s) => s.guide)!
  const navigate = useNavigate()
  const pct = c.total ? Math.round((c.solved / c.total) * 100) : 0
  return (
    <Card delay={delay} className="flex flex-col">
      <div className="flex items-start gap-5">
        <ProgressRing value={c.solved} max={c.total} size={96} stroke={9}>
          <div>
            <div className="font-serif text-[24px] leading-none font-semibold">{pct}%</div>
            <div className="mt-0.5 text-[11px] text-muted">ready</div>
          </div>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-[22px] leading-tight font-semibold">{c.company}</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {c.solved} of {c.total} problems · {readinessNote(c)}
          </p>
          <div className="mt-3 space-y-1.5">
            {c.byDifficulty.filter((d) => d.total > 0).map((d) => (
              <div key={d.difficulty} className="grid grid-cols-[56px_1fr_44px] items-center gap-2 text-[12px]">
                <span className="text-ink-soft">{d.difficulty}</span>
                <Bar value={d.solved} max={d.total} color={DIFF_COLOR[d.difficulty]} />
                <span className="text-right text-muted tabular-nums">{d.solved}/{d.total}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-2 text-[11px] font-medium tracking-wide text-muted uppercase">Next for {c.company}</div>
        {c.next.length === 0 ? (
          <p className="py-3 text-[13px] text-muted">All done 🌿</p>
        ) : (
          <div className="divide-y divide-line/70">
            {c.next.map((p) => (
              <div key={p.no} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium">{p.title}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
                    <DifficultyPill difficulty={p.difficulty} />
                    <span className="truncate">{p.topic}</span>
                    <Stars n={p.priority} />
                  </div>
                </div>
                <ProblemActions size="sm" compact problem={guideRef(p)} hint={hintFor(guide, p)} />
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-auto flex justify-end pt-3">
        <Button size="sm" variant="ghost" onClick={() => navigate(`/sheet?company=${encodeURIComponent(c.company)}`)}>
          All {c.total} in the sheet <ArrowRight size={14} />
        </Button>
      </div>
    </Card>
  )
}
