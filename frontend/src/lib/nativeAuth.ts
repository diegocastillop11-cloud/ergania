import type { PluginListenerHandle } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { supabase } from './supabase'

// Google bloquea el login OAuth dentro del WebView embebido de la app
// (error "disallowed_useragent"), así que en nativo abrimos el flujo en un
// in-app browser real (Chrome Custom Tabs) y volvemos a la app por este
// deep link, registrado en android/app/src/main/AndroidManifest.xml.
const REDIRECT_URL = 'ergania://auth-callback'

export async function signInWithGoogleNative(): Promise<{ error: string | null }> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: REDIRECT_URL, skipBrowserRedirect: true },
  })
  if (error || !data?.url) {
    return { error: error?.message ?? 'No se pudo iniciar el login con Google' }
  }

  const authUrl = data.url

  return new Promise(resolve => {
    let listenerHandle: PluginListenerHandle | null = null

    const finish = async (result: { error: string | null }) => {
      await Browser.close().catch(() => {})
      listenerHandle?.remove()
      resolve(result)
    }

    App.addListener('appUrlOpen', async ({ url }) => {
      if (!url.startsWith(REDIRECT_URL)) return

      const params = new URLSearchParams(url.split(/[#?]/)[1] ?? '')
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      if (!access_token || !refresh_token) {
        finish({ error: params.get('error_description') ?? 'Login con Google cancelado' })
        return
      }

      const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token })
      finish({ error: sessionError ? sessionError.message : null })
    }).then(handle => { listenerHandle = handle })

    Browser.open({ url: authUrl })
  })
}
