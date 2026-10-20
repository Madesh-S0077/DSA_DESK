import { NotebookPen, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Button, Card, Empty, PageHeader, Pill, Skeleton, cx, inputClass } from '../components/ui'
import { useApp, useData } from '../lib/store'

export function Mistakes(): ReactNode {
  const { data } = useData(() => window.api.listMistakes())
  const openMistake = useApp((s) => s.openMistake)
  const [query, setQuery] = useState('')
  const [pattern, setPattern] = useState<string | null>(null)

  const patterns = useMemo(() => {
    const c = new Map<string, number>()
    for (const m of data ?? []) if (m.pattern) c.set(m.pattern, (c.get(m.pattern) ?? 0) + 1)
    return [...c].sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [data])

  if (!data) return <Skeleton className="h-96" />
  const q = query.trim().toLowerCase()
  const shown = data.filter(
    (m) =>
      (!pattern || m.pattern === pattern) &&
      (!q || [m.title, m.mistake, m.why, m.insight, m.pattern, m.avoid].some((f) => f.toLowerCase().includes(q)))
  )

  return (
    <div>
      <PageHeader
        title="Mistake Log"
        subtitle="Keep it honest and review it weekly. Re-solve the oldest entry first."
        action={
          <Button variant="primary" onClick={() => openMistake({ key: '', platform: 'leetcode', title: '', url: '' })}>
            <Plus size={16} /> New entry
          </Button>
        }
      />

      {data.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <div className="relative mr-2 w-64">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input className={cx(inputClass, 'pl-9')} placeholder="Search the log" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {patterns.map(([p, n]) => (
            <button key={p} onClick={() => setPattern(pattern === p ? null : p)} className="cursor-pointer">
              <Pill className={pattern === p ? 'bg-sage text-white' : 'bg-bg-deep text-ink-soft hover:brightness-95'}>
                {p} · {n}
              </Pill>
            </button>
          ))}
        </div>
      )}

      {data.length === 0 ? (
        <Card>
          <Empty icon={<NotebookPen className="text-sage-deep" size={32} />} title="Your log is empty">
            When you get something wrong or solve it inefficiently, log it here while it’s fresh. Patterns in your mistakes are the fastest way to improve.
          </Empty>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {shown.map((m, i) => (
            <Card key={m.id} delay={Math.min(i * 0.03, 0.3)} className="group">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-serif text-[17px] font-semibold">{m.title}</div>
                  <div className="mt-1 flex items-center gap-2 text-[12px] text-muted">
                    {m.pattern && <Pill className="bg-sage-soft text-sage-deep">{m.pattern}</Pill>}
                    {new Date(m.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <button
                  onClick={() => confirm('Delete this entry?') && void window.api.deleteMistake(m.id)}
                  className="cursor-pointer rounded-lg p-1.5 text-muted opacity-0 transition group-hover:opacity-100 hover:bg-peach-soft hover:text-peach-deep"
                  aria-label="Delete entry"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <dl className="space-y-2 text-[13px] leading-relaxed">
                <Row k="Mistake" v={m.mistake} tone="text-peach-deep" />
                <Row k="Why" v={m.why} />
                <Row k="Insight" v={m.insight} tone="text-sage-deep" />
                <Row k="Avoid it by" v={m.avoid} />
              </dl>
            </Card>
          ))}
          {shown.length === 0 && <p className="col-span-2 py-10 text-center text-muted">No entries match.</p>}
        </div>
      )}
    </div>
  )
}

function Row({ k, v, tone }: { k: string; v: string; tone?: string }): ReactNode {
  if (!v) return null
  return (
    <div className="grid grid-cols-[96px_1fr] gap-2">
      <dt className={cx('text-[11px] font-medium tracking-wide uppercase', tone ?? 'text-muted')}>{k}</dt>
      <dd className="text-ink-soft">{v}</dd>
    </div>
  )
}
