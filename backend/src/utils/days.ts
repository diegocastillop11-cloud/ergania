// Días calendario entre `now` y `end` en hora de Chile: 0 = vence hoy, 1 = mañana.
// Math.ceil sobre horas restantes decía "mañana" para algo que vencía el mismo día.
export function calendarDaysUntil(end: Date, now: Date = new Date()): number {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' })
  return Math.round((Date.parse(day.format(end)) - Date.parse(day.format(now))) / 86_400_000)
}
