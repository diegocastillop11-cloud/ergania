// Versión mostrada al usuario para el APK descargable — se sube a mano cada vez que se
// recompila (ver "App Android (APK descargable)" en CLAUDE.md). No viene de build.gradle
// automáticamente; hay que mantenerla sincronizada ahí también.
export const ANDROID_APK_VERSION = '2.16'
export const ANDROID_APK_FILENAME = `ergania_v${ANDROID_APK_VERSION}.apk`

// El APK ya no se commitea al repo (pasó los 100MB que permite GitHub) — vive en Vercel
// Blob con pathname fijo "ergania.apk" así esta URL no cambia entre versiones.
export const ANDROID_APK_URL = 'https://swwwpx4x0ekiwk61.public.blob.vercel-storage.com/ergania.apk'
