// Versión mostrada al usuario para el APK descargable — se sube a mano cada vez que se
// recompila (ver "App Android (APK descargable)" en CLAUDE.md). No viene de build.gradle
// automáticamente; hay que mantenerla sincronizada ahí también.
export const ANDROID_APK_VERSION = '2.26'
export const ANDROID_APK_FILENAME = `ergania_v${ANDROID_APK_VERSION}.apk`

// El APK ya no se commitea al repo (pasó los 100MB que permite GitHub) — vive en Vercel
// Blob con pathname fijo "ergania.apk" así esta URL no cambia entre versiones.
// Se sirve por nuestro dominio (rewrite en vercel.json hacia Blob) para controlar los headers
// de descarga: desde vercel-storage.com directo, Chrome dejaba la descarga pegada en
// "Descargando…" aunque ya hubiera bajado el 100%.
export const ANDROID_APK_URL = 'https://www.ergania.com/ergania.apk'
