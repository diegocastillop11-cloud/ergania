import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

// Capacitor no abre pestañas nuevas del sistema: un <a target="_blank"> o
// window.open() intentaría navegar dentro del WebView de la app. Esto
// redirige esos casos (ofertas de portales externos, links de LinkedIn/
// Indeed, etc.) al navegador del sistema.
export function setupNativeExternalLinks() {
  if (!Capacitor.isNativePlatform()) return

  document.addEventListener('click', event => {
    if (event.defaultPrevented) return // ya manejado (ej. <Link> de react-router)

    const anchor = (event.target as HTMLElement)?.closest('a')
    if (!anchor || !anchor.href) return

    const isExternal = anchor.target === '_blank' || anchor.origin !== window.location.origin
    if (!isExternal) return

    event.preventDefault()
    Browser.open({ url: anchor.href })
  })

  const originalOpen = window.open.bind(window)
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    if (typeof url === 'string' && url.startsWith('http')) {
      Browser.open({ url })
      return null
    }
    return originalOpen(url, target, features)
  }) as typeof window.open
}
