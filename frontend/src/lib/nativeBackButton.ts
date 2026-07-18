import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

// Sin esto, el botón/gesto "atrás" de Android no hace nada dentro del
// WebView (o puede cerrar la app de golpe desde cualquier pantalla).
export function setupNativeBackButton() {
  if (!Capacitor.isNativePlatform()) return

  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back()
    else App.exitApp()
  })
}
