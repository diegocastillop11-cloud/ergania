import { useEffect } from 'react'

const ADSENSE_CLIENT = 'ca-pub-2632840688699034'

export function useAdSenseScript() {
  useEffect(() => {
    if (document.querySelector(`script[data-adsbygoogle-client="${ADSENSE_CLIENT}"]`)) return
    const script = document.createElement('script')
    script.async = true
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
    script.crossOrigin = 'anonymous'
    script.dataset.adsbygoogleClient = ADSENSE_CLIENT
    document.head.appendChild(script)
    return () => { script.remove() }
  }, [])
}
