import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.ergania.app',
  appName: 'Ergania',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
