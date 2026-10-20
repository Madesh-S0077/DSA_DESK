import { useEffect, useState, type ReactNode } from 'react'
import { Button, Field, Modal, cx, inputClass } from './ui'
import { useApp } from '../lib/store'

const CONFIDENCE = [
  { v: 1, emoji: '😬', label: 'Shaky', hint: 'Needed hints / revisit tomorrow' },
  { v: 2, emoji: '🙂', label: 'Okay', hint: 'Got there with some struggle' },
  { v: 3, emoji: '😎', label: 'Nailed it', hint: 'Could redo it cold' }
]

export function ConfidencePicker({ value, onChange }: { value: number; onChange: (v: number) => void }): ReactNode {
  return (
    <div className="grid grid-cols-3 gap-2">
      {CONFIDENCE.map((c) => (
        <button
          key={c.v}
          type="button"
          onClick={() => onChange(c.v)}
          title={c.hint}
          className={cx(
            'cursor-pointer rounded-2xl border px-3 py-3 text-center transition',
            value === c.v ? 'border-sage bg-sage-soft' : 'border-line hover:bg-bg-deep'
          )}
        >
          <div className="text-2xl">{c.emoji}</div>
          <div className="mt-1 text-[13px] font-medium">{c.label}</div>
        </button>
      ))}
    </div>
  )
}

/** "Mark solved": confidence drives the spaced-repetition schedule. */
export function SolveDialog(): ReactNode {
  const target = useApp((s) => s.solveTarget)
  const close = useApp((s) => s.openSolve)
  const focus = useApp((s) => s.focus)
  const startFocus = useApp((s) => s.startFocus)
  const celebrate = useApp((s) => s.triggerCelebrate)
  const openMistake = useApp((s) => s.openMistake)
  const [confidence, setConfidence] = useState(2)
  const [minutes, setMinutes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!target) return
    setConfidence(2)
    const fromFocus = focus && focus.problem.key === target.key ? Math.max(1, Math.round((Date.now() - focus.startedAt) / 60000)) : null
    setMinutes(fromFocus ? String(fromFocus) : '')
  }, [target, focus])

  const save = async (logMistake: boolean): Promise<void> => {
    if (!target) return
    setSaving(true)
    try {
      await window.api.markSolved({ problem: target, confidence, timeTakenMin: minutes ? Number(minutes) : null })
      if (focus?.problem.key === target.key) startFocus(null)
      const today = await window.api.getToday()
      if (today.solvedToday.length === today.dailyGoal) celebrate()
      close(null)
      if (logMistake) openMistake(target)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={!!target} onClose={() => close(null)} title="Nice work ✨">
      <p className="-mt-2 mb-5 text-[14px] text-muted">
        <span className="font-medium text-ink">{target?.title}</span>: how did it feel?
      </p>
      <ConfidencePicker value={confidence} onChange={setConfidence} />
      <div className="mt-5">
        <Field label="Time taken (minutes)" hint="Optional. Filled in automatically from focus mode.">
          <input className={inputClass} type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="e.g. 25" />
        </Field>
      </div>
      <div className="mt-7 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => void save(true)} disabled={saving}>
          Save & log a mistake
        </Button>
        <Button variant="primary" onClick={() => void save(false)} disabled={saving}>
          Mark solved
        </Button>
      </div>
    </Modal>
  )
}

const EMPTY = { title: '', mistake: '', why: '', insight: '', pattern: '', avoid: '' }

/** The guide's Mistake Log template (§20.4). */
export function MistakeDialog(): ReactNode {
  const target = useApp((s) => s.mistakeTarget)
  const close = useApp((s) => s.openMistake)
  const guide = useApp((s) => s.guide)
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    if (!target) return
    const g = target.guideNo ? guide?.problems.find((p) => p.no === target.guideNo) : undefined
    setForm({ ...EMPTY, title: target.title, pattern: g?.details.pattern?.replace(/\.$/, '') ?? target.topic ?? '' })
  }, [target, guide])

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const save = async (): Promise<void> => {
    await window.api.addMistake({ ...form, problemKey: target?.key || null })
    close(null)
  }

  return (
    <Modal open={!!target} onClose={() => close(null)} title="Log a mistake" width={620}>
      <p className="-mt-2 mb-5 text-[13px] text-muted">Write it down while it's fresh. Future you will review this weekly.</p>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Problem">
          <input className={inputClass} value={form.title} onChange={set('title')} />
        </Field>
        <Field label="Pattern">
          <input className={inputClass} value={form.pattern} onChange={set('pattern')} placeholder="e.g. Unbounded Knapsack" />
        </Field>
        <Field label="Mistake">
          <textarea rows={2} className={inputClass} value={form.mistake} onChange={set('mistake')} placeholder="e.g. forgot infinity init" />
        </Field>
        <Field label="Why I made it">
          <textarea rows={2} className={inputClass} value={form.why} onChange={set('why')} placeholder="e.g. assumed 0 was a safe default" />
        </Field>
        <Field label="Correct insight">
          <textarea rows={2} className={inputClass} value={form.insight} onChange={set('insight')} placeholder="e.g. unreachable amounts start at infinity" />
        </Field>
        <Field label="How to avoid it">
          <textarea rows={2} className={inputClass} value={form.avoid} onChange={set('avoid')} placeholder='e.g. ask "what does an unreachable state look like?"' />
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => close(null)}>Cancel</Button>
        <Button variant="primary" onClick={() => void save()} disabled={!form.title.trim() || !form.mistake.trim()}>
          Save to log
        </Button>
      </div>
    </Modal>
  )
}
