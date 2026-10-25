import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, ExternalLink, Lightbulb, Search, Timer } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { GuideProblem, GuideTopic } from '@shared/types'
import { askedAt, detailsOf, listCompanies, targetMatch } from '@shared/companies'
import { Bar, Button, Card, DifficultyPill, LevelPill, PageHeader, Pill, Segmented, Stars, cx, inputClass } from '../components/ui'
import { useApp } from '../lib/store'
import { companyLine, guideRef, hintFor, timeboxFor } from '../lib/problem'

type Status = 'all' | 'todo' | 'done'
type ListFilter = 'all' | 'essential' | 'core' | 'roi'

export function Sheet(): ReactNode {
  const guide = useApp((s) => s.guide)
  const settings = useApp((s) => s.settings)
  const sheet = useApp((s) => s.sheet)
  const [track, setTrack] = useState<'A' | 'B' | 'C' | 'mine'>('mine')
  const [status, setStatus] = useState<Status>('all')
  const [list, setList] = useState<ListFilter>('all')
  const [query, setQuery] = useState('')
  const [params] = useSearchParams()
  /** 'all', 'targets', or a company name. */
  const [company, setCompany] = useState(() => params.get('company') ?? 'all')
  const companies = useMemo(() => (guide ? listCompanies(guide) : []), [guide])
  const targets = settings?.targetCompanies ?? []
  const [open, setOpen] = useState<Set<string>>(new Set())

  const effectiveTrack = track === 'mine' ? (settings?.track ?? 'C') : track
  const groups = useMemo(() => {
    if (!guide) return []
    const inTrack = new Set(guide.tracks[effectiveTrack])
    const lists = { essential: new Set(guide.lists.essential), core: new Set(guide.lists.core), roi: new Set(guide.lists.highestRoi) }
    const q = query.trim().toLowerCase()
    return guide.topics
      .map((topic) => {
        const all = guide.problems.filter((p) => p.topic === topic.name && inTrack.has(p.no))
        const shown = all.filter((p) => {
          const done = !!sheet.solved[p.slug]
          if (status === 'todo' && done) return false
          if (status === 'done' && !done) return false
          if (list !== 'all' && !lists[list].has(p.no)) return false
          if (company !== 'all') {
            const d = detailsOf(guide, p)
            if (company === 'targets' ? !targetMatch(d, targets) : !askedAt(d, company)) return false
          }
          if (q && !p.title.toLowerCase().includes(q) && !(p.details.pattern ?? '').toLowerCase().includes(q)) return false
          return true
        })
        return { topic, all, shown, done: all.filter((p) => sheet.solved[p.slug]).length }
      })
      .filter((g) => g.all.length > 0 && g.shown.length > 0)
  }, [guide, effectiveTrack, status, list, query, sheet, company, targets])

  if (!guide) return null
  const essential = new Set(guide.lists.essential)
  const toggle = (name: string): void =>
    setOpen((s) => {
      const n = new Set(s)
      if (n.has(name)) n.delete(name)
      else n.add(name)
      return n
    })
  const filtering = query.trim() !== '' || status !== 'all' || list !== 'all' || company !== 'all'

  return (
    <div>
      <PageHeader title="Problem Sheet" subtitle={`${guide.problems.length} hand-picked problems, pattern by pattern. Work top-to-bottom within a topic.`} />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input className={cx(inputClass, 'pl-9')} placeholder="Search problems or patterns" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Segmented
          value={track}
          onChange={setTrack}
          options={[
            { value: 'mine', label: `My track (${settings?.track ?? '-'})` },
            { value: 'A', label: 'A' },
            { value: 'B', label: 'B' },
            { value: 'C', label: 'C · all' }
          ]}
        />
        <Segmented value={status} onChange={setStatus} options={[{ value: 'all', label: 'All' }, { value: 'todo', label: 'To do' }, { value: 'done', label: 'Done' }]} />
        <Segmented
          value={list}
          onChange={setList}
          options={[{ value: 'all', label: 'Any list' }, { value: 'essential', label: '50 Essential' }, { value: 'core', label: '100 Core' }, { value: 'roi', label: 'Top ROI' }]}
        />
        <div className="w-52">
          <select
            aria-label="Company"
            className={cx(inputClass, 'cursor-pointer py-2', company !== 'all' && 'border-sage')}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          >
            <option value="all">Any company</option>
            {targets.length > 0 && <option value="targets">🎯 My targets</option>}
            {companies.map((c) => (
              <option key={c.company} value={c.company}>
                {c.company} ({c.count})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {groups.map(({ topic, all, shown, done }, i) => {
          const isOpen = filtering || open.has(topic.name)
          return (
            <Card key={topic.name} delay={Math.min(i * 0.03, 0.3)} pad="p-0">
              <button onClick={() => toggle(topic.name)} className="flex w-full cursor-pointer items-center gap-5 px-6 py-5 text-left">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sage-soft font-serif text-[15px] font-semibold text-sage-deep">
                  {guide.topics.indexOf(topic) + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-serif text-[18px] font-semibold">{topic.name}</div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="w-48"><Bar value={done} max={all.length} /></div>
                    <span className="text-[12px] text-muted">{done}/{all.length}</span>
                  </div>
                </div>
                <ChevronDown size={18} className={cx('text-muted transition', isOpen && 'rotate-180')} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="border-t border-line px-6 pt-4 pb-5">
                      <PatternCard topic={topic} />
                      <div className="mt-3">
                        {shown.map((p) => (
                          <ProblemRow key={p.no} p={p} essential={essential.has(p.no)} target={targetMatch(detailsOf(guide, p), targets)} />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          )
        })}
        {groups.length === 0 && <p className="py-10 text-center text-muted">No problems match these filters.</p>}
      </div>
    </div>
  )
}

function PatternCard({ topic }: { topic: GuideTopic }): ReactNode {
  const [open, setOpen] = useState(false)
  const c = topic.card
  return (
    <div className="rounded-2xl bg-bg-deep/70 p-4">
      <button onClick={() => setOpen(!open)} className="flex w-full cursor-pointer items-center gap-2 text-left text-[13px] font-medium text-ink-soft">
        <Lightbulb size={15} className="text-butter-deep" /> Pattern card: read this before the problems
        <ChevronDown size={15} className={cx('ml-auto text-muted transition', open && 'rotate-180')} />
      </button>
      {open && (
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] leading-relaxed">
          {(
            [
              ['Recognition signals', c.signals],
              ['Core idea', c.core],
              ['Typical complexity', c.complexity],
              ['Common traps', c.traps]
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] font-medium tracking-wide text-muted uppercase">{k}</dt>
              <dd className="mt-0.5 text-ink-soft">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

function ProblemRow({ p, essential, target }: { p: GuideProblem; essential: boolean; target: string | null }): ReactNode {
  const guide = useApp((s) => s.guide)!
  const solved = useApp((s) => s.sheet.solved[p.slug])
  const revision = useApp((s) => s.sheet.revisions[p.slug])
  const openSolve = useApp((s) => s.openSolve)
  const startFocus = useApp((s) => s.startFocus)
  const [expanded, setExpanded] = useState(false)
  const d = detailsOf(guide, p)
  const ref = guideRef(p)

  const toggleSolved = (): void => {
    if (solved) {
      if (confirm(`Mark “${p.title}” as not solved? Its revision schedule will be cleared.`)) void window.api.unmarkSolved(ref.key)
    } else openSolve(ref)
  }

  return (
    <div className="group border-b border-line/70 last:border-0">
      <div className="flex items-center gap-3 py-2.5">
        <button
          onClick={toggleSolved}
          aria-label={solved ? 'Mark as not solved' : 'Mark solved'}
          className={cx(
            'grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-lg border-2 transition',
            solved ? 'border-sage bg-sage text-white' : 'border-line hover:border-sage'
          )}
        >
          {solved && <Check size={14} strokeWidth={3} />}
        </button>
        <span className="w-8 shrink-0 text-right text-[12px] text-muted tabular-nums">#{p.no}</span>
        <button onClick={() => setExpanded(!expanded)} className={cx('min-w-0 cursor-pointer truncate text-left font-medium', solved && 'text-muted line-through decoration-line')}>
          {p.title}
        </button>
        {essential && <Pill className="bg-butter-soft text-butter-deep">Essential</Pill>}
        {p.details.seeAlso && <Pill className="bg-bg-deep text-muted">also #{p.details.seeAlso}</Pill>}
        {target && <Pill className="bg-sage-soft text-sage-deep">🎯 {target}</Pill>}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {revision && revision.dueAt <= Date.now() && <Pill className="bg-lavender/25 text-ink-soft">review due</Pill>}
          <LevelPill level={p.level} />
          <div className="w-[68px]"><DifficultyPill difficulty={p.difficulty} /></div>
          <Stars n={p.priority} />
          <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
            {!solved && (
              <Button size="sm" variant="ghost" title="Focus mode" onClick={() => startFocus({ problem: ref, hint: hintFor(guide, p), minutes: timeboxFor(p.difficulty) })}>
                <Timer size={15} />
              </Button>
            )}
            <Button size="sm" variant="ghost" title="Open on LeetCode" onClick={() => void window.api.openExternal(p.url)}>
              <ExternalLink size={15} />
            </Button>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="mb-3 ml-[76px] grid grid-cols-2 gap-x-6 gap-y-2 rounded-2xl bg-bg/70 p-4 text-[13px] leading-relaxed text-ink-soft">
          {d.pattern && <Detail k="Pattern" v={d.pattern} />}
          {d.concept && <Detail k="Key concept" v={d.concept} />}
          {d.why && <Detail k="Why it matters" v={d.why} />}
          {d.approach && <Detail k="Approach" v={d.approach} />}
          {d.insight && <Detail k="Insight" v={d.insight} />}
          {d.mistake && <Detail k="Common mistake" v={d.mistake} />}
          {d.variation && <Detail k="Variation" v={d.variation} />}
          {d.companies?.length || d.everywhere ? <Detail k="Companies" v={companyLine(d)} /> : null}
          {!d.pattern && !d.approach && d.text && <p className="col-span-2">{d.text}</p>}
          {solved && (
            <p className="col-span-2 text-[12px] text-muted">
              Solved {new Date(solved.solvedAt).toLocaleDateString()}
              {solved.timeTakenMin ? ` in ${solved.timeTakenMin} min` : ''}
              {revision ? ` · next review ${new Date(revision.dueAt).toLocaleDateString()}` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function Detail({ k, v }: { k: string; v: string }): ReactNode {
  return (
    <div>
      <div className="text-[11px] font-medium tracking-wide text-muted uppercase">{k}</div>
      <div>{v}</div>
    </div>
  )
}
