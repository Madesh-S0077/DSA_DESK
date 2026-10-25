import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, Check, ExternalLink, Lightbulb, Pause, Play, RefreshCw, RotateCcw, Route, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AiHelpKind, ProblemRef } from '@shared/types'
import { Button, DifficultyPill, Segmented } from './ui'
import { useApp } from '../lib/store'

const PRESETS = [
  { value: 0, label: 'Timebox' },
  { value: 25, label: 'Pomodoro 25' },
  { value: 45, label: 'Deep 45' }
]

/** Full-screen, distraction-free timer for one problem. */
export function FocusMode(): ReactNode {
  const focus = useApp((s) => s.focus)
  const startFocus = useApp((s) => s.startFocus)
  const openSolve = useApp((s) => s.openSolve)
  const [preset, setPreset] = useState(0)
  const [total, setTotal] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(true)
  const [hint, setHint] = useState(false)

  useEffect(() => {
    if (!focus) return
    setPreset(0)
    setTotal(focus.minutes * 60)
    setElapsed(0)
    setRunning(true)
    setHint(false)
  }, [focus])

  useEffect(() => {
    if (!focus || !running) return
    const id = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(id)
  }, [focus, running])

  const choosePreset = (v: number): void => {
    setPreset(v)
    setTotal((v || focus!.minutes) * 60)
    setElapsed(0)
    setRunning(true)
  }

  const remaining = total - elapsed
  const over = remaining < 0
  const shown = Math.abs(remaining)
  const mm = String(Math.floor(shown / 60)).padStart(2, '0')
  const ss = String(shown % 60).padStart(2, '0')
  const pct = total ? Math.min(1, elapsed / total) : 0

  return (
    <AnimatePresence>
      {focus && (
        <motion.div
          className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-bg px-8"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <button
            onClick={() => startFocus(null)}
            className="absolute top-6 right-6 flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] text-muted hover:bg-bg-deep"
          >
            <X size={16} /> Leave focus
          </button>

          <div className="mb-3 text-[13px] tracking-[0.2em] text-muted uppercase">Focus mode</div>
          <h1 className="max-w-3xl text-center font-serif text-[40px] leading-tight font-semibold">{focus.problem.title}</h1>
          <div className="mt-3 flex items-center gap-2">
            <DifficultyPill difficulty={focus.problem.difficulty} rating={focus.problem.rating} />
            {focus.problem.topic && <span className="text-[13px] text-muted">{focus.problem.topic}</span>}
          </div>

          <div className="relative my-10 grid place-items-center">
            <svg width={300} height={300} className="-rotate-90">
              <circle cx={150} cy={150} r={138} fill="none" stroke="var(--bg-deep)" strokeWidth={8} />
              <circle
                cx={150} cy={150} r={138} fill="none" strokeWidth={8} strokeLinecap="round"
                stroke={over ? 'var(--peach)' : 'var(--sage)'}
                strokeDasharray={2 * Math.PI * 138}
                strokeDashoffset={2 * Math.PI * 138 * (1 - pct)}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <div className="absolute text-center">
              <div className={`font-mono text-[64px] font-medium tabular-nums ${over ? 'text-peach-deep' : ''}`}>
                {over && '+'}
                {mm}:{ss}
              </div>
              <div className="text-[13px] text-muted">{over ? 'past your timebox. Peek at the hint?' : running ? 'stay with it' : 'paused'}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="soft" onClick={() => setRunning(!running)}>
              {running ? <Pause size={16} /> : <Play size={16} />} {running ? 'Pause' : 'Resume'}
            </Button>
            <Button variant="ghost" onClick={() => (setElapsed(0), setRunning(true))}>
              <RotateCcw size={16} /> Restart
            </Button>
            <Button variant="soft" onClick={() => void window.api.openExternal(focus.problem.url)}>
              <ExternalLink size={16} /> Open problem
            </Button>
            <Button variant="primary" onClick={() => openSolve(focus.problem)}>
              <Check size={16} /> Solved it
            </Button>
          </div>

          <div className="mt-6">
            <Segmented value={preset} onChange={choosePreset} options={PRESETS.map((p) => ({ ...p, label: p.value ? p.label : `Timebox ${focus.minutes}` }))} />
          </div>

          <AiHelp key={focus.startedAt} problem={focus.problem} onSettings={() => startFocus(null)} />

          {focus.hint && (
            <div className="mt-4 w-full max-w-xl">
              {hint ? (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-line bg-card p-5 text-[14px] leading-relaxed whitespace-pre-line text-ink-soft shadow-soft">
                  {focus.hint}
                </motion.div>
              ) : (
                <button onClick={() => setHint(true)} className="mx-auto flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-[13px] text-muted hover:bg-bg-deep">
                  <Lightbulb size={16} /> Need a nudge?
                </button>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const AI_KINDS: { kind: AiHelpKind; label: string; icon: ReactNode }[] = [
  { kind: 'explain', label: 'Explain problem', icon: <BookOpen size={15} /> },
  { kind: 'hint', label: 'Small hint', icon: <Lightbulb size={15} /> },
  { kind: 'approach', label: 'Approach', icon: <Route size={15} /> }
]

/** Gemini-backed tutor: explain the statement, a minimal hint, or the full approach (never code). */
function AiHelp({ problem, onSettings }: { problem: ProblemRef; onSettings: () => void }): ReactNode {
  const navigate = useNavigate()
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [kind, setKind] = useState<AiHelpKind | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  // Only the latest request may update the card.
  const request = useRef(0)

  useEffect(() => void window.api.hasAiKey().then(setHasKey), [])

  const ask = async (k: AiHelpKind, fresh = false): Promise<void> => {
    const id = ++request.current
    setKind(k)
    setConfirming(false)
    setLoading(true)
    setAnswer('')
    setError('')
    try {
      const text = await window.api.aiHelp(problem, k, fresh)
      if (id === request.current) setAnswer(text)
    } catch (e) {
      if (id === request.current) setError(String((e as Error).message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      if (id === request.current) setLoading(false)
    }
  }

  if (hasKey === null) return null
  if (!hasKey) {
    return (
      <button
        onClick={() => (onSettings(), navigate('/settings'))}
        className="mt-10 flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-[13px] text-muted hover:bg-bg-deep"
      >
        <Sparkles size={16} /> Add a free Gemini key in Settings to get AI help
      </button>
    )
  }

  return (
    <div className="mt-10 w-full max-w-xl">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {AI_KINDS.map((a) => (
          <Button
            key={a.kind} size="sm" variant={kind === a.kind ? 'primary' : 'ghost'} disabled={loading}
            onClick={() => (a.kind === 'approach' && kind !== 'approach' ? setConfirming(true) : void ask(a.kind))}
          >
            {a.icon} {a.label}
          </Button>
        ))}
      </div>

      {confirming && (
        <div className="mt-3 flex items-center justify-center gap-2 text-[13px] text-muted">
          This gives away the approach. Show it?
          <Button size="sm" variant="soft" onClick={() => void ask('approach')}>Show</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Not yet</Button>
        </div>
      )}

      {(loading || answer || error) && (
        <motion.div
          key={kind}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="mt-4 max-h-[34vh] overflow-y-auto rounded-2xl border border-line bg-card p-5 text-[14px] leading-relaxed whitespace-pre-line text-ink-soft shadow-soft"
        >
          {loading ? (
            <span className="flex items-center gap-2 text-muted"><Sparkles size={15} className="animate-pulse" /> thinking…</span>
          ) : error ? (
            <span className="text-peach-deep">{error}</span>
          ) : (
            <>
              {answer}
              <div className="mt-3 flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => kind && void ask(kind, true)}>
                  <RefreshCw size={14} /> Ask again
                </Button>
              </div>
            </>
          )}
        </motion.div>
      )}
    </div>
  )
}
