const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

// Fire-and-forget: no debe bloquear ni retrasar la descarga real del archivo estático.
export function logApkDownload(): void {
  fetch(`${API_BASE}/api/apk/download`, { method: 'POST', keepalive: true }).catch(() => {})
}
