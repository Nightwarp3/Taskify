/**
 * Navigation shell. Bottom tabs (Today / Projects / Recurring) mirror the
 * desktop main tabs; History and Settings live in the stack and are reached via
 * header buttons (the mobile equivalent of the desktop cog menu). The header
 * also hosts the theme toggle.
 */
import { Text, Pressable, View } from 'react-native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useTaskify } from '../providers/TaskifyProvider'
import { colorsFor } from '../lib/theme'
import TodayScreen from '../screens/TodayScreen'
import ProjectsScreen from '../screens/ProjectsScreen'
import RecurringScreen from '../screens/RecurringScreen'
import HistoryScreen from '../screens/HistoryScreen'
import SettingsScreen from '../screens/SettingsScreen'

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

function tabIcon(label: string) {
  return ({ color }: { color: string }) => <Text style={{ color, fontSize: 18 }}>{label}</Text>
}

function MainTabs() {
  const { theme } = useTaskify()
  const c = colorsFor(theme)
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.raised, borderTopColor: c.rim }
      }}
    >
      <Tab.Screen name="Today" component={TodayScreen} options={{ tabBarIcon: tabIcon('◷') }} />
      <Tab.Screen name="Projects" component={ProjectsScreen} options={{ tabBarIcon: tabIcon('▦') }} />
      <Tab.Screen name="Recurring" component={RecurringScreen} options={{ tabBarIcon: tabIcon('↺') }} />
    </Tab.Navigator>
  )
}

function HeaderButtons({ navigation }: { navigation: any }) {
  const { theme, setTheme } = useTaskify()
  const c = colorsFor(theme)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Pressable onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
        <Text style={{ color: c.muted, fontSize: 16 }}>{theme === 'dark' ? '☀' : '☾'}</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('History')}>
        <Text style={{ color: c.muted, fontSize: 16 }}>🕘</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('Settings')}>
        <Text style={{ color: c.muted, fontSize: 18 }}>⚙</Text>
      </Pressable>
    </View>
  )
}

export default function RootNavigator({ onReopenWizard }: { onReopenWizard: () => void }) {
  const { theme } = useTaskify()
  const c = colorsFor(theme)
  const headerStyle = {
    headerStyle: { backgroundColor: c.raised },
    headerTitleStyle: { color: c.ink },
    headerTintColor: c.accent
  }
  return (
    <Stack.Navigator screenOptions={headerStyle}>
      <Stack.Screen
        name="Tabs"
        component={MainTabs}
        options={({ navigation }) => ({
          title: 'Taskify',
          headerRight: () => <HeaderButtons navigation={navigation} />
        })}
      />
      <Stack.Screen name="History" component={HistoryScreen} options={{ title: 'History' }} />
      <Stack.Screen name="Settings" options={{ title: 'Settings' }}>
        {() => <SettingsScreen onReopenWizard={onReopenWizard} />}
      </Stack.Screen>
    </Stack.Navigator>
  )
}
