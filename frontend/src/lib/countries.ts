// Espejo del backend (backend/src/config/countries.ts) — solo lo que necesita
// el frontend para selectores. Mantener sincronizado si se agrega un país.
//
// El identificador es el NOMBRE (ej. "Chile"), no un código ISO — coincide
// con el texto libre ya guardado en profile.location.country.

export interface CountryOption {
  nombre: string
  moneda: string
}

export const COUNTRIES: CountryOption[] = [
  { nombre: 'Chile', moneda: 'CLP' },
  { nombre: 'Estados Unidos', moneda: 'USD' },
  { nombre: 'España', moneda: 'EUR' },
  { nombre: 'Argentina', moneda: 'ARS' },
  { nombre: 'México', moneda: 'MXN' },
  { nombre: 'Colombia', moneda: 'COP' },
  { nombre: 'Perú', moneda: 'PEN' },
  { nombre: 'Remoto Global', moneda: 'USD' },
]

export const DEFAULT_COUNTRY_NAME = 'Chile'

export function monedaForCountry(nombre?: string | null): string {
  return COUNTRIES.find(c => c.nombre.toLowerCase() === (nombre || '').toLowerCase())?.moneda || 'CLP'
}
