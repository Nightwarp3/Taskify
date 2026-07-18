import { useState, useEffect } from 'react'
import type { AppSettings, UpdateState } from '../../../shared/types'

interface Props {
  onThemeChange: (theme: 'light' | 'dark') => void
  onReopenWizard: () => void
}

const inputCls =
  'bg-well border border-rim rounded-md px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent transition-colors'

export default function SettingsView({ onThemeChange, onReopenWizard }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace')
  const [includeSettings, setIncludeSettings] = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [mcpUrlCopied, setMcpUrlCopied] = useState(false)
  const [updateState, setUpdateState] = useState<UpdateState | null>(null)

  useEffect(() => {
    window.taskify.settings.get().then(setSettings)
    window.taskify.updates.getState().then(setUpdateState)
    const off = window.taskify.on('updates:state', (value) => {
      setUpdateState(value as UpdateState)
    })
    return off
  }, [])

  const update = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    await window.taskify.settings.set(key, value)
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
    if (key === 'theme') onThemeChange(value as 'light' | 'dark')
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const handleExport = async () => {
    await window.taskify.data.export()
  }

  const handleImport = async () => {
    setImportStatus(null)
    const result = await window.taskify.data.import({ mode: importMode, includeSettings })
    if (result.ok && result.imported) {
      setImportStatus(
        `Imported ${result.imported.tasks} tasks, ${result.imported.projects} projects, ${result.imported.templates} templates`
      )
    } else if (!result.ok) {
      setImportStatus(result.error ? `Error: ${result.error}` : 'Import cancelled')
    }
  }

  const copyMcpUrl = () => {
    if (!settings) return
    const url = `http://localhost:${settings.mcpPort}/sse`
    navigator.clipboard.writeText(JSON.stringify({
      mcpServers: { taskify: { url } }
    }, null, 2))
    setMcpUrlCopied(true)
    setTimeout(() => setMcpUrlCopied(false), 2000)
  }

  const reopenWizard = async () => {
    await window.taskify.settings.set('wizardCompleted', false)
    setSettings((prev) => (prev ? { ...prev, wizardCompleted: false } : prev))
    onReopenWizard()
  }

  const checkForUpdates = async () => {
    const result = await window.taskify.updates.checkNow()
    setUpdateState(result)
  }

  const installUpdate = async () => {
    await window.taskify.updates.installNow()
  }

  const updateMessage = updateState?.message ?? 'Updates are checked automatically when the packaged app starts.'
  const updateBusy = updateState?.status === 'checking' || updateState?.status === 'downloading'

  if (!settings) return <div className="p-4 text-sm text-ghost">Loading…</div>

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <h2 className="text-sm font-semibold text-ink">Settings</h2>

      {/* Theme */}
      <div className="bg-raised rounded-lg border border-rim p-3 shadow-elev-1">
        <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Appearance</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-ink font-medium">Theme</div>
            <div className="text-xs text-ghost mt-0.5">Light or dark display</div>
          </div>
          <div className="flex rounded-pill border border-rim overflow-hidden text-xs font-medium">
            {(['light', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => update('theme', t)}
                className={`px-3 py-1.5 transition-colors capitalize ${
                  settings.theme === t
                    ? 'bg-accent text-on-accent'
                    : 'text-muted hover:text-ink hover:bg-well'
                }`}
              >
                {t === 'light' ? '☀ Light' : '☾ Dark'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Schedule */}
      <div className="bg-raised rounded-lg border border-rim p-3 shadow-elev-1">
        <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Schedule</div>
        <div className="space-y-3">
          <Field label="Start of day" hint="Used to anchor check-in scheduling">
            <input
              type="time"
              value={settings.startOfDayTime}
              onChange={(e) => update('startOfDayTime', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="End of day reminder" hint="Notification fires if you have incomplete tasks">
            <input
              type="time"
              value={settings.endOfDayTime}
              onChange={(e) => update('endOfDayTime', e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      </div>

      {/* Check-ins */}
      <div className="bg-raised rounded-lg border border-rim p-3 shadow-elev-1">
        <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Check-ins</div>
        <Field label="Default interval" hint="Minutes between progress check-ins for timed tasks">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={5}
              max={120}
              value={settings.defaultCheckInInterval}
              onChange={(e) => update('defaultCheckInInterval', parseInt(e.target.value, 10))}
              className={`${inputCls} w-20`}
            />
            <span className="text-xs text-ghost">min</span>
          </div>
        </Field>
      </div>

      {/* Window close behavior */}
      <div className="bg-raised rounded-lg border border-rim p-3 shadow-elev-1">
        <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Window</div>
        <Field label="On close" hint="Choose whether the app hides to the tray or exits completely">
          <div className="flex rounded-pill border border-rim overflow-hidden text-xs font-medium">
            {([
              ['background', 'Keep running'],
              ['exit', 'Exit completely']
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => update('closeBehavior', value)}
                className={`px-3 py-1.5 transition-colors ${
                  settings.closeBehavior === value
                    ? 'bg-accent text-on-accent'
                    : 'text-muted hover:text-ink hover:bg-well'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
      </div>

      {/* Updates */}
      {import.meta.env.VITE_PLATFORM !== 'capacitor' && (
        <div className="bg-raised rounded-lg border border-rim p-3 shadow-elev-1">
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Updates</div>
          <div className="space-y-3">
            <Field label="Current version" hint={updateMessage}>
              <span className="text-xs font-medium text-ink">
                v{updateState?.currentVersion ?? '...'}
              </span>
            </Field>

            {updateState?.progress != null && updateState.status === 'downloading' && (
              <div className="h-1.5 overflow-hidden rounded-full bg-well">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, updateState.progress))}%` }}
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={checkForUpdates}
                disabled={updateBusy || updateState?.status === 'disabled'}
                className="text-xs px-3 py-1.5 bg-well hover:bg-hover disabled:opacity-50 disabled:hover:bg-well border border-rim rounded-md font-medium text-ink transition-colors"
              >
                {updateBusy ? 'Checking...' : 'Check for updates'}
              </button>

              {updateState?.status === 'downloaded' && (
                <button
                  onClick={installUpdate}
                  className="text-xs px-3 py-1.5 bg-accent hover:opacity-90 rounded-md font-medium text-on-accent transition-opacity"
                >
                  Restart to update
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Data — Import / Export */}
      <div className="bg-raised rounded-lg border border-rim p-3 shadow-elev-1">
        <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Data</div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-ink font-medium">Export all data</div>
              <div className="text-xs text-ghost mt-0.5">Save a JSON backup of all tasks, projects, and templates</div>
            </div>
            <button
              onClick={handleExport}
              className="text-xs px-3 py-1.5 bg-well hover:bg-hover border border-rim rounded-md font-medium text-ink transition-colors shrink-0"
            >
              Export JSON
            </button>
          </div>

          <div className="pt-2 border-t border-rim">
            <div className="text-sm text-ink font-medium mb-1">Import from file</div>
            <div className="text-xs text-ghost mb-2">Restore or merge data from a Taskify export file</div>

            <div className="space-y-2 mb-2">
              <div className="flex gap-3">
                {(['replace', 'append'] as const).map((m) => (
                  <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === m}
                      onChange={() => setImportMode(m)}
                      className="accent-accent"
                    />
                    <span className="text-xs text-ink capitalize">{m}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-ghost">
                {importMode === 'replace'
                  ? 'Replaces all existing tasks, projects, and templates.'
                  : 'Appends tasks only, remapping IDs to avoid collisions.'}
              </p>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSettings}
                  onChange={(e) => setIncludeSettings(e.target.checked)}
                  className="accent-accent"
                />
                <span className="text-xs text-ink">Also restore settings</span>
              </label>
            </div>

            <button
              onClick={handleImport}
              className="text-xs px-3 py-1.5 bg-well hover:bg-hover border border-rim rounded-md font-medium text-ink transition-colors"
            >
              Import JSON
            </button>

            {importStatus && (
              <div className={`mt-2 text-xs ${importStatus.startsWith('Error') ? 'text-danger' : 'text-accent'}`}>
                {importStatus}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MCP Server — desktop only */}
      {import.meta.env.VITE_PLATFORM !== 'capacitor' && <div className="bg-raised rounded-lg border border-rim p-3 shadow-elev-1">
        <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">MCP Server</div>
        <div className="space-y-3">
          <Field label="Enable MCP server" hint="Expose Taskify to local AI agents (Claude Desktop, etc.)">
            <button
              onClick={() => update('mcpEnabled', !settings.mcpEnabled)}
              className={`text-xs px-3 py-1.5 rounded-pill font-medium transition-colors ${
                settings.mcpEnabled
                  ? 'bg-accent text-on-accent'
                  : 'bg-well text-muted border border-rim hover:bg-hover'
              }`}
            >
              {settings.mcpEnabled ? 'On' : 'Off'}
            </button>
          </Field>

          <Field label="Port" hint="Restart app after changing port">
            <input
              type="number"
              min={1024}
              max={65535}
              value={settings.mcpPort}
              onChange={(e) => update('mcpPort', parseInt(e.target.value, 10))}
              className={`${inputCls} w-24`}
            />
          </Field>

          {settings.mcpEnabled && (
            <div>
              <div className="text-xs text-ghost mb-1">
                SSE endpoint: <code className="bg-well px-1 rounded text-ink">http://localhost:{settings.mcpPort}/sse</code>
              </div>
              <button
                onClick={copyMcpUrl}
                className="text-xs px-3 py-1.5 bg-well hover:bg-hover border border-rim rounded-md font-medium text-ink transition-colors"
              >
                {mcpUrlCopied ? 'Copied ✓' : 'Copy Claude Desktop config'}
              </button>
            </div>
          )}
        </div>
      </div>}

      {saved && (
        <div className="flex items-center gap-1.5 text-xs text-accent font-medium">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7l3 3 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Saved
        </div>
      )}

      <div className="pt-2 border-t border-rim space-y-2">
        <button
          onClick={reopenWizard}
          className="text-xs text-ghost hover:text-muted transition-colors"
        >
          Rerun setup wizard
        </button>
        <div className="text-xs text-ghost">v{updateState?.currentVersion ?? '...'}</div>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm text-ink font-medium">{label}</div>
        <div className="text-xs text-ghost mt-0.5">{hint}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
