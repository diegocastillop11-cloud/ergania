// Video demo de la app. Vive en el mismo store de Vercel Blob que el APK: 16MB no pueden
// ir en public/ porque se irían al bundle del deploy. El pathname es fijo, así que resubir
// una versión nueva del video no cambia esta URL.
export const DEMO_VIDEO_URL = 'https://swwwpx4x0ekiwk61.public.blob.vercel-storage.com/ergania-demo.mp4'

// El poster sí es local: pesa 44KB y evita un salto de DNS extra antes de pintar el frame.
export const DEMO_POSTER_URL = '/demo-poster.jpg'

// Ratio nativo del archivo (816x432). Se usa para reservar el espacio antes de que exista
// metadata del video — si se re-graba el demo con otra resolución, ajustar acá.
export const DEMO_ASPECT_RATIO = '17 / 9'
