import { CheckCircle2, RefreshCw, TriangleAlert } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { Platform, Settings as SettingsT, SyncResult, TrackId } from '@shared/types'
import { PLATFORMS, PLATFORM_LABEL } from '@shared/types'
import { Button, Card, CardTitle, Field, PageHeader, Segmented, Toggle, cx, inputClass } from '../components/ui'
import { useApp, useData } from '../lib/store'
import { timeAgo } from '../lib/problem'

export const TRACKS: { id: TrackId; name: string; blurb: string }[] = [
  { id: 'A', name: 'Foundation', blurb: '🟢🔵 problems only, core topics first. Build intuition before hards.' },
  { id: 'B', name: 'Placement', blurb: 'Every ★★★★+ problem (~143). Strong general placement prep.' },
  { id: 'C', name: 'MAANG', blurb: 'The complete 203-problem set, hards and advanced structures included.' }
]

const USERNAME_HINT: Record<Platform, string> = {
  leetcode: 'Public profile. The last 20 accepted problems sync automatically.',
  codeforces: 'Your handle. All accepted submissions and rating history sync.',
  atcoder: 'Your AtCoder ID. Submissions via AtCoder Problems.',
  gfg: 'Your GeeksforGeeks handle. Unofficial API, so it may occasionally fail.'
}

export function TrackPicker({ value, onChange }: { value: TrackId; onChange: (t: TrackId) => void }): ReactNode {
  return (
    <div className="grid grid-cols-3 gap-3">
      {TRACKS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cx('cursor-pointer rounded-2xl border p-4 text-left transition', value === t.id ? 'border-sage bg-sage-soft' : 'border-line hover:bg-bg-deep')}
        >
          <div className="font-serif text-[16px] font-semibold">Track {t.id} · {t.name}</div>
          <div className="mt-1 text-[12px] leading-relaxed text-muted">{t.blurb}</div>
        </button>
      ))}
    </div>
  )
}

export function Settings(): ReactNode {
  const settings = useApp((s) => s.settings)
  const save = useApp((s) => s.setSettings)
  const { data: platforms } = useData(() => window.api.getPlatforms())
  const [draft, setDraft] = useState<SettingsT | null>(settings)
  const [saved, setSaved] = useState(false)
  const [syncing, setSyncing] = useState<Platform | null>(null)
  const [results, setResults] = useState<Partial<Record<Platform, SyncResult>>>({})

  useEffect(() => setDraft(settings), [settings])
  if (!draft || !settings) return null

  const dirtyUsernames = PLATFORMS.some((p) => draft.usernames[p] !== settings.usernames[p]) || draft.lcSession !== settings.lcSession
  const commit = async (patch: Partial<SettingsT>): Promise<void> => {
    await save(patch)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }
  const syncOne = async (p: Platform): Promise<void> => {
    setSyncing(p)
    const [r] = await window.api.sync(p)
    setResults((x) => ({ ...x, [p]: r }))
    setSyncing(null)
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings" subtitle="Make the desk yours." action={saved ? <span className="text-[13px] text-sage-deep">Saved ✓</span> : null} />

      <Card className="mb-5">
        <CardTitle>You</CardTitle>
        <div className="grid grid-cols-2 gap-5">
          <Field label="What should we call you?">
            <input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onBlur={() => draft.name !== settings.name && void commit({ name: draft.name.trim() })} />
          </Field>
          <Field label="Theme">
            <Segmented
              value={draft.theme}
              onChange={(theme) => void commit({ theme })}
              options={[{ value: 'system', label: 'Follow system' }, { value: 'light', label: 'Paper' }, { value: 'dark', label: 'Night desk' }]}
            />
          </Field>
        </div>
      </Card>

      <Card className="mb-5">
        <CardTitle>Platforms</CardTitle>
        <div className="space-y-4">
          {PLATFORMS.map((p) => {
            const s = platforms?.find((x) => x.platform === p)
            const r = results[p]
            return (
              <div key={p} className="grid grid-cols-[140px_1fr_auto] items-start gap-4">
                <div className="pt-2.5 font-medium">{PLATFORM_LABEL[p]}</div>
                <Field label="" hint={USERNAME_HINT[p]}>
                  <input
                    className={inputClass}
                    placeholder="username"
                    value={draft.usernames[p]}
                    onChange={(e) => setDraft({ ...draft, usernames: { ...draft.usernames, [p]: e.target.value } })}
                  />
                </Field>
                <div className="flex min-w-[170px] flex-col items-end gap-1 pt-1">
                  <Button size="sm" variant="soft" disabled={!settings.usernames[p] || syncing === p} onClick={() => void syncOne(p)}>
                    <RefreshCw size={14} className={syncing === p ? 'animate-spin' : ''} /> Sync
                  </Button>
                  <span className={cx('text-right text-[11px]', (r && !r.ok) || s?.error ? 'text-peach-deep' : 'text-muted')}>
                    {r ? (
                      r.ok ? <><CheckCircle2 size={11} className="inline" /> {r.message}</> : <><TriangleAlert size={11} className="inline" /> {r.message}</>
                    ) : s?.error ? (
                      s.error
                    ) : s?.lastSync ? (
                      `synced ${timeAgo(s.lastSync)} · ${s.solved} solved`
                    ) : (
                      ''
                    )}
                  </span>
                </div>
              </div>
            )
          })}
          <details className="rounded-2xl bg-bg-deep/70 p-4 text-[13px]">
            <summary className="cursor-pointer font-medium text-ink-soft">Import your full LeetCode history (optional)</summary>
            <p className="mt-2 mb-3 leading-relaxed text-muted">
              LeetCode only shares your 20 most recent solves publicly. To import everything you’ve ever solved, paste your <code>LEETCODE_SESSION</code> cookie
              (browser DevTools → Application → Cookies → leetcode.com). It’s stored only on this computer and sent only to leetcode.com.
            </p>
            <input
              className={inputClass} type="password" placeholder="LEETCODE_SESSION value" value={draft.lcSession}
              onChange={(e) => setDraft({ ...draft, lcSession: e.target.value })}
            />
          </details>
          {dirtyUsernames && (
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => void commit({ usernames: trimAll(draft.usernames), lcSession: draft.lcSession.trim() })}>
                Save & sync
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card className="mb-5">
        <CardTitle>Study plan</CardTitle>
        <TrackPicker value={draft.track} onChange={(track) => void commit({ track })} />
        <div className="mt-5 grid grid-cols-2 gap-5">
          <Field label="Roadmap start date" hint="The 16-week roadmap counts weeks from here.">
            <input type="date" className={inputClass} value={draft.roadmapStart} onChange={(e) => e.target.value && void commit({ roadmapStart: e.target.value })} />
          </Field>
          <Field label="Daily goal" hint="Problems per day. The guide suggests 2–3.">
            <Segmented value={draft.dailyGoal} onChange={(dailyGoal) => void commit({ dailyGoal })} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} />
          </Field>
        </div>
      </Card>

      <AiSettings model={draft.aiModel} onModel={(aiModel) => void commit({ aiModel })} />

      <Card>
        <CardTitle>Reminders</CardTitle>
        <div className="grid grid-cols-2 gap-5">
          <Toggle label="Daily reminder" hint="A gentle notification if today's goal isn't met yet. Closing the window keeps DSA Desk in the tray." checked={draft.reminders} onChange={(reminders) => void commit({ reminders })} />
          <Field label="Remind me at">
            <input type="time" className={inputClass} value={draft.reminderTime} disabled={!draft.reminders} onChange={(e) => e.target.value && void commit({ reminderTime: e.target.value })} />
          </Field>
          <Toggle label="Launch at startup" hint="Starts quietly in the tray when you log in (installed app only)." checked={draft.launchAtStartup} onChange={(launchAtStartup) => void commit({ launchAtStartup })} />
        </div>
      </Card>
    </div>
  )
}

