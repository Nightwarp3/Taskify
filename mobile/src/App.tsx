import '../global.css'
import { useEffect, useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import { TaskifyProvider, useTaskify } from './providers/TaskifyProvider'
import { colorsFor } from './lib/theme'
import RootNavigator from './navigation/RootNavigator'
import WizardModal from './components/WizardModal'

function Root() {
  const { theme, wizardCompleted } = useTaskify()
  const [showWizard, setShowWizard] = useState(false)
  const c = colorsFor(theme)

  // Open the wizard on first run (when storage reports it isn't completed yet).
  useEffect(() => { if (!wizardCompleted) setShowWizard(true) }, [wizardCompleted])

  const navTheme = {
    ...(theme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme === 'dark' ? DarkTheme : DefaultTheme).colors,
      background: c.canvas,
      card: c.raised,
      text: c.ink,
      border: c.rim,
      primary: c.accent
    }
  }

  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <NavigationContainer theme={navTheme}>
        <RootNavigator onReopenWizard={() => setShowWizard(true)} />
      </NavigationContainer>
      <WizardModal visible={showWizard} onComplete={() => setShowWizard(false)} />
    </>
  )
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TaskifyProvider>
          <Root />
        </TaskifyProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
