import { useState, useEffect } from 'react'
import appLogo from './assets/Square44x44Logo.targetsize-48.png'
import TodayView from './views/TodayView'
import HistoryView from './views/HistoryView'
import SettingsView from './views/SettingsView'
import ProjectsView from './views/ProjectsView'
import WizardModal from './components/WizardModal'

type Tab = 'today' | 'projects' | 'history' | 'settings'

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [showWizard, setShowWizard] = useState(false)

  useEffect(() => {
    window.taskify.settings.get().then((s) => {
      setTheme(s.theme ?? 'dark')
      if (!s.wizardCompleted) setShowWizard(true)
    })
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Generate recurring tasks on window focus
  useEffect(() => {
    const handleFocus = () => {
      const today = new Date().toISOString().slice(0, 10)
      window.taskify.templates.generateToday(today)
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    await window.taskify.settings.set('theme', next)
  }

  const navigateToTemplate = (_templateId: number) => {
    setTab('projects')
    // The RecurringTab within ProjectsView handles display
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
          {(['today', 'projects', 'history', 'settings'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-pill text-xs font-medium transition-colors ${
                tab === t
                  ? 'bg-accent text-on-accent'
                  : 'text-muted hover:text-ink hover:bg-well'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>

        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-well text-muted hover:text-ink transition-colors text-base"
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </header>

      <main className="flex-1 overflow-hidden">
        {tab === 'today'    && <TodayView onNavigateToTemplate={navigateToTemplate} />}
        {tab === 'projects' && <ProjectsView />}
        {tab === 'history'  && <HistoryView />}
        {tab === 'settings' && (
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
