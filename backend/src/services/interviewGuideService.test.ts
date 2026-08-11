import { describe, it, expect } from 'vitest'
import { stripCitations, buildInterviewGuideHtml, type InterviewGuide } from './interviewGuideService'

function guideFixture(resumen: string, meta: InterviewGuide['meta'] = {}): InterviewGuide {
  return {
    version: 1,
    generatedAt: '2026-08-10T00:00:00.000Z',
    empresa: 'Empresa Ejemplo S.A.',
    rol: 'Analista de Datos',
    idioma: 'es',
    meta,
    empresaInfo: { investigada: true, resumen, stats: [], valores: [], fuentes: [] },
    cargo: { objetivo: '', funciones: [], requisitos: [], fit: [], fraseFit: '' },
    pitch: { bloques: [], numerosClave: [] },
    preguntas: { tipicas: [], tecnicas: [], paraEllos: [] },
    escenarios: [],
    fortalezas: [],
    debilidades: [],
    checklist: { mental: [], logistica: [], noHacer: [], ventaja: '' },
  }
}

// Regresión: la tool web_search devuelve el texto citado envuelto en <cite index="...">.
// Como el HTML de la guía escapa todo, esas etiquetas se veían literales dentro del texto
// ("<cite index="6-1,6-2">Empresa Ejemplo es...</cite>") en la primera guía generada.
describe('stripCitations', () => {
  it('saca las etiquetas <cite> dejando el texto citado', () => {
    const raw = '<cite index="6-1,6-2">Empresa Ejemplo es una multinacional</cite>. <cite index="9-5">En 2024 reportó ventas por US$1.565 millones</cite>.'
    expect(stripCitations(raw)).toBe('Empresa Ejemplo es una multinacional. En 2024 reportó ventas por US$1.565 millones.')
  })

  it('saca también la variante con corchetes numéricos', () => {
    expect(stripCitations('Facturó US$1.247 millones [1] y creció 6,1% [2, 3].'))
      .toBe('Facturó US$1.247 millones y creció 6,1%.')
  })

  it('no toca texto sin citas', () => {
    const limpio = 'La empresa pasó de 20 a 41 millones de órdenes entre 2022 y 2024.'
    expect(stripCitations(limpio)).toBe(limpio)
  })

  it('preserva la negrita de markdown que el HTML sí renderiza', () => {
    expect(stripCitations('<cite index="1-1">Adquirida por **Copec** en 2022</cite>'))
      .toBe('Adquirida por **Copec** en 2022')
  })
})

describe('buildInterviewGuideHtml — limpieza al renderizar', () => {
  // El caso real: una guía se generó antes del fix y quedó guardada con el
  // marcado adentro. Limpiar solo al generar no la arreglaba — al recargar se renderizaba
  // el JSON guardado tal cual. Obligar a regenerarla habría costado tokens por un bug de
  // presentación, así que la limpieza tiene que ocurrir también en el render.
  it('renderiza limpia una guía ya guardada con marcado de citas', () => {
    const sucia = '<cite index="6-1,6-2">Empresa Ejemplo es una multinacional</cite>. <cite index="6-4">Cuenta con 11.037 empleados</cite>.'
    const html = buildInterviewGuideHtml(guideFixture(sucia), { mode: 'standalone' })

    expect(html).not.toContain('&lt;cite')
    expect(html).not.toContain('<cite')
    expect(html).toContain('Empresa Ejemplo es una multinacional')
    expect(html).toContain('Cuenta con 11.037 empleados')
  })

  it('no toca los datos que escribió el usuario', () => {
    const g = guideFixture('Resumen limpio', { entrevistadores: 'Ana [turno 2]', hora: '15:00' })
    const html = buildInterviewGuideHtml(g, { mode: 'standalone' })
    expect(html).toContain('Ana [turno 2]')
  })

  it('tampoco toca las notas del usuario', () => {
    const html = buildInterviewGuideHtml(guideFixture('Resumen'), {
      mode: 'standalone',
      notes: { sensacion: 'La pregunta [3] me costó' },
    })
    expect(html).toContain('La pregunta [3] me costó')
  })
})
