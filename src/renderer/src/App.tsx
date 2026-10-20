import { useEffect, type ReactNode } from 'react'
import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar, useDarkMode } from './components/Sidebar'
import { SolveDialog, MistakeDialog } from './components/Dialogs'
import { FocusMode } from './components/FocusMode'
import { Celebrate } from './components/Celebrate'
import { Onboarding } from './components/Onboarding'
import { Dashboard } from './pages/Dashboard'
import { Today } from './pages/Today'
import { Sheet } from './pages/Sheet'
import { Revision } from './pages/Revision'
import { Mistakes } from './pages/Mistakes'
import { Stats } from './pages/Stats'
import { Settings } from './pages/Settings'
import { useApp } from './lib/store'

function Shell(): ReactNode {
  const navigate = useNavigate()
  const location = useLocation()
  useDarkMode()
  useEffect(() => window.api.onNavigate((path) => navigate(path)), [navigate])
  return (
    <div className="flex h-full">
      <Sidebar />
      <main key={location.pathname} className="relative z-10 min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1180px] px-10 py-9">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/today" element={<Today />} />
            <Route path="/sheet" element={<Sheet />} />
            <Route path="/revision" element={<Revision />} />
            <Route path="/mistakes" element={<Mistakes />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </main>
      <SolveDialog />
      <MistakeDialog />
      <FocusMode />
      <Celebrate />
      <Onboarding />
    </div>
  )
}

export function App(): ReactNode {
  const ready = useApp((s) => !!s.guide && !!s.settings)
  const init = useApp((s) => s.init)
  useEffect(() => void init(), [init])
  if (!ready) return <div className="grid h-full place-items-center font-serif text-muted">brewing…</div>
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
