import { useMemo, type ReactNode } from 'react'
import { parseDateKey } from '@shared/dates'

const LEVEL_VARS = ['var(--heat-0)', 'var(--heat-1)', 'var(--heat-2)', 'var(--heat-3)', 'var(--heat-4)']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function level(n: number): number {
  return n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4
}

/** GitHub-style year grid in the sage gradient. Columns are weeks starting Monday. */
export function Heatmap({ days, weeks = 53 }: { days: { date: string; count: number }[]; weeks?: number }): ReactNode {
  const { columns, monthLabels } = useMemo(() => {
    const recent = days.slice(-weeks * 7)
    const first = parseDateKey(recent[0]?.date ?? '2000-01-01')
    const pad = (first.getDay() + 6) % 7
    const cells: ({ date: string; count: number } | null)[] = [...Array(pad).fill(null), ...recent]
    const columns: (typeof cells)[] = []
    for (let i = 0; i < cells.length; i += 7) columns.push(cells.slice(i, i + 7))
    const monthLabels: { col: number; label: string }[] = []
    let lastMonth = -1
    columns.forEach((col, i) => {
      const firstDay = col.find(Boolean)
      if (!firstDay) return
      const m = parseDateKey(firstDay.date).getMonth()
      if (m !== lastMonth) {
        if (i > 0 || pad < 4) monthLabels.push({ col: i, label: MONTHS[m] })
        lastMonth = m
      }
    })
    return { columns, monthLabels }
  }, [days, weeks])

  const cell = 12
  const gap = 3
  return (
    <div className="overflow-x-auto pb-1">
      <svg width={columns.length * (cell + gap) + 24} height={7 * (cell + gap) + 22} role="img" aria-label="Problems solved per day over the last year">
        {monthLabels.map((m) => (
          <text key={m.col} x={24 + m.col * (cell + gap)} y={10} fontSize={10} fill="var(--muted)">
            {m.label}
          </text>
        ))}
        {['Mon', 'Wed', 'Fri'].map((d, i) => (
          <text key={d} x={0} y={18 + (i * 2 + 1) * (cell + gap) - 3} fontSize={9} fill="var(--muted)">
            {d}
          </text>
        ))}
        {columns.map((col, x) =>
          col.map((c, y) =>
            c ? (
              <rect
                key={c.date}
                x={24 + x * (cell + gap)}
                y={16 + y * (cell + gap)}
                width={cell}
                height={cell}
                rx={3}
                fill={LEVEL_VARS[level(c.count)]}
              >
                <title>{`${c.count} solved · ${parseDateKey(c.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`}</title>
              </rect>
            ) : null
          )
        )}
      </svg>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-muted">
        less
        {LEVEL_VARS.map((c) => (
          <span key={c} className="inline-block h-[10px] w-[10px] rounded-[3px]" style={{ background: c }} />
        ))}
        more
      </div>
    </div>
  )
}
