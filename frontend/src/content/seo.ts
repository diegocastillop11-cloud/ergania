import { ARTICLES } from './articles'
import { TITLE as RECURSOS_TITLE, DESCRIPTION as RECURSOS_DESCRIPTION } from '../pages/RecursosIndex'
import { TITLE as NOSOTROS_TITLE, DESCRIPTION as NOSOTROS_DESCRIPTION } from '../pages/Nosotros'
import { TITLE as CONTACTO_TITLE, DESCRIPTION as CONTACTO_DESCRIPTION } from '../pages/Contacto'

export const SITE_URL = 'https://ergania.com'

export interface PageSeo {
  path: string
  title: string
  description: string
  /** ISO date — se usa para <lastmod> del sitemap y para el JSON-LD del artículo. */
  publishedAt?: string
}

/**
 * Fuente única de metadatos de las rutas públicas: la usan el prerender
 * (scripts/prerender.mjs) y la generación del sitemap. Las páginas exportan su
 * propio título/descripción para que no puedan quedar desincronizados.
 */
export const STATIC_SEO: PageSeo[] = [
  {
    path: '/',
    title: 'Ergania — Encuentra trabajo con IA',
    description:
      'Ergania te ayuda a buscar trabajo con IA: adapta tu CV a cada oferta, estima tu pretensión de renta y ordena tus postulaciones en un solo lugar.',
  },
  { path: '/recursos', title: RECURSOS_TITLE, description: RECURSOS_DESCRIPTION },
  { path: '/nosotros', title: NOSOTROS_TITLE, description: NOSOTROS_DESCRIPTION },
  { path: '/contacto', title: CONTACTO_TITLE, description: CONTACTO_DESCRIPTION },
  {
    path: '/preguntas',
    title: 'Preguntas frecuentes — Ergania',
    description:
      'Respuestas a las dudas más comunes sobre Ergania: qué incluye la prueba gratuita, cómo funciona la suscripción, qué pasa con tus datos y cómo cancelar.',
  },
  {
    path: '/privacidad',
    title: 'Política de Privacidad — Ergania',
    description:
      'Qué datos personales recolecta Ergania, para qué los usa, con quién los comparte y cómo puedes acceder a ellos, corregirlos o eliminarlos.',
  },
  {
    path: '/terminos',
    title: 'Términos y Condiciones — Ergania',
    description:
      'Condiciones de uso de Ergania: alcance del servicio, suscripciones y pagos, responsabilidades del usuario y política de cancelación.',
  },
]

export const ARTICLE_SEO: PageSeo[] = ARTICLES.map(article => ({
  path: `/recursos/${article.slug}`,
  title: `${article.title} — Ergania`,
  description: article.description,
  publishedAt: article.publishedAt,
}))

export const PUBLIC_SEO: PageSeo[] = [...STATIC_SEO, ...ARTICLE_SEO]
