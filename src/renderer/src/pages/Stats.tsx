import type { ReactNode } from 'react'
import { Bar as RBar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PLATFORM_LABEL } from '@shared/types'
import { parseDateKey } from '@shared/dates'
import { Bar, Card, CardTitle, PageHeader, Skeleton } from '../components/ui'
import { useData } from '../lib/store'

// Every chart here is a single series in one hue; identity lives in titles and labels, never colour alone.
const MARK = 'var(--sage-deep)'
const AXIS = { fontSize: 11, fill: 'var(--muted)' }

function ChartTooltip({ active, payload, label, unit, fmt }: { active?: boolean; payload?: { value: number }[]; label?: string | number; unit: string; fmt?: (l: string | number) => string }): ReactNode {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2 text-[12px] shadow-soft">
      <div className="text-muted">{fmt && label != null ? fmt(label) : label}</div>
      <div className="font-medium text-ink">
        {payload[0].value} {unit}
      </div>
    </div>
  )
}

export function Stats(): ReactNode {
  const { data } = useData(() => window.api.getStats())
  if (!data) return <Skeleton className="h-96" />

  const totalSolvedWeeks = data.perWeek.reduce((a, w) => a + w.count, 0)
  const hours = Math.round((data.totalMinutes / 60) * 10) / 10
  const weekFmt = (w: string | number): string => `Week of ${parseDateKey(String(w)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`

  return (
    <div>
      <PageHeader title="Stats" subtitle="How the practice is adding up." />

      <div className="mb-5 grid grid-cols-4 gap-5">
        <Tile label="Solved in the last 12 weeks" value={totalSolvedWeeks} />
        <Tile label="Avg per active week" value={avgActive(data.perWeek.map((w) => w.count))} />
        <Tile label="Focused time logged" value={`${hours}h`} />
        <Tile label="Avg confidence" value={data.avgConfidence ? ['', '😬', '🙂', '😎'][Math.round(data.avgConfidence)] + ' ' + data.avgConfidence.toFixed(1) : '·'} />
      </div>

      <div className="grid grid-cols-5 gap-5">
        <Card className="col-span-3">
          <CardTitle>Sheet coverage by topic</CardTitle>
          <div style={{ height: data.topics.length * 30 + 20 }}>
            <ResponsiveContainer>
              <BarChart data={data.topics.map((t) => ({ ...t, pct: Math.round((t.solved / Math.max(1, t.total)) * 100) }))} layout="vertical" margin={{ left: 8, right: 36 }} barCategoryGap={6}>
                <CartesianGrid horizontal={false} stroke="var(--line)" strokeDasharray="2 4" />
                <XAxis type="number" domain={[0, 100]} tick={AXIS} tickFormatter={(v) => `${v}%`} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="topic" width={170} tick={{ ...AXIS, fill: 'var(--ink-soft)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'var(--bg-deep)' }}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="rounded-xl border border-line bg-card px-3 py-2 text-[12px] shadow-soft">
                        <div className="text-muted">{payload[0].payload.topic}</div>
                        <div className="font-medium">{payload[0].payload.solved} of {payload[0].payload.total} solved</div>
                      </div>
                    ) : null
                  }
                />
                <RBar dataKey="pct" fill={MARK} radius={[0, 4, 4, 0]} maxBarSize={14} label={{ position: 'right', fontSize: 11, fill: 'var(--muted)', formatter: (v: unknown) => `${v}%` }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="col-span-2 space-y-5">
          <Card>
            <CardTitle>By difficulty (your track)</CardTitle>
            <div className="space-y-4">
              {data.byDifficulty.map((d) => (
                <div key={d.difficulty}>
                  <div className="mb-1.5 flex justify-between text-[13px]">
                    <span className="font-medium">{d.difficulty}</span>
                    <span className="text-muted">{d.solved}/{d.total}</span>
                  </div>
                  <Bar value={d.solved} max={d.total} color={d.difficulty === 'Easy' ? 'var(--sage)' : d.difficulty === 'Medium' ? 'var(--butter)' : 'var(--peach)'} />
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardTitle>Solved per platform</CardTitle>
            <div className="space-y-3">
              {data.byPlatform.map((p) => (
                <div key={p.platform} className="grid grid-cols-[110px_1fr_40px] items-center gap-3 text-[13px]">
                  <span>{PLATFORM_LABEL[p.platform]}</span>
                  <Bar value={p.count} max={Math.max(1, ...data.byPlatform.map((x) => x.count))} color={MARK} />
                  <span className="text-right text-muted tabular-nums">{p.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-5">
        <CardTitle>Problems solved per week</CardTitle>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={data.perWeek} margin={{ left: -16, right: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 4" />
              <XAxis dataKey="week" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(w) => parseDateKey(w).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
              <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'var(--bg-deep)' }} content={<ChartTooltip unit="solved" fmt={weekFmt} />} />
              <RBar dataKey="count" fill={MARK} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {data.ratingHistory.length > 0 && (
        <div className="mt-5 grid gap-5" style={{ gridTemplateColumns: `repeat(${data.ratingHistory.length}, minmax(0, 1fr))` }}>
          {data.ratingHistory.map((r) => (
            <Card key={r.platform}>
              <CardTitle action={<span className="font-serif text-[20px] font-semibold">{r.points.at(-1)?.rating}</span>}>
                {PLATFORM_LABEL[r.platform]} rating
              </CardTitle>
              <div className="h-40">
                <ResponsiveContainer>
                  <LineChart data={r.points} margin={{ left: -16, right: 8, top: 4 }}>
                    <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 4" />
                    <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} scale="time" tick={AXIS} axisLine={false} tickLine={false}
                      tickFormatter={(t) => new Date(t).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })} />
                    <YAxis domain={['auto', 'auto']} tick={AXIS} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }} content={<ChartTooltip unit="rating" fmt={(t) => new Date(Number(t)).toLocaleDateString()} />} />
                    <Line type="monotone" dataKey="rating" stroke={MARK} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: 'var(--card)', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function avgActive(counts: number[]): string {
  const active = counts.filter((c) => c > 0)
  return active.length ? (active.reduce((a, b) => a + b, 0) / active.length).toFixed(1) : '0'
}

function Tile({ label, value }: { label: string; value: ReactNode }): ReactNode {
  return (
    <Card pad="p-5">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-1 font-serif text-[30px] leading-tight font-semibold">{value}</div>
    </Card>
  )
}
