import { useState, useEffect, useRef } from 'react'
import appLogo from './assets/Square44x44Logo.targetsize-48.png'
import TodayView from './views/TodayView'
import HistoryView from './views/HistoryView'
import SettingsView from './views/SettingsView'
import ProjectsView from './views/ProjectsView'
import RecurringView from './views/RecurringView'
import WizardModal from './components/WizardModal'

function localDateString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Tab = 'today' | 'projects' | 'recurring' | 'history' | 'settings'
const MAIN_TABS: Tab[] = ['today', 'projects', 'recurring']

const TAB_LABELS: Record<Tab, string> = {
  today: 'Today',
  projects: 'Projects',
  recurring: '↺ Recurring',
  history: 'History',
  settings: 'Settings'
}

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [showWizard, setShowWizard] = useState(false)
  const [cogOpen, setCogOpen] = useState(false)
  const cogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.taskify.settings.get().then((s) => {
      setTheme(s.theme ?? 'dark')
      if (!s.wizardCompleted) setShowWizard(true)
    })
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    const handleFocus = () => {
      window.taskify.templates.generateToday(localDateString())
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  // Close cog dropdown when clicking outside
  useEffect(() => {
    if (!cogOpen) return
    const handler = (e: MouseEvent) => {
      if (cogRef.current && !cogRef.current.contains(e.target as Node)) {
        setCogOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [cogOpen])

  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    await window.taskify.settings.set('theme', next)
  }

  const navigateToTemplate = (_templateId: number) => {
    setTab('recurring')
  }

  const openCogItem = (t: 'history' | 'settings') => {
    setTab(t)
    setCogOpen(false)
  }

  return (
    <div className="flex flex-col h-full bg-canvas">
      {/* Top App Bar */}
      <header className="flex items-center px-4 pt-3 pb-2 shrink-0 bg-raised shadow-elev-1 z-10">
        <div className="flex items-center gap-2 flex-1">
          <img src={appLogo} className="shrink-0 w-7 h-7 rounded-md" alt="Taskify" />
          <span className="text-base font-semibold text-ink tracking-tight">Taskify</span>
        </div>

        <nav className="flex items-center gap-1 mr-2">
          {MAIN_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-pill text-xs font-medium transition-colors ${
                tab === t
                  ? 'bg-accent text-on-accent'
                  : 'text-muted hover:text-ink hover:bg-well'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </nav>

        {/* Cog wheel */}
        <div className="relative flex items-center gap-1" ref={cogRef}>
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-well text-muted hover:text-ink transition-colors text-base"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>

          <button
            onClick={() => setCogOpen((v) => !v)}
            title="More"
            className={`flex items-center gap-1 px-2 py-1 rounded-pill transition-colors text-xs font-medium ${
              cogOpen || tab === 'history' || tab === 'settings'
                ? 'bg-accent/10 text-accent'
                : 'hover:bg-well text-muted hover:text-ink'
            }`}
          >
            <span className="text-base leading-none">⚙</span>
            <span className={`transition-transform duration-150 ${cogOpen ? 'rotate-180' : ''}`}>▾</span>
          </button>

          {cogOpen && (
            <div className="absolute top-full right-0 mt-1 w-36 bg-raised border border-rim rounded-lg shadow-elev-1 overflow-hidden z-50">
              {(['history', 'settings'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => openCogItem(t)}
                  className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors hover:bg-hover ${
                    tab === t ? 'text-accent' : 'text-ink'
                  }`}
                >
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        {tab === 'today'     && <TodayView onNavigateToTemplate={navigateToTemplate} />}
        {tab === 'projects'  && <ProjectsView />}
        {tab === 'recurring' && <RecurringView />}
        {tab === 'history'   && <HistoryView />}
        {tab === 'settings'  && (
          <SettingsView
            onThemeChange={setTheme}
            onReopenWizard={() => setShowWizard(true)}
          />
        )}
      </main>

      {showWizard && (
        <WizardModal
          onComplete={() => setShowWizard(false)}
          onThemeChange={setTheme}
          currentTheme={theme}
        />
      )}
    </div>
  )
}
