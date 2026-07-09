// Fuente única de países soportados por el motor de IA (evaluación de ofertas,
// generación de CV/carta/formularios). Agregar un país acá es lo único que
// hace falta para que todos los prompts lo soporten.
//
// El identificador es el NOMBRE (ej. "Chile"), no un código ISO — así se
// mantiene compatible con el dato ya existente en profile.location.country
// (texto libre que el LLM ya rellena) y con salary_anchors.pais, que
// hacen match por nombre (.ilike / regex /chile/i).

export interface CountryConfig {
  nombre: string
  moneda: string
  idioma: 'es' | 'en'
  pisoLegalMensual?: number
  pisoLegalNota?: string
}

export const COUNTRIES: CountryConfig[] = [
  {
    nombre: 'Chile', moneda: 'CLP', idioma: 'es',
    pisoLegalMensual: 539000, pisoLegalNota: 'Ley 21.751 (sueldo mínimo mensual bruto)',
  },
  { nombre: 'Estados Unidos', moneda: 'USD', idioma: 'en' },
  { nombre: 'España', moneda: 'EUR', idioma: 'es' },
  { nombre: 'Argentina', moneda: 'ARS', idioma: 'es' },
  { nombre: 'México', moneda: 'MXN', idioma: 'es' },
  { nombre: 'Colombia', moneda: 'COP', idioma: 'es' },
  { nombre: 'Perú', moneda: 'PEN', idioma: 'es' },
  { nombre: 'Remoto Global', moneda: 'USD', idioma: 'en' },
]

export const DEFAULT_COUNTRY_NAME = 'Chile'

export function getCountryConfig(nombre?: string | null): CountryConfig {
  const found = nombre && COUNTRIES.find(c => c.nombre.toLowerCase() === nombre.toLowerCase())
  return found || COUNTRIES.find(c => c.nombre === DEFAULT_COUNTRY_NAME)!
}
