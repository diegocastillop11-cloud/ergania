import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { Routes, Route } from 'react-router-dom'
import type { ReactNode } from 'react'

import { AuthContext } from '../lib/AuthContext'
import { LanguageProvider } from '../lib/i18n/LanguageContext'
import Landing from '../pages/Landing'
import Privacy from '../pages/Privacy'
import Terms from '../pages/Terms'
import Preguntas, { type Faq } from '../pages/Preguntas'
import RecursosIndex from '../pages/RecursosIndex'
import RecursosArticle from '../pages/RecursosArticle'
import Nosotros from '../pages/Nosotros'
import Contacto from '../pages/Contacto'

export { PUBLIC_SEO, SITE_URL, type PageSeo } from '../content/seo'

// Sesión vacía: el prerender siempre representa a un visitante anónimo, que es
// exactamente lo que ve el crawler. Montar AuthProvider aquí exigiría Supabase
// y APIs de navegador que no existen en Node.
const ANONYMOUS_AUTH = {
  user: null,
  session: null,
  loading: false,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null, session: null }),
  signInWithGoogle: async () => ({ error: null }),
  signOut: async () => {},
  resetPasswordForEmail: async () => ({ error: null }),
  updatePassword: async () => ({ error: null }),
  acceptTerms: async () => ({ error: null }),
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={ANONYMOUS_AUTH}>
      <LanguageProvider>{children}</LanguageProvider>
    </AuthContext.Provider>
  )
}

export interface RenderOptions {
  faqs?: Faq[]
}

export function render(url: string, options: RenderOptions = {}): string {
  return renderToString(
    <StaticRouter location={url}>
      <Providers>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/recursos" element={<RecursosIndex />} />
          <Route path="/recursos/:slug" element={<RecursosArticle />} />
          <Route path="/nosotros" element={<Nosotros />} />
          <Route path="/contacto" element={<Contacto />} />
          <Route path="/preguntas" element={<Preguntas initialFaqs={options.faqs ?? []} />} />
          <Route path="/privacidad" element={<Privacy />} />
          <Route path="/terminos" element={<Terms />} />
        </Routes>
      </Providers>
    </StaticRouter>,
  )
}
