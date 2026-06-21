/**
 * Async-initializes the mobile storage/notification stack, then exposes the
 * TaskifyAPI plus theme state to the tree. Also owns native system-bar sync
 * (replacing the Capacitor syncSystemBars) and recurring-task regeneration on
 * app resume (replacing the desktop window focus listener).
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, Platform, View } from 'react-native'
import * as NavigationBar from 'expo-navigation-bar'
import { useColorScheme } from 'nativewind'
import { taskify, initTaskify, regenerateOnResume, type TaskifyAPI } from '../lib/api'
import { barColors } from '../lib/theme'

type Theme = 'light' | 'dark'

interface TaskifyContextValue {
  api: TaskifyAPI
  theme: Theme
  setTheme: (t: Theme) => void
  wizardCompleted: boolean
  setWizardCompleted: (v: boolean) => void
}

const TaskifyContext = createContext<TaskifyContextValue | null>(null)

export function useTaskify(): TaskifyContextValue {
  const ctx = useContext(TaskifyContext)
  if (!ctx) throw new Error('useTaskify must be used within TaskifyProvider')
  return ctx
}

/** Convenience accessor mirroring the renderer's window.taskify usage. */
export function useTaskifyApi(): TaskifyAPI {
  return useTaskify().api
}

async function syncSystemBars(theme: Theme): Promise<void> {
  if (Platform.OS !== 'android') return
  const c = theme === 'dark' ? barColors.dark : barColors.light
  try {
    await NavigationBar.setBackgroundColorAsync(c.nav)
    await NavigationBar.setButtonStyleAsync(theme === 'dark' ? 'light' : 'dark')
  } catch { /* ignore */ }
}

export function TaskifyProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [theme, setThemeState] = useState<Theme>('dark')
  const [wizardCompleted, setWizardCompleted] = useState(true)
  const { setColorScheme } = useColorScheme()
  const appState = useRef(AppState.currentState)

  // One-time startup.
  useEffect(() => {
    let active = true
    ;(async () => {
      await initTaskify()
      const s = await taskify.settings.get()
      if (!active) return
      setThemeState(s.theme ?? 'dark')
      setWizardCompleted(s.wizardCompleted)
      setReady(true)
    })()
    return () => { active = false }
  }, [])

  // Drive NativeWind dark class + native bars from theme.
  useEffect(() => {
    setColorScheme(theme)
    syncSystemBars(theme)
  }, [theme, setColorScheme])

  // React to theme changes emitted by api.settings.set.
  useEffect(() => {
    return taskify.on('theme:changed', (value) => setThemeState((value as Theme) ?? 'dark'))
  }, [])

  // Regenerate recurring tasks when the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        regenerateOnResume()
      }
      appState.current = next
    })
    return () => sub.remove()
  }, [])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    taskify.settings.set('theme', t)
  }

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-canvas">
        <ActivityIndicator size="large" color="#2979FF" />
      </View>
    )
  }

  return (
    <TaskifyContext.Provider value={{ api: taskify, theme, setTheme, wizardCompleted, setWizardCompleted }}>
      {children}
    </TaskifyContext.Provider>
  )
}
