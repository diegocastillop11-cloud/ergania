import { createContext, useContext, useState, ReactNode } from 'react'
import es from './es.json'
import en from './en.json'

export type Language = 'es' | 'en'
const STORAGE_KEY = 'ergania:language'
const dictionaries: Record<Language, unknown> = { es, en }

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, vars?: Record<string, string | number>) => string
  tList: (key: string) => string[]
}

const LanguageContext = createContext<LanguageContextType | null>(null)

function resolveRaw(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, dict)
}

function resolve(dict: unknown, key: string): string | undefined {
  const value = resolveRaw(dict, key)
  return typeof value === 'string' ? value : undefined
}

function resolveList(dict: unknown, key: string): string[] | undefined {
  const value = resolveRaw(dict, key)
  return Array.isArray(value) ? value : undefined
}

function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text
  return text.replace(/\{\{(\w+)\}\}/g, (match, name) => (name in vars ? String(vars[name]) : match))
}

function getInitialLanguage(): Language {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'es' || saved === 'en') return saved
  // Mercado actual (Chile/LATAM/España) es 100% hispanohablante — español por defecto,
  // sin auto-detección de navegador, hasta que haya evidencia real de demanda de otro idioma.
  return 'es'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage)

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem(STORAGE_KEY, lang)
  }

  const t = (key: string, vars?: Record<string, string | number>) => {
    const text = resolve(dictionaries[language], key) ?? resolve(dictionaries.es, key) ?? key
    return interpolate(text, vars)
  }

  const tList = (key: string) => {
    return resolveList(dictionaries[language], key) ?? resolveList(dictionaries.es, key) ?? []
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tList }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useTranslation debe usarse dentro de <LanguageProvider>')
  return ctx
}