const DEFAULT_AI_MODEL = 'gemini-3.6-flash'

function AiSettings({ model, onModel }: { model: string; onModel: (m: string) => void }): ReactNode {
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [key, setKey] = useState('')
  const [modelDraft, setModelDraft] = useState(model)

  useEffect(() => void window.api.hasAiKey().then(setHasKey), [])
  useEffect(() => setModelDraft(model), [model])

  const saveKey = async (k: string): Promise<void> => {
    await window.api.setAiKey(k)
    setKey('')
    setHasKey(!!k.trim())
  }

  return (
    <Card className="mb-5">
      <CardTitle>AI help</CardTitle>
      <p className="mb-4 text-[13px] leading-relaxed text-muted">
        Focus mode can explain a problem, give a small hint or walk through the approach (never code) using Google Gemini. Get a free key at{' '}
        <button className="cursor-pointer text-sage-deep underline" onClick={() => void window.api.openExternal('https://aistudio.google.com/apikey')}>
          aistudio.google.com/apikey
        </button>
        . The key is stored encrypted on this computer. On the free tier, Google may use prompts to improve its models.
      </p>
      <div className="grid grid-cols-2 gap-5">
        <Field label="Gemini API key" hint={hasKey ? <span className="text-sage-deep">Key saved ✓</span> : 'Not set'}>
          <div className="flex gap-2">
            <input
              className={inputClass} type="password" placeholder={hasKey ? '••••••••  (paste to replace)' : 'Paste your key'} value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <Button variant="primary" disabled={!key.trim()} onClick={() => void saveKey(key)}>Save</Button>
            {hasKey && <Button variant="ghost" onClick={() => void saveKey('')}>Remove</Button>}
          </div>
        </Field>
        <Field label="Model" hint="Change this if Gemini says the model doesn't exist or you hit free-tier limits.">
          <input
            className={inputClass} value={modelDraft} placeholder={DEFAULT_AI_MODEL}
            onChange={(e) => setModelDraft(e.target.value)}
            onBlur={() => {
              const m = modelDraft.trim() || DEFAULT_AI_MODEL
              setModelDraft(m)
              if (m !== model) onModel(m)
            }}
          />
        </Field>
      </div>
    </Card>
  )
}

function trimAll(u: Record<Platform, string>): Record<Platform, string> {
  return Object.fromEntries(Object.entries(u).map(([k, v]) => [k, v.trim()])) as Record<Platform, string>
}
