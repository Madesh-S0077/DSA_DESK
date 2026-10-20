import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Coffee } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { Platform, TrackId } from '@shared/types'
import { PLATFORMS, PLATFORM_LABEL } from '@shared/types'
import { Button, Field, Segmented, inputClass } from './ui'
import { TrackPicker } from '../pages/Settings'
import { useApp } from '../lib/store'

/** First-run welcome: name → platforms → plan. Everything can be changed later in Settings. */
export function Onboarding(): ReactNode {
  const settings = useApp((s) => s.settings)
  const save = useApp((s) => s.setSettings)
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [usernames, setUsernames] = useState<Record<Platform, string>>({ leetcode: '', codeforces: '', atcoder: '', gfg: '' })
  const [track, setTrack] = useState<TrackId>('B')
  const [goal, setGoal] = useState(3)

  if (!settings || settings.onboarded) return null

  const finish = async (): Promise<void> => {
    const trimmed = Object.fromEntries(Object.entries(usernames).map(([k, v]) => [k, v.trim()])) as Record<Platform, string>
    await save({ name: name.trim(), usernames: trimmed, track, dailyGoal: goal, onboarded: true })
  }

  const steps = [
    <div key="hi">
      <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-sage text-white shadow-soft">
        <Coffee size={26} />
      </div>
      <h1 className="font-serif text-[34px] leading-tight font-semibold">Welcome to your study desk</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        One calm place for your DSA prep: a problem of the day, what to try next, revision that comes back at the right time, and your progress across every platform.
      </p>
      <div className="mt-7">
        <Field label="What should we call you?">
          <input autoFocus className={inputClass} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setStep(1)} />
        </Field>
      </div>
    </div>,
    <div key="platforms">
      <h1 className="font-serif text-[28px] font-semibold">Where do you practise?</h1>
      <p className="mt-2 text-[14px] text-muted">Add the ones you use. Solves sync automatically and count towards your streak. Skip any you don’t use.</p>
      <div className="mt-6 space-y-3">
        {PLATFORMS.map((p) => (
          <div key={p} className="grid grid-cols-[140px_1fr] items-center gap-3">
            <span className="font-medium">{PLATFORM_LABEL[p]}</span>
            <input className={inputClass} placeholder="username" value={usernames[p]} onChange={(e) => setUsernames({ ...usernames, [p]: e.target.value })} />
          </div>
        ))}
      </div>
    </div>,
    <div key="plan">
      <h1 className="font-serif text-[28px] font-semibold">Pick your track</h1>
      <p className="mt-2 mb-6 text-[14px] text-muted">From your DSA Prep Guide. Recommendations stay inside this track.</p>
      <TrackPicker value={track} onChange={setTrack} />
      <div className="mt-6">
        <Field label="Daily goal (problems per day)">
          <Segmented value={goal} onChange={setGoal} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} />
        </Field>
      </div>
    </div>
  ]

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg p-8">
      <div className="w-full max-w-2xl">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
            {steps[step]}
          </motion.div>
        </AnimatePresence>
        <div className="mt-9 flex items-center justify-between">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-sage' : 'w-1.5 bg-line'}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>Back</Button>}
            {step < steps.length - 1 ? (
              <Button variant="primary" onClick={() => setStep(step + 1)}>
                Continue <ArrowRight size={16} />
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void finish()}>
                Open my desk <ArrowRight size={16} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
