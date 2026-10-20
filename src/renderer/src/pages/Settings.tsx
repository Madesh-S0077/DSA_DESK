import { CheckCircle2, RefreshCw, TriangleAlert } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { Platform, Settings as SettingsT, SyncResult, TrackId } from '@shared/types'
import { PLATFORMS, PLATFORM_LABEL } from '@shared/types'
import { Button, Card, CardTitle, Field, PageHeader, Segmented, cx, inputClass } from '../components/ui'
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

function trimAll(u: Record<Platform, string>): Record<Platform, string> {
  return Object.fromEntries(Object.entries(u).map(([k, v]) => [k, v.trim()])) as Record<Platform, string>
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }): ReactNode {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-6 w-11 shrink-0 cursor-pointer rounded-full transition', checked ? 'bg-sage' : 'bg-line')}
      >
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
      <div>
        <div className="text-[14px] font-medium">{label}</div>
        <div className="mt-0.5 text-[12px] text-muted">{hint}</div>
      </div>
    </div>
  )
}
