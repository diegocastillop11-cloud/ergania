const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export type VideoPlaySource = 'landing' | 'dashboard'

// Fire-and-forget, igual que logApkDownload: si el registro falla, el usuario igual ve
// el video. Se llama una sola vez por reproducción (ver useLogFirstPlay) — el evento
// `play` del navegador también dispara al reanudar tras una pausa, y contar eso inflaría
// el número sin que nadie haya visto el video de nuevo.
export function logVideoPlay(source: VideoPlaySource): void {
  fetch(`${API_BASE}/api/video/play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
    keepalive: true,
  }).catch(() => {})
}
