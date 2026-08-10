import { describe, it, expect } from 'vitest'
import { stripCitations } from './interviewGuideController'

// Regresión: la tool web_search devuelve el texto citado envuelto en <cite index="...">.
// Como el HTML de la guía escapa todo, esas etiquetas se veían literales dentro del texto
// ("<cite index="6-1,6-2">Empresas Carozzi es...</cite>") en la primera guía generada.
describe('stripCitations', () => {
  it('saca las etiquetas <cite> dejando el texto citado', () => {
    const raw = '<cite index="6-1,6-2">Empresas Carozzi es una multinacional chilena</cite>. <cite index="9-5">En 2024 reportó ventas por US$1.565 millones</cite>.'
    expect(stripCitations(raw)).toBe('Empresas Carozzi es una multinacional chilena. En 2024 reportó ventas por US$1.565 millones.')
  })

  it('saca también la variante con corchetes numéricos', () => {
    expect(stripCitations('Facturó US$1.247 millones [1] y creció 6,1% [2, 3].'))
      .toBe('Facturó US$1.247 millones y creció 6,1%.')
  })

  it('no toca texto sin citas', () => {
    const limpio = 'Blue Express pasó de 20 a 41 millones de órdenes entre 2022 y 2024.'
    expect(stripCitations(limpio)).toBe(limpio)
  })

  it('preserva la negrita de markdown que el HTML sí renderiza', () => {
    expect(stripCitations('<cite index="1-1">Adquirida por **Copec** en 2022</cite>'))
      .toBe('Adquirida por **Copec** en 2022')
  })
})
