/// <reference types="@capawesome/capacitor-android-edge-to-edge-support" />
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.nightwarp.taskify',
  appName: 'Taskify',
  webDir: 'out/web',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_taskify',
      iconColor: '#4191FF'
    },
    // Disable Capacitor 8's built-in insets handling so it doesn't conflict
    // with @capawesome/capacitor-android-edge-to-edge-support.
    SystemBars: {
      insetsHandling: 'disable'
    },
    // Initial colors for dark theme (default). bridge.ts overrides these at
    // runtime based on the saved theme setting.
    EdgeToEdge: {
      statusBarColor: '#1E1E1E',
      navigationBarColor: '#121212'
    }
  }
}

export default config
