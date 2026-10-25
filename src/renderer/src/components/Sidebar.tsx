import { NavLink } from 'react-router-dom'
import {
  BarChart3, BookOpenText, Building2, CloudRain, Coffee, Flag, LayoutDashboard, Moon, NotebookPen, PanelLeftClose, PanelLeftOpen,
  RefreshCw, Repeat, Settings as SettingsIcon, Sun, Volume2, VolumeX
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { cx } from './ui'
import { useApp } from '../lib/store'
import { playAmbient, stopAmbient, type AmbientKind } from '../lib/ambient'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/today', label: 'Today', icon: Coffee },
  { to: '/sheet', label: 'Problem Sheet', icon: BookOpenText },
  { to: '/revision', label: 'Revision', icon: Repeat },
  { to: '/companies', label: 'Company Prep', icon: Building2 },
  { to: '/contests', label: 'Contests', icon: Flag },
  { to: '/mistakes', label: 'Mistake Log', icon: NotebookPen },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: SettingsIcon }
]

function readPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v == null ? fallback : (JSON.parse(v) as T)
  } catch {
    return fallback
  }
}

function writePref(key: string, v: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* preferences are best-effort */
  }
}

export function Sidebar(): ReactNode {
  const [collapsed, setCollapsed] = useState(() => readPref('sidebar-collapsed', false))
  const [ambient, setAmbient] = useState<AmbientKind | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const settings = useApp((s) => s.settings)
  const setSettings = useApp((s) => s.setSettings)
  const dark = useDarkMode()

  useEffect(() => writePref('sidebar-collapsed', collapsed), [collapsed])
  useEffect(() => () => stopAmbient(), [])

  const toggleAmbient = (kind: AmbientKind): void => {
    if (ambient === kind) {
      stopAmbient()
      setAmbient(null)
    } else {
      playAmbient(kind)
      setAmbient(kind)
    }
  }

  const sync = async (): Promise<void> => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await window.api.sync()
      if (!res.length) setSyncMsg('Add usernames in Settings')
      else {
        const failed = res.filter((r) => !r.ok)
        const added = res.reduce((a, r) => a + r.added, 0)
        setSyncMsg(failed.length ? `${failed.length} failed · ${added} new` : added ? `${added} new solves` : 'All up to date')
      }
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(null), 4000)
    }
  }

  const item = 'flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] transition'
  return (
    <aside className={cx('relative z-10 flex shrink-0 flex-col border-r border-line bg-bg-deep/60 px-3 py-5 transition-[width] duration-300', collapsed ? 'w-[68px]' : 'w-[232px]')}>
      <div className={cx('mb-7 flex items-center gap-2.5 px-2', collapsed && 'justify-center px-0')}>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sage text-white shadow-soft">
          <Coffee size={18} />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <div className="font-serif text-[17px] font-semibold">DSA Desk</div>
            <div className="text-[11px] text-muted">study, steadily</div>
          </div>
        )}
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cx(item, collapsed && 'justify-center px-0', isActive ? 'bg-card font-medium text-ink shadow-soft' : 'text-ink-soft hover:bg-card/60')
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} className={isActive ? 'text-sage-deep' : 'text-muted'} />
                {!collapsed && label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-1">
        {!collapsed && <div className="px-3 pb-1 text-[11px] font-medium tracking-wide text-muted uppercase">Ambience</div>}
        <SideButton collapsed={collapsed} active={ambient === 'rain'} onClick={() => toggleAmbient('rain')} icon={<CloudRain size={18} />} label="Soft rain" />
        <SideButton
          collapsed={collapsed} active={ambient === 'brown'} onClick={() => toggleAmbient('brown')}
          icon={ambient === 'brown' ? <Volume2 size={18} /> : <VolumeX size={18} />} label="Brown noise"
        />
        <div className="my-2 border-t border-line" />
        <SideButton
          collapsed={collapsed}
          onClick={() => settings && void setSettings({ theme: dark ? 'light' : 'dark' })}
          icon={dark ? <Sun size={18} /> : <Moon size={18} />}
          label={dark ? 'Paper mode' : 'Night desk'}
        />
        <SideButton
          collapsed={collapsed} onClick={() => void sync()} disabled={syncing}
          icon={<RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />}
          label={syncing ? 'Syncing…' : (syncMsg ?? 'Sync platforms')}
        />
        <SideButton
          collapsed={collapsed} onClick={() => setCollapsed(!collapsed)}
          icon={collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />} label="Collapse"
        />
      </div>
    </aside>
  )
}

function SideButton({
  icon, label, onClick, active, collapsed, disabled
}: { icon: ReactNode; label: string; onClick: () => void; active?: boolean; collapsed: boolean; disabled?: boolean }): ReactNode {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={collapsed ? label : undefined}
      className={cx(
        'flex h-9 cursor-pointer items-center gap-3 rounded-xl px-3 text-[13px] transition',
        collapsed && 'justify-center px-0',
        active ? 'bg-sage-soft text-sage-deep' : 'text-ink-soft hover:bg-card/60'
      )}
    >
      <span className={active ? '' : 'text-muted'}>{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  )
}

/** Resolves the theme setting (incl. "system") to whether dark mode is on, and applies the class. */
export function useDarkMode(): boolean {
  const theme = useApp((s) => s.settings?.theme ?? 'system')
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = (e: MediaQueryListEvent): void => setSystemDark(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const dark = theme === 'dark' || (theme === 'system' && systemDark)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])
  return dark
}
