/** Port of src/renderer/src/views/SettingsView.tsx (MCP section dropped — desktop-only). */
import { useState, useEffect } from 'react'
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native'
import type { AppSettings } from '@shared/types'
import { useTaskify } from '../providers/TaskifyProvider'
import TimeField from '../components/TimeField'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-raised rounded-lg border border-rim p-3">
      <Text className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">{title}</Text>
      {children}
    </View>
  )
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <View className="flex-1">
        <Text className="text-sm text-ink font-medium">{label}</Text>
        <Text className="text-xs text-ghost mt-0.5">{hint}</Text>
      </View>
      <View className="shrink-0">{children}</View>
    </View>
  )
}

export default function SettingsScreen({ onReopenWizard }: { onReopenWizard: () => void }) {
  const { api, theme, setTheme } = useTaskify()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saved, setSaved] = useState(false)
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace')
  const [includeSettings, setIncludeSettings] = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)

  useEffect(() => { api.settings.get().then(setSettings) }, [api])

  const update = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (key === 'theme') setTheme(value as 'light' | 'dark')
    else await api.settings.set(key, value)
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const handleImport = async () => {
    setImportStatus(null)
    const result = await api.data.import({ mode: importMode, includeSettings })
    if (result.ok && result.imported) {
      setImportStatus(`Imported ${result.imported.tasks} tasks, ${result.imported.projects} projects, ${result.imported.templates} templates`)
    } else if (!result.ok) {
      setImportStatus(result.error ? `Error: ${result.error}` : 'Import cancelled')
    }
  }

  const reopenWizard = async () => {
    await api.settings.set('wizardCompleted', false)
    setSettings((prev) => (prev ? { ...prev, wizardCompleted: false } : prev))
    onReopenWizard()
  }

  if (!settings) return <View className="flex-1 bg-canvas p-4"><Text className="text-sm text-ghost">Loading…</Text></View>

  return (
    <ScrollView className="flex-1 bg-canvas" contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
      <Text className="text-sm font-semibold text-ink">Settings</Text>

      <Section title="Appearance">
        <Field label="Theme" hint="Light or dark display">
          <View className="flex-row rounded-pill border border-rim overflow-hidden">
            {(['light', 'dark'] as const).map((t) => (
              <Pressable key={t} onPress={() => update('theme', t)} className={`px-3 py-1.5 ${theme === t ? 'bg-accent' : ''}`}>
                <Text className={`text-xs font-medium ${theme === t ? 'text-on-accent' : 'text-muted'}`}>
                  {t === 'light' ? '☀ Light' : '☾ Dark'}
                </Text>
              </Pressable>
            ))}
          </View>
        </Field>
      </Section>

      <Section title="Schedule">
        <View className="gap-3">
          <Field label="Start of day" hint="Used to anchor check-in scheduling">
            <TimeField value={settings.startOfDayTime} onChange={(v) => update('startOfDayTime', v)} />
          </Field>
          <Field label="End of day reminder" hint="Notification fires if you have incomplete tasks">
            <TimeField value={settings.endOfDayTime} onChange={(v) => update('endOfDayTime', v)} />
          </Field>
        </View>
      </Section>

      <Section title="Check-ins">
        <Field label="Default interval" hint="Minutes between progress check-ins for timed tasks">
          <View className="flex-row items-center gap-2">
            <TextInput
              value={String(settings.defaultCheckInInterval)}
              onChangeText={(v) => update('defaultCheckInInterval', parseInt(v, 10) || 0)}
              keyboardType="number-pad"
              className="bg-well border border-rim rounded-md px-2.5 py-1.5 text-sm text-ink w-20"
            />
            <Text className="text-xs text-ghost">min</Text>
          </View>
        </Field>
      </Section>

      <Section title="Data">
        <View className="gap-3">
          <Field label="Export all data" hint="Save a JSON backup of all tasks, projects, and templates">
            <Pressable onPress={() => api.data.export()} className="px-3 py-1.5 bg-well border border-rim rounded-md">
              <Text className="text-xs font-medium text-ink">Export JSON</Text>
            </Pressable>
          </Field>

          <View className="pt-2 border-t border-rim">
            <Text className="text-sm text-ink font-medium mb-1">Import from file</Text>
            <Text className="text-xs text-ghost mb-2">Restore or merge data from a Taskify export file</Text>

            <View className="flex-row gap-4 mb-2">
              {(['replace', 'append'] as const).map((m) => (
                <Pressable key={m} onPress={() => setImportMode(m)} className="flex-row items-center gap-1.5">
                  <View className={`w-4 h-4 rounded-full border-2 items-center justify-center ${importMode === m ? 'border-accent' : 'border-rim'}`}>
                    {importMode === m && <View className="w-2 h-2 rounded-full bg-accent" />}
                  </View>
                  <Text className="text-xs text-ink capitalize">{m}</Text>
                </Pressable>
              ))}
            </View>
            <Text className="text-xs text-ghost mb-2">
              {importMode === 'replace'
                ? 'Replaces all existing tasks, projects, and templates.'
                : 'Appends tasks only, remapping IDs to avoid collisions.'}
            </Text>
            <Pressable onPress={() => setIncludeSettings((v) => !v)} className="flex-row items-center gap-1.5 mb-3">
              <View className={`w-4 h-4 rounded border-2 items-center justify-center ${includeSettings ? 'border-accent bg-accent' : 'border-rim'}`}>
                {includeSettings && <Text className="text-white text-xs leading-none">✓</Text>}
              </View>
              <Text className="text-xs text-ink">Also restore settings</Text>
            </Pressable>

            <Pressable onPress={handleImport} className="px-3 py-1.5 bg-well border border-rim rounded-md self-start">
              <Text className="text-xs font-medium text-ink">Import JSON</Text>
            </Pressable>
            {importStatus && (
              <Text className={`mt-2 text-xs ${importStatus.startsWith('Error') ? 'text-danger' : 'text-accent'}`}>{importStatus}</Text>
            )}
          </View>
        </View>
      </Section>

      {saved && <Text className="text-xs text-accent font-medium">Saved ✓</Text>}

      <View className="pt-2 border-t border-rim gap-2">
        <Pressable onPress={reopenWizard}><Text className="text-xs text-ghost">Rerun setup wizard</Text></Pressable>
        <Text className="text-xs text-ghost">v0.0.8</Text>
      </View>
    </ScrollView>
  )
}
