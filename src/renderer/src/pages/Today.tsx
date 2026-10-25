import { motion } from 'framer-motion'
import { Coffee, Compass, Repeat, Sparkles } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { ExternalPick, Guide, Recommendation } from '@shared/types'
import { PLATFORM_LABEL } from '@shared/types'
import { parseDateKey } from '@shared/dates'
import { detailsOf } from '@shared/companies'
import { Bar, Button, Card, CardTitle, DifficultyPill, Empty, LevelPill, PageHeader, Pill, Skeleton, Stars } from '../components/ui'
import { ProblemActions } from '../components/ProblemActions'
import { ConfidencePicker } from '../components/Dialogs'
import { ContestBanner } from './Contests'
import { useApp, useData } from '../lib/store'
import { companyLine, guideRef, hintFor, plural } from '../lib/problem'

export function Today(): ReactNode {
  const { data } = useData(() => window.api.getToday())
  // Picks are cached per day in the main process, so refetching on data changes is cheap.
  const { data: picks, loading: picksLoading } = useData(() => window.api.getPicks())
  const guide = useApp((s) => s.guide)

  if (!data || !guide) return <Skeleton className="h-96" />
  const solvedSet = new Set(data.solvedToday)
  const done = data.solvedToday.length
  const dateLabel = parseDateKey(data.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div>
      <PageHeader
        title="Today"
        subtitle={dateLabel}
        action={
          <div className="w-56 text-right">
            <div className="mb-1.5 text-[13px] text-muted">
              {done >= data.dailyGoal ? 'Goal reached 🌿' : `${done} of ${data.dailyGoal} for today`}
            </div>
            <Bar value={done} max={data.dailyGoal} />
          </div>
        }
      />

      {data.sheetPotd ? (
        <PotdHero guide={guide} rec={data.sheetPotd} solved={solvedSet.has(`lc:${data.sheetPotd.problem.slug}`)} />
      ) : (
        <Card>
          <Empty icon="🎓" title="You’ve finished your whole track">Switch to a bigger track in Settings, or spend today on revision.</Empty>
        </Card>
      )}

      <ContestBanner />

      <h2 className="mt-9 mb-4 flex items-center gap-2 font-serif text-[20px] font-semibold">
        <Compass size={18} className="text-sage-deep" /> From around the web
      </h2>
      <div className="grid grid-cols-4 gap-4">
        <PickCard label="LeetCode Daily" pick={picks?.lcDaily} error={picks?.errors.lcDaily} loading={picksLoading && !picks} solved={solvedSet} />
        <PickCard label="GFG Problem of the Day" pick={picks?.gfgPotd} error={picks?.errors.gfgPotd} loading={picksLoading && !picks} solved={solvedSet} />
        <PickCard label="Codeforces pick" sub="near your rating" pick={picks?.cfPick} error={picks?.errors.cfPick} loading={picksLoading && !picks} solved={solvedSet} />
        <PickCard label="AtCoder pick" sub="ABC, near your level" pick={picks?.acPick} error={picks?.errors.acPick} loading={picksLoading && !picks} solved={solvedSet} />
      </div>

      <div className="mt-9 grid grid-cols-5 gap-5">
        <Card className="col-span-3">
          <CardTitle icon={<Sparkles size={18} />}>Try next</CardTitle>
          <div className="divide-y divide-line">
            {data.recommendations.map((r) => (
              <RecRow key={r.problem.no} guide={guide} rec={r} />
            ))}
          </div>
        </Card>
        <Card className="col-span-2">
          <CardTitle icon={<Repeat size={18} />}>Revision due</CardTitle>
          {data.revisionsDue.length === 0 ? (
            <Empty icon="🍃" title="Nothing to revise today">Solved problems come back here on a 1 → 3 → 7 → 14 → 30 day rhythm.</Empty>
          ) : (
            <div className="space-y-3">
              {data.revisionsDue.slice(0, 4).map((r) => (
                <ReviewItem key={r.key} problemKey={r.key} title={r.problem.title} url={r.problem.url} overdue={r.overdueDays} />
              ))}
              {data.revisionsDue.length > 4 && <p className="text-[12px] text-muted">+{data.revisionsDue.length - 4} more on the Revision page</p>}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function PotdHero({ guide, rec, solved }: { guide: Guide; rec: Recommendation; solved: boolean }): ReactNode {
  const p = rec.problem
  const d = detailsOf(guide, p)
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-[28px] border border-line bg-card p-8 shadow-soft"
    >
      <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-sage-soft opacity-70" />
      <div className="pointer-events-none absolute -right-4 -bottom-24 h-48 w-48 rounded-full bg-peach-soft opacity-60" />
      <div className="relative">
        <div className="flex items-center gap-2 text-[13px] font-medium text-sage-deep">
          <Coffee size={16} /> Problem of the day · #{p.no} on your sheet
        </div>
        <h2 className="mt-3 font-serif text-[36px] leading-tight font-semibold">{p.title}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DifficultyPill difficulty={p.difficulty} />
          <LevelPill level={p.level} />
          <Pill className="bg-bg-deep text-ink-soft">{p.topic}</Pill>
          <Stars n={p.priority} />
          {rec.reasons.map((r) => (
            <Pill key={r} className="bg-lavender/20 text-ink-soft">{r}</Pill>
          ))}
        </div>
        {(d.why || d.concept) && <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-ink-soft">{d.why ? `Why it matters: ${d.why}` : d.concept}</p>}
        {d.companies?.length || d.everywhere ? <p className="mt-2 text-[13px] text-muted">Companies: {companyLine(d)}</p> : null}
        <div className="mt-6">
          <ProblemActions problem={guideRef(p)} hint={hintFor(guide, p)} solved={solved} showMistake={solved} />
        </div>
      </div>
    </motion.section>
  )
}

function RecRow({ guide, rec }: { guide: Guide; rec: Recommendation }): ReactNode {
  const p = rec.problem
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="truncate font-medium">{p.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
          <DifficultyPill difficulty={p.difficulty} />
          <span>{p.topic}</span>
          <Stars n={p.priority} />
          {rec.reasons.filter((r) => r !== 'Must do').slice(0, 1).map((r) => (
            <span key={r} className="text-sage-deep">· {r}</span>
          ))}
        </div>
      </div>
      <ProblemActions size="sm" problem={guideRef(p)} hint={hintFor(guide, p)} />
    </div>
  )
}

function PickCard({
  label, sub, pick, error, loading, solved
}: { label: string; sub?: string; pick?: ExternalPick | null; error?: string; loading: boolean; solved: Set<string> }): ReactNode {
  return (
    <Card pad="p-5" className="flex flex-col">
      <div className="text-[12px] font-medium tracking-wide text-muted uppercase">{label}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
      {loading ? (
        <div className="mt-4 space-y-2">
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ) : pick ? (
        <>
          <div className="mt-3 line-clamp-2 font-serif text-[17px] leading-snug font-semibold" title={pick.title}>{pick.title}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <DifficultyPill difficulty={pick.difficulty} rating={pick.platform === 'leetcode' || pick.platform === 'gfg' ? null : pick.rating} />
            {pick.topic && <span className="text-[12px] text-muted">{pick.topic}</span>}
          </div>
          <div className="mt-auto pt-4">
            <ProblemActions size="sm" problem={pick} solved={solved.has(pick.key)} />
          </div>
        </>
      ) : (
        <p className="mt-3 text-[13px] text-muted">{error ? `Couldn’t reach ${pickPlatform(label)} right now. Try again later.` : 'Nothing to show.'}</p>
      )}
    </Card>
  )
}

function pickPlatform(label: string): string {
  return Object.values(PLATFORM_LABEL).find((l) => label.includes(l.split(' ')[0])) ?? 'the site'
}

/** One revision item with an inline "how did it go" picker. */
export function ReviewItem({ problemKey, title, url, overdue }: { problemKey: string; title: string; url: string; overdue: number }): ReactNode {
  const [open, setOpen] = useState(false)
  const [conf, setConf] = useState(2)
  return (
    <div className="rounded-2xl border border-line bg-bg/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium">{title}</div>
          <div className="text-[12px] text-muted">{overdue > 0 ? `${plural(overdue, 'day')} overdue` : 'due today'}</div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button size="sm" variant="soft" onClick={() => void window.api.openExternal(url)}>Open</Button>
          <Button size="sm" variant={open ? 'ghost' : 'primary'} onClick={() => setOpen(!open)}>{open ? 'Cancel' : 'Reviewed'}</Button>
        </div>
      </div>
      {open && (
        <div className="mt-4">
          <ConfidencePicker value={conf} onChange={setConf} />
          <Button className="mt-3 w-full" variant="primary" size="sm" onClick={() => void window.api.reviewDone(problemKey, conf)}>
            Schedule next review
          </Button>
        </div>
      )}
    </div>
  )
}

