import { Check, ExternalLink, NotebookPen, Timer } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ProblemRef } from '@shared/types'
import { Button } from './ui'
import { useApp } from '../lib/store'
import { timeboxFor } from '../lib/problem'

/** Start-focus / open / mark-solved buttons shared by every problem card. */
export function ProblemActions({
  problem, hint, solved, size = 'md', showMistake = false, compact = false
}: {
  problem: ProblemRef
  hint?: string
  solved?: boolean
  size?: 'sm' | 'md'
  showMistake?: boolean
  /** Icons only for Open and Mark solved, for narrow rows. */
  compact?: boolean
}): ReactNode {
  const startFocus = useApp((s) => s.startFocus)
  const openSolve = useApp((s) => s.openSolve)
  const openMistake = useApp((s) => s.openMistake)
  return (
    <div className={compact ? 'flex shrink-0 items-center gap-1' : 'flex flex-wrap items-center gap-2'}>
      {!solved && (
        <Button size={size} variant="primary" onClick={() => startFocus({ problem, hint, minutes: timeboxFor(problem.difficulty) })}>
          <Timer size={15} /> Start
        </Button>
      )}
      <Button size={size} variant={compact ? 'ghost' : 'soft'} title="Open" onClick={() => void window.api.openExternal(problem.url)}>
        <ExternalLink size={15} /> {!compact && 'Open'}
      </Button>
      {solved ? (
        <span className="inline-flex items-center gap-1 px-2 text-[13px] font-medium text-sage-deep">
          <Check size={15} /> Solved
        </span>
      ) : (
        <Button size={size} variant="ghost" title="Mark solved" onClick={() => openSolve(problem)}>
          <Check size={15} /> {!compact && 'Mark solved'}
        </Button>
      )}
      {showMistake && (
        <Button size={size} variant="ghost" onClick={() => openMistake(problem)} title="Log a mistake">
          <NotebookPen size={15} />
        </Button>
      )}
    </div>
  )
}
