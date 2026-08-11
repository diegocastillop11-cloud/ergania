/**
 * Prerender de las rutas públicas.
 *
 * Vite deja un dist/index.html con <div id="root"></div> vacío: para el crawler
 * de Google/AdSense ergania.com no tiene una sola palabra de contenido, que fue
 * exactamente el motivo del rechazo de AdSense (2026-08-10). Este script corre
 * después de `vite build` y escribe un HTML real por ruta pública, con su propio
 * <head> y el contenido ya renderizado dentro de #root.
 *
 * El bundle del cliente no cambia: main.tsx sigue montando con createRoot, que
 * reemplaza lo prerenderizado en cuanto hidrata.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const DIST = join(ROOT, 'dist')
const SSR_ENTRY = join(ROOT, 'dist-ssr', 'entry.js')

// La entry SSR arrastra el cliente de Supabase, que revienta al importarse con
// "supabaseUrl is required" si faltan las VITE_*. Pasa en toda rama nueva de
// Vercel hasta que se le agregan sus env vars de Preview a mano (ver CLAUDE.md).
let render, PUBLIC_SEO, SITE_URL
try {
  ;({ render, PUBLIC_SEO, SITE_URL } = await import(`file://${SSR_ENTRY.replace(/\\/g, '/')}`))
} catch (err) {
  if (/supabaseUrl is required/i.test(err.message)) {
    throw new Error(
      '[prerender] faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en este entorno. ' +
      'Si es una rama nueva en Vercel, agregá sus env vars de Preview (CLAUDE.md → ' +
      '"Gotcha: env vars de Preview") y volvé a deployar.',
      { cause: err },
    )
  }
  throw err
}

const esc = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Las FAQs viven en la base de datos; sin esto /preguntas se prerenderiza en "cargando". */
async function fetchFaqs() {
  try {
    const res = await fetch(`${SITE_URL}/api/faqs`, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const faqs = Array.isArray(data.faqs) ? data.faqs : []
    console.log(`[prerender] ${faqs.length} FAQs traídas para /preguntas`)
    return faqs
  } catch (err) {
    // No es motivo para romper el deploy: la página sigue cargándolas en el cliente.
    console.warn(`[prerender] no se pudieron traer las FAQs (${err.message}) — /preguntas queda sin ellas`)
    return []
  }
}

function jsonLd(page, faqs) {
  const organization = {
    '@type': 'Organization',
    name: 'Ergania',
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    email: 'contacto@ergania.com',
  }

  // El acordeón de /preguntas solo monta la respuesta abierta, así que el texto
  // completo llega a Google por datos estructurados en vez del DOM.
  if (page.path === '/preguntas' && faqs.length > 0) {
    return ldScript({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer },
      })),
    })
  }

  const data = page.publishedAt
    ? {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: page.title.replace(/ — Ergania$/, ''),
        description: page.description,
        datePublished: page.publishedAt,
        inLanguage: 'es',
        mainEntityOfPage: `${SITE_URL}${page.path}`,
        author: organization,
        publisher: organization,
      }
    : {
        '@context': 'https://schema.org',
        ...organization,
      }

  return ldScript(data)
}

function ldScript(data) {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
}

function buildHtml(template, page, body, faqs) {
  const url = `${SITE_URL}${page.path}`
  const title = esc(page.title)
  const description = esc(page.description)

  return template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${description}" />`)
    .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}" />`)
    .replace(/<meta property="og:type"[^>]*>/, `<meta property="og:type" content="${page.publishedAt ? 'article' : 'website'}" />`)
    .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${url}" />`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${description}" />`)
    .replace('</head>', `  ${jsonLd(page, faqs)}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`)
}

function sitemap(pages) {
  const urls = pages
    .map(page => {
      const priority = page.path === '/' ? '1.0' : page.publishedAt ? '0.7' : '0.6'
      const lastmod = page.publishedAt ? `\n    <lastmod>${page.publishedAt}</lastmod>` : ''
      return `  <url>\n    <loc>${SITE_URL}${page.path}</loc>${lastmod}\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

const template = await readFile(join(DIST, 'index.html'), 'utf8')

// La landing se escribe sobre dist/index.html, que es también la plantilla: correr
// este script dos veces seguidas sin un `vite build` en medio no tiene una plantilla
// limpia de la que partir.
if (!template.includes('<div id="root"></div>')) {
  throw new Error(
    '[prerender] dist/index.html ya viene prerenderizado o no tiene <div id="root"></div>. ' +
    'Corré `npm run build` completo en vez de `npm run build:prerender` suelto.',
  )
}

const faqs = await fetchFaqs()

for (const page of PUBLIC_SEO) {
  const body = render(page.path, { faqs })

  if (!body || body.length < 500) {
    throw new Error(`[prerender] ${page.path} renderizó ${body.length} bytes — se aborta antes de publicar una página vacía`)
  }

  const outDir = page.path === '/' ? DIST : join(DIST, page.path)
  await mkdir(outDir, { recursive: true })
  await writeFile(join(outDir, 'index.html'), buildHtml(template, page, body, faqs), 'utf8')
  console.log(`[prerender] ${page.path.padEnd(52)} ${String(body.length).padStart(7)} bytes`)
}

await writeFile(join(DIST, 'sitemap.xml'), sitemap(PUBLIC_SEO), 'utf8')
console.log(`[prerender] ${PUBLIC_SEO.length} rutas + sitemap.xml`)
