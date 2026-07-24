// Mantener sincronizado a mano con frontend/src/lib/appVersion.ts y
// frontend/android/app/build.gradle (ver paso 0 de "App Android" en CLAUDE.md).
// La app instalada consulta /api/apk/version contra este valor para saber si
// hay una versión más nueva que la que trae bundleada y mostrar el aviso de
// actualización.
export const CURRENT_APK_VERSION = '2.7'
