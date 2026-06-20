import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.nightwarp.taskify',
  appName: 'Taskify',
  webDir: 'out/web',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_taskify',
      iconColor: '#4191FF'
    }
  }
}

export default config
