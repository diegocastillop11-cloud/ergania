import { describe, it, expect } from 'vitest'
import { getInterviewType, interviewTypeLabel, type InterviewTypeKey } from './interviewTypes'

const KEYS: InterviewTypeKey[] = ['rrhh', 'tecnica', 'gerente', 'psicolaboral', 'panel']

describe('getInterviewType', () => {
  // Las claves son el contrato con TYPE_KEYS en InterviewGuidePanel.tsx: si una deja de
  // resolver, el <select> del frontend manda un valor que el backend ignora en silencio y la
  // guía sale con el reparto mixto sin que nadie se entere.
  it('resuelve las 5 claves del selector del frontend', () => {
    for (const k of KEYS) {
      expect(getInterviewType(k)?.key, k).toBe(k)
    }
  })

  it('cae en null con el texto libre de las guías anteriores y con vacío', () => {
    expect(getInterviewType('con la jefa de RRHH')).toBeNull()
    expect(getInterviewType('')).toBeNull()
    expect(getInterviewType(undefined)).toBeNull()
  })

  it('cada tipo trae cuotas y foco no vacíos', () => {
    for (const k of KEYS) {
      const t = getInterviewType(k)!
      expect(t.cuotas.length, k).toBeGreaterThan(0)
      expect(t.foco.length, k).toBeGreaterThan(0)
    }
  })

  // RRHH y psicolaboral piden explícitamente 0 técnicas: es la mitad del punto del cambio.
  it('rrhh y psicolaboral piden 0 preguntas técnicas', () => {
    expect(getInterviewType('rrhh')!.cuotas).toContain('0 técnicas')
    expect(getInterviewType('psicolaboral')!.cuotas).toContain('0 técnicas')
  })
})

describe('interviewTypeLabel', () => {
  it('traduce la clave a etiqueta legible según el idioma de la guía', () => {
    expect(interviewTypeLabel('rrhh', 'es')).toBe('RRHH / Screening')
    expect(interviewTypeLabel('rrhh', 'en')).toBe('HR / Screening')
  })

  // Sin esto, una guía vieja mostraría su texto libre reemplazado o vacío en la tabla de datos.
  it('devuelve el texto libre intacto si no es una clave conocida', () => {
    expect(interviewTypeLabel('con la jefa de RRHH', 'es')).toBe('con la jefa de RRHH')
  })
})
