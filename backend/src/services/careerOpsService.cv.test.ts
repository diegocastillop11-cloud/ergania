import { describe, it, expect } from 'vitest'
import { buildCvHtml, parseCvDataFromHtml, CvData } from './careerOpsService'

describe('parseCvDataFromHtml / buildCvHtml round-trip', () => {
  // ISSUE: con 2+ entries de experiencia, el regex de parseEntries/parseProjects
  // requería "</div></div>" para cerrar cada entry — pero ese doble cierre solo
  // ocurre después de la ÚLTIMA entry (pegado al cierre del section wrapper), no
  // entre entries. Resultado: todas las entries se fusionaban en un solo match,
  // con los bullets de TODOS los trabajos mezclados y solo el primer company/role
  // sobreviviendo. El preview HTML (renderizado directo) se veía bien; el PDF
  // (construido desde este parseo roto) salía desordenado.
  it('parsea cada experiencia como una entry separada, sin mezclar bullets entre trabajos', () => {
    const cvData: CvData = {
      name: 'Diego Castillo Pineda',
      contact: { city: 'Santiago, Chile', phone: '+56 9 1234 5678', email: 'diego@test.com', linkedin: 'linkedin.com/in/diego', github: 'github.com/diego' },
      summary: 'Analista de datos con experiencia en SQL Server.',
      experience: [
        { company: 'Punto Ticket', location: 'Santiago, Chile', role: 'Analista de Base de Datos Senior', dates: 'Nov 2019 - Feb 2025', bullets: ['Diseñé stored procedures', 'Automaticé procesos', 'Desarrollé dashboards'] },
        { company: 'Imperial S.A.', location: 'Santiago, Chile', role: 'Analista Funcional', dates: 'Jun 2017 - Nov 2019', bullets: ['Resolví incidencias', 'Levanté requerimientos'] },
        { company: 'OB Group Park', location: 'Santiago, Chile', role: 'Analista de Sistemas y TI', dates: 'May 2014 - Abr 2017', bullets: ['Lideré proyectos de integración'] },
      ],
      projects: [
        { name: 'Proyecto A', year: '2022', bullets: ['Bullet proyecto A'] },
        { name: 'Proyecto B', year: '2023', bullets: ['Bullet proyecto B1', 'Bullet proyecto B2'] },
      ],
      skills: { 'Bases de Datos': 'SQL Server, Azure SQL', 'Lenguajes': 'T-SQL, Python' },
      education: [{ title: 'Analista Programador', institution: 'Universidad Tecnológica de Chile Inacap', year: '2019' }],
    }

    const html = buildCvHtml(cvData)
    const parsed = parseCvDataFromHtml(html)

    expect(parsed.experience).toHaveLength(3)
    expect(parsed.experience.map(e => e.company)).toEqual(['Punto Ticket', 'Imperial S.A.', 'OB Group Park'])
    expect(parsed.experience[0].bullets).toEqual(['Diseñé stored procedures', 'Automaticé procesos', 'Desarrollé dashboards'])
    expect(parsed.experience[1].bullets).toEqual(['Resolví incidencias', 'Levanté requerimientos'])
    expect(parsed.experience[2].bullets).toEqual(['Lideré proyectos de integración'])

    expect(parsed.projects).toHaveLength(2)
    expect(parsed.projects.map(p => p.name)).toEqual(['Proyecto A', 'Proyecto B'])
    expect(parsed.projects[0].bullets).toEqual(['Bullet proyecto A'])
    expect(parsed.projects[1].bullets).toEqual(['Bullet proyecto B1', 'Bullet proyecto B2'])
  })
})
