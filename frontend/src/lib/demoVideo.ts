// Video demo de la app. Vive en el mismo store de Vercel Blob que el APK: 25MB no pueden
// ir en public/ porque se irían al bundle del deploy.
//
// El pathname lleva versión (-v2) a propósito, en vez de sobreescribir el anterior: como
// producción y los previews leen la misma URL, sobreescribir el archivo cambia producción
// al instante y deja sin nada que probar. Con un pathname nuevo, la rama se puede revisar
// sin tocar lo que ven los usuarios.
export const DEMO_VIDEO_URL = 'https://swwwpx4x0ekiwk61.public.blob.vercel-storage.com/ergania-demo-v2.mp4'

// El poster sí es local: pesa 90KB y evita un salto de DNS extra antes de pintar el frame.
export const DEMO_POSTER_URL = '/demo-poster.jpg'

// Ratio nativo del archivo (1920x1008). Se usa para reservar el espacio antes de que exista
// metadata del video — si se re-graba el demo con otra resolución, ajustar acá.
export const DEMO_ASPECT_RATIO = '40 / 21'
