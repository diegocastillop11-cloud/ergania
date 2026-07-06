import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import { exec } from 'child_process'
import { promisify } from 'util'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Cargar .env aquí también por si este módulo se inicializa antes que config/supabase.ts
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true })

const execAsync = promisify(exec)

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
const supabase: SupabaseClient | null = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null

const DEFAULT_USER_EMAIL = 'local@careerops.local'

function normalizeUserEmail(email?: string): string {
  const normalized = (email || DEFAULT_USER_EMAIL).toString().trim().toLowerCase()
  return normalized === '' ? DEFAULT_USER_EMAIL : normalized
}

function dbEnabled(): boolean {
  return supabase !== null
}

const CAREER_OPS_PATH = process.env.CAREER_OPS_PATH || 'D:/career-ops-main/career-ops'

const p = (...parts: string[]) => path.join(CAREER_OPS_PATH, ...parts)

// ── Data types ──────────────────────────────────────────────────────────────

export interface TrackerEntry {
  id: string
  fecha: string
  empresa: string
  rol: string
  score: number | null
  estado: string
  pdf: boolean
  reportSlug: string | null
  url?: string
  notas?: string
  idioma?: 'es' | 'en'
}

export interface PipelineJob {
  url: string
  added: string
  source?: string
}

export interface Portal {
  name: string
  careers_url: string
  enabled: boolean
  api?: string
  country?: string
}

export interface PortalsConfig {
  title_filter: {
    positive: string[]
    negative: string[]
    seniority_boost: string[]
  }
  tracked_companies: Portal[]
  search_queries: Array<{ name: string; query: string; enabled: boolean }>
}

// ── File helpers ─────────────────────────────────────────────────────────────

function ensureFile(filePath: string, defaultContent: string) {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, defaultContent, 'utf-8')
  }
}

function readFile(filePath: string, fallback = ''): string {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return fallback
  }
}

// ── Tracker (applications.md) ────────────────────────────────────────────────

const TRACKER_PATH = p('data', 'applications.md')
const TRACKER_HEADER = `| # | Fecha | Empresa | Rol | Score | Estado | PDF | Report | URL | Notas |
|---|-------|---------|-----|-------|--------|-----|--------|-----|-------|
`

function readTrackerLocal(): TrackerEntry[] {
  ensureFile(TRACKER_PATH, `# Tracker de Aplicaciones\n\n${TRACKER_HEADER}`)
  const content = readFile(TRACKER_PATH)
  const lines = content.split('\n').filter(l => l.startsWith('|'))
  // Skip header and separator rows
  const dataLines = lines.slice(2)
  return dataLines
    .map(line => {
      const cols = line.split('|').map(c => c.trim()).filter((_, i) => i > 0 && i < 11)
      if (cols.length < 6) return null
      const [id, fecha, empresa, rol, scoreRaw, estado, pdfRaw, reportRaw, url, notas] = cols
      // Unescape pipe characters
      const unescape = (str: string): string => (str || '').replace(/\\\|/g, '|')
      const scoreNum = parseFloat(scoreRaw)
      const reportMatch = reportRaw?.match(/\[([^\]]+)\]\(([^)]+)\)/)
      return {
        id: id || '',
        fecha: fecha || '',
        empresa: unescape(empresa) || '',
        rol: unescape(rol) || '',
        score: isNaN(scoreNum) ? null : scoreNum,
        estado: estado || 'Evaluada',
        pdf: pdfRaw === '✅',
        reportSlug: reportMatch ? reportMatch[2] : null,
        url: unescape(url) || '',
        notas: unescape(notas) || '',
      } as TrackerEntry
    })
    .filter(Boolean) as TrackerEntry[]
}

export async function readTracker(userEmail?: string): Promise<TrackerEntry[]> {
  if (dbEnabled()) return dbReadTracker(normalizeUserEmail(userEmail))
  return readTrackerLocal()
}

function addTrackerEntryLocal(entry: Omit<TrackerEntry, 'id'>): TrackerEntry {
  ensureFile(TRACKER_PATH, `# Tracker de Aplicaciones\n\n${TRACKER_HEADER}`)
  const existing = readTrackerLocal()
  const nextId = String(existing.length + 1).padStart(3, '0')
  const newEntry: TrackerEntry = { id: nextId, ...entry }

  // Escape pipe characters to avoid breaking Markdown table
  const escapeMdPipe = (str: string | null | undefined): string => 
    (str || '').replace(/\|/g, '\\|').trim() || '—'

  const reportCell = newEntry.reportSlug
    ? `[${nextId}](${newEntry.reportSlug})`
    : '—'

  const row = `| ${nextId} | ${newEntry.fecha} | ${escapeMdPipe(newEntry.empresa)} | ${escapeMdPipe(newEntry.rol)} | ${newEntry.score ?? '—'} | ${newEntry.estado} | ${newEntry.pdf ? '✅' : '❌'} | ${reportCell} | ${escapeMdPipe(newEntry.url)} | ${escapeMdPipe(newEntry.notas)} |\n`

  const content = readFile(TRACKER_PATH)
  // If header exists append after it, else create fresh
  if (content.includes('|---|')) {
    fs.appendFileSync(TRACKER_PATH, row, 'utf-8')
  } else {
    fs.writeFileSync(TRACKER_PATH, `# Tracker de Aplicaciones\n\n${TRACKER_HEADER}${row}`, 'utf-8')
  }
  return newEntry
}


export async function addTrackerEntry(entry: Omit<TrackerEntry, 'id'>, userEmail?: string): Promise<TrackerEntry> {
  if (dbEnabled()) return dbAddTrackerEntry(normalizeUserEmail(userEmail), entry)
  return addTrackerEntryLocal(entry)
}

function updateTrackerEntryLocal(id: string, updates: Partial<TrackerEntry>) {
  const entries = readTrackerLocal()
  const idx = entries.findIndex(e => e.id === id)
  if (idx === -1) throw new Error(`Entry ${id} not found`)
  entries[idx] = { ...entries[idx], ...updates }
  writeTracker(entries)
}

export async function updateTrackerEntry(id: string, updates: Partial<TrackerEntry>, userEmail?: string): Promise<void> {
  if (dbEnabled()) return dbUpdateTrackerEntry(normalizeUserEmail(userEmail), id, updates)
  updateTrackerEntryLocal(id, updates)
}

function deleteTrackerEntryLocal(id: string) {
  const entries = readTrackerLocal()
  writeTracker(entries.filter(e => e.id !== id))
}

async function dbDeleteTrackerEntry(userEmail: string, id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado')
  const { error } = await supabase
    .from('tracker_entries')
    .delete()
    .match({ id, user_email: userEmail })
  if (error) throw new Error(error.message)
}

export async function deleteTrackerEntry(id: string, userEmail?: string): Promise<void> {
  if (dbEnabled()) return dbDeleteTrackerEntry(normalizeUserEmail(userEmail), id)
  deleteTrackerEntryLocal(id)
}

function writeTracker(entries: TrackerEntry[]) {
  const escapeMdPipe = (str: string | null | undefined): string => 
    (str || '').replace(/\|/g, '\\|').trim() || '—'

  const rows = entries.map(e => {
    const reportCell = e.reportSlug ? `[${e.id}](${e.reportSlug})` : '—'
    return `| ${e.id} | ${e.fecha} | ${escapeMdPipe(e.empresa)} | ${escapeMdPipe(e.rol)} | ${e.score ?? '—'} | ${e.estado} | ${e.pdf ? '✅' : '❌'} | ${reportCell} | ${escapeMdPipe(e.url)} | ${escapeMdPipe(e.notas)} |`
  })
  const content = `# Tracker de Aplicaciones\n\n${TRACKER_HEADER}${rows.join('\n')}\n`
  fs.writeFileSync(TRACKER_PATH, content, 'utf-8')
}

// ── Pipeline (pipeline.md) ───────────────────────────────────────────────────

const PIPELINE_PATH = p('data', 'pipeline.md')

function readPipelineLocal(): PipelineJob[] {
  ensureFile(PIPELINE_PATH, '# Pipeline de Ofertas\n\n')
  const content = readFile(PIPELINE_PATH)
  const lines = content.split('\n').filter(l => l.match(/^[-*]\s+https?:\/\//))
  return lines.map(line => {
    const parts = line.replace(/^[-*]\s+/, '').split(' | ')
    return {
      url: parts[0]?.trim() || '',
      added: parts[1]?.trim() || new Date().toISOString().split('T')[0],
      source: parts[2]?.trim(),
    }
  })
}

export async function readPipeline(userEmail?: string): Promise<PipelineJob[]> {
  if (dbEnabled()) return dbReadPipeline(normalizeUserEmail(userEmail))
  return readPipelineLocal()
}

function addToPipelineLocal(url: string, source?: string): void {
  ensureFile(PIPELINE_PATH, '# Pipeline de Ofertas\n\n')
  const existing = readPipelineLocal()
  if (existing.some(j => j.url === url)) return
  const date = new Date().toISOString().split('T')[0]
  const line = `- ${url} | ${date}${source ? ` | ${source}` : ''}\n`
  fs.appendFileSync(PIPELINE_PATH, line, 'utf-8')
}

export async function addToPipeline(url: string, source?: string, userEmail?: string): Promise<void> {
  if (dbEnabled()) return dbAddToPipeline(normalizeUserEmail(userEmail), url, source)
  return addToPipelineLocal(url, source)
}

function removeFromPipelineLocal(url: string): void {
  ensureFile(PIPELINE_PATH, '# Pipeline de Ofertas\n\n')
  const content = readFile(PIPELINE_PATH)
  const filtered = content
    .split('\n')
    .filter(l => !l.includes(url))
    .join('\n')
  fs.writeFileSync(PIPELINE_PATH, filtered, 'utf-8')
}

export async function removeFromPipeline(url: string, userEmail?: string): Promise<void> {
  if (dbEnabled()) return dbRemoveFromPipeline(normalizeUserEmail(userEmail), url)
  return removeFromPipelineLocal(url)
}

// Borra del pipeline todos los jobs añadidos por el escáner (source != 'manual')
// Se llama al inicio de cada nuevo escaneo para que la cola siempre refleje resultados frescos
function clearScannerPipelineLocal(): void {
  ensureFile(PIPELINE_PATH, '# Pipeline de Ofertas\n\n')
  const all = readPipelineLocal()
  const manual = all.filter(j => j.source === 'manual')
  const header = '# Pipeline de Ofertas\n\n'
  const rows = manual.map(j => `- ${j.url} | ${j.added} | manual`).join('\n')
  fs.writeFileSync(PIPELINE_PATH, header + (rows ? rows + '\n' : ''), 'utf-8')
}

export async function clearScannerPipeline(userEmail?: string): Promise<void> {
  if (dbEnabled()) return dbClearScannerPipeline(normalizeUserEmail(userEmail))
  return clearScannerPipelineLocal()
}

// ── Portals (portals.yml) ────────────────────────────────────────────────────

const PORTALS_PATH = p('portals.yml')

function readPortalsLocal(): PortalsConfig {
  const content = readFile(PORTALS_PATH)
  if (!content) return { title_filter: { positive: [], negative: [], seniority_boost: [] }, tracked_companies: [], search_queries: [] }
  return yaml.load(content) as PortalsConfig
}

export async function readPortals(userEmail?: string): Promise<PortalsConfig> {
  if (dbEnabled()) return dbReadPortals(normalizeUserEmail(userEmail))
  return readPortalsLocal()
}

function writePortalsLocal(config: PortalsConfig): void {
  fs.writeFileSync(PORTALS_PATH, yaml.dump(config), 'utf-8')
}

export async function writePortals(config: PortalsConfig, userEmail?: string): Promise<void> {
  if (dbEnabled()) return dbWritePortals(normalizeUserEmail(userEmail), config)
  return writePortalsLocal(config)
}

// ── Profile (config/profile.yml) ─────────────────────────────────────────────

const PROFILE_PATH = p('config', 'profile.yml')

function readProfileLocal(): Record<string, unknown> {
  const content = readFile(PROFILE_PATH)
  if (!content) return {}
  return yaml.load(content) as Record<string, unknown>
}

export async function readProfile(userEmail?: string): Promise<Record<string, unknown>> {
  if (dbEnabled()) return dbReadProfile(normalizeUserEmail(userEmail))
  return readProfileLocal()
}

function writeProfileLocal(data: Record<string, unknown>): void {
  fs.writeFileSync(PROFILE_PATH, yaml.dump(data), 'utf-8')
}

export async function writeProfile(data: Record<string, unknown>, userEmail?: string): Promise<void> {
  if (dbEnabled()) return dbWriteProfile(normalizeUserEmail(userEmail), data)
  return writeProfileLocal(data)
}

// ── CV (cv.md) ───────────────────────────────────────────────────────────────

const CV_PATH = p('cv.md')

function readCVLocal(): string {
  return readFile(CV_PATH, '')
}

export async function readCV(userEmail?: string): Promise<string> {
  if (dbEnabled()) return dbReadCV(normalizeUserEmail(userEmail))
  return readCVLocal()
}

function writeCVLocal(content: string): void {
  fs.writeFileSync(CV_PATH, content, 'utf-8')
}

export async function writeCV(content: string, userEmail?: string): Promise<void> {
  if (dbEnabled()) return dbWriteCV(normalizeUserEmail(userEmail), content)
  return writeCVLocal(content)
}

// ── Reports (reports/*.md) ───────────────────────────────────────────────────

const REPORTS_DIR = p('reports')

function readReportLocal(slug: string): string {
  const fullPath = path.isAbsolute(slug) ? slug : p(slug)
  return readFile(fullPath, '')
}

export async function readReport(slug: string, userEmail?: string): Promise<string> {
  if (dbEnabled()) return dbReadReport(normalizeUserEmail(userEmail), slug)
  return readReportLocal(slug)
}

function saveReportLocal(slug: string, content: string): void {
  try {
    const reportsDir = REPORTS_DIR
    fs.mkdirSync(reportsDir, { recursive: true })
    const filepath = path.join(reportsDir, slug)
    fs.writeFileSync(filepath, content, 'utf-8')
    console.log(`[Reports] Guardado: ${filepath}`)
  } catch (err) {
    console.error(`[Reports] Error guardando ${slug}:`, err)
    throw new Error(`No se pudo guardar el reporte: ${(err as Error).message}`)
  }
}

export async function saveReport(slug: string, content: string, userEmail?: string): Promise<void> {
  if (dbEnabled()) return dbSaveReport(normalizeUserEmail(userEmail), slug, content)
  return saveReportLocal(slug, content)
}

function listReportsLocal(): string[] {
  try {
    return fs.readdirSync(REPORTS_DIR).filter(f => f.endsWith('.md'))
  } catch {
    return []
  }
}

export async function listReports(userEmail?: string): Promise<string[]> {
  if (dbEnabled()) return dbListReports(normalizeUserEmail(userEmail))
  return listReportsLocal()
}

// ── Modes / prompts ──────────────────────────────────────────────────────────

export function readModeFile(name: string): string {
  return readFile(p('modes', name), '')
}

// ── CV Data: tipos + builders HTML/LaTeX ─────────────────────────────────────

export interface CvData {
  name: string
  contact: { city: string; phone: string; email: string; linkedin?: string; github?: string }
  summary: string
  experience: Array<{ company: string; location: string; role: string; dates: string; bullets: string[] }>
  projects: Array<{ name: string; year?: string; bullets: string[] }>
  skills: Record<string, string>
  education: Array<{ title: string; institution: string; year: string }>
}

function latexEsc(s: string): string {
  return s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
}

export const HARVARD_CSS = `<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Times New Roman',Times,serif;font-size:11pt;color:#000;background:#fff;max-width:8.5in;margin:0 auto;padding:0.7in 0.75in}
.name{text-align:center;font-size:19pt;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px}
.contact{text-align:center;font-size:9.5pt;color:#222;line-height:1.6}
.contact a{color:#222;text-decoration:none}
.section{margin-top:13px}
.section-title{font-size:11pt;font-weight:bold;text-transform:uppercase;letter-spacing:.8px;border-bottom:1.5px solid #000;padding-bottom:1px;margin-bottom:7px}
.entry{margin-bottom:7px}
.entry-header{display:flex;justify-content:space-between;align-items:baseline}
.company{font-weight:bold;font-size:11pt}
.role{font-style:italic;font-size:10.5pt}
.meta{font-size:10pt;color:#222;white-space:nowrap;margin-left:8px}
ul{margin-left:14px;margin-top:3px}
ul li{font-size:10.5pt;line-height:1.38;margin-bottom:1px}
.summary{font-size:10.5pt;line-height:1.5;margin-top:3px}
.skill-line{font-size:10.5pt;line-height:1.5}
.edu-entry{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px}
.edu-title{font-size:10.5pt}
.edu-year{font-size:10pt;color:#222;white-space:nowrap;margin-left:8px}
@media print{body{padding:0.5in 0.6in}@page{margin:0}}
</style>`

export function buildCvHtml(data: CvData): string {
  const contact1 = [data.contact.city, data.contact.phone, `<a href="mailto:${data.contact.email}">${data.contact.email}</a>`].join(' &nbsp;|&nbsp; ')
  const contact2 = [
    data.contact.linkedin ? `<a href="https://${data.contact.linkedin}">${data.contact.linkedin}</a>` : '',
    data.contact.github   ? `<a href="https://${data.contact.github}">${data.contact.github}</a>` : '',
  ].filter(Boolean).join(' &nbsp;|&nbsp; ')

  const expHtml = data.experience.map(e => `
  <div class="entry">
    <div class="entry-header"><span class="company">${e.company}</span><span class="meta">${e.location}</span></div>
    <div class="entry-header"><span class="role">${e.role}</span><span class="meta">${e.dates}</span></div>
    <ul>${e.bullets.map(b => `<li>${b}</li>`).join('')}</ul>
  </div>`).join('')

  const projHtml = data.projects.map(p => `
  <div class="entry">
    <div class="entry-header"><span class="company">${p.name}</span><span class="meta">${p.year || ''}</span></div>
    <ul>${p.bullets.map(b => `<li>${b}</li>`).join('')}</ul>
  </div>`).join('')

  const skillsHtml = Object.entries(data.skills).map(([cat, vals]) =>
    `<div class="skill-line"><strong>${cat}:</strong> ${vals}</div>`).join('')

  const eduHtml = data.education.map(e =>
    `<div class="edu-entry"><span class="edu-title"><strong>${e.title}</strong>, ${e.institution}</span><span class="edu-year">${e.year}</span></div>`).join('')

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">${HARVARD_CSS}</head><body>
<div class="name">${data.name}</div>
<div class="contact">${contact1}${contact2 ? `<br>${contact2}` : ''}</div>
<div class="section"><div class="section-title">Resumen Profesional</div><div class="summary">${data.summary}</div></div>
<div class="section"><div class="section-title">Experiencia Profesional</div>${expHtml}</div>
<div class="section"><div class="section-title">Proyectos Destacados</div>${projHtml}</div>
<div class="section"><div class="section-title">Habilidades Técnicas</div>${skillsHtml}</div>
<div class="section"><div class="section-title">Formación Académica</div>${eduHtml}</div>
</body></html>`
}

export function buildCvLatex(data: CvData): string {
  const e = latexEsc
  const expTex = data.experience.map(exp => `
\\textbf{${e(exp.company)}} \\hfill ${e(exp.location)}\\\\
\\textit{${e(exp.role)}} \\hfill ${e(exp.dates)}
\\begin{itemize}
${exp.bullets.map(b => `  \\item ${e(b)}`).join('\n')}
\\end{itemize}`).join('\n\\vspace{2pt}')

  const projTex = data.projects.map(p => `
\\textbf{${e(p.name)}}${p.year ? ` \\hfill ${e(p.year)}` : ''}
\\begin{itemize}
${p.bullets.map(b => `  \\item ${e(b)}`).join('\n')}
\\end{itemize}`).join('\n')

  const skillsTex = Object.entries(data.skills).map(([cat, vals]) =>
    `\\textbf{${e(cat)}:} ${e(vals)}`).join(' \\\\\n')

  const eduTex = data.education.map(ed =>
    `\\textbf{${e(ed.title)}}, ${e(ed.institution)} \\hfill ${e(ed.year)}`).join(' \\\\\n')

  const linkedin = data.contact.linkedin || ''
  const github   = data.contact.github   || ''
  const contactLine2 = (linkedin || github)
    ? `\\\\\n${[linkedin, github].filter(Boolean).map(u => `\\href{https://${u}}{${e(u)}}`).join(' \\quad|\\quad ')}`
    : ''

  return `\\documentclass[11pt,letterpaper]{article}
\\usepackage[top=0.7in,bottom=0.7in,left=0.75in,right=0.75in]{geometry}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage{lmodern}
\\usepackage{microtype}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{titlesec}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0pt}
\\pagestyle{empty}
\\titleformat{\\section}{\\normalfont\\bfseries}{}{0em}{\\uppercase}[\\vspace{-4pt}\\hrule\\vspace{4pt}]
\\titlespacing{\\section}{0pt}{8pt}{5pt}
\\setlist[itemize]{leftmargin=1.2em,label=--,itemsep=0pt,topsep=2pt,parsep=0pt}
\\begin{document}
\\begin{center}
{\\fontsize{16}{19}\\selectfont\\textbf{\\MakeUppercase{${e(data.name)}}}}\\\\[4pt]
{\\small ${e(data.contact.city)} \\quad|\\quad ${e(data.contact.phone)} \\quad|\\quad \\href{mailto:${data.contact.email}}{${e(data.contact.email)}}${contactLine2}}
\\end{center}

\\section{Resumen Profesional}
${e(data.summary)}

\\section{Experiencia Profesional}
${expTex}

\\section{Proyectos Destacados}
${projTex}

\\section{Habilidades T\\'{e}cnicas}
${skillsTex}

\\section{Formaci\\'{o}n Acad\\'{e}mica}
${eduTex}

\\end{document}`
}

// ── Applications (Postulaciones) ─────────────────────────────────────────────

export interface Application {
  id: string
  fecha: string
  empresa: string
  rol: string
  url?: string
  jd: string
  cvHtml: string      // HTML para preview en iframe (puede ser LaTeX convertido o HTML nativo)
  cvTex?: string      // fuente LaTeX original si se generó con pdflatex
  idioma?: 'es' | 'en' // idioma del CV generado (detectado del JD o elegido por el usuario)
  cvPdfFilename?: string
  estado: string
  interviewPrep?: string
  coverLetter?: string
  score?: number | null
  notas?: string
}

const APPS_PATH = p('data', 'applications.json')

function readRawApplications(): Application[] {
  try { return JSON.parse(readFile(APPS_PATH, '[]')) } catch { return [] }
}

function readApplicationsLocal(): Omit<Application, 'cvHtml'>[] {
  return readRawApplications().map(({ cvHtml: _html, ...rest }) => rest)
}

export async function readApplications(userEmail?: string): Promise<Omit<Application, 'cvHtml'>[]> {
  if (dbEnabled()) return dbReadApplications(normalizeUserEmail(userEmail))
  return readApplicationsLocal()
}

function getApplicationLocal(id: string): Application | null {
  return readRawApplications().find(a => a.id === id) || null
}

function findApplicationLocal(url: string | undefined, empresa: string, rol: string): Application | null {
  const data = readRawApplications()
  if (url) {
    const match = data.find(a => a.url === url)
    if (match) return match
  }
  return data.find(a =>
    a.empresa.toLowerCase() === empresa.toLowerCase() &&
    a.rol.toLowerCase() === rol.toLowerCase()
  ) || null
}

export async function findApplicationByUrlOrRole(url: string | undefined, empresa: string, rol: string, userEmail?: string): Promise<Application | null> {
  if (dbEnabled()) return dbFindApplicationByUrlOrRole(normalizeUserEmail(userEmail), url, empresa, rol)
  return findApplicationLocal(url, empresa, rol)
}

export async function getApplication(id: string, userEmail?: string): Promise<Application | null> {
  if (dbEnabled()) return dbGetApplication(normalizeUserEmail(userEmail), id)
  return getApplicationLocal(id)
}

function saveApplicationLocal(app: Application): void {
  const data = readRawApplications()
  const idx = data.findIndex(a => a.id === app.id)
  if (idx >= 0) data[idx] = app
  else data.push(app)
  fs.mkdirSync(path.dirname(APPS_PATH), { recursive: true })
  fs.writeFileSync(APPS_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

export async function saveApplication(app: Application, userEmail?: string): Promise<void> {
  if (dbEnabled()) return dbSaveApplication(normalizeUserEmail(userEmail), app)
  saveApplicationLocal(app)
}

function patchCoverLetterLocal(id: string, coverLetter: string): void {
  const apps = readRawApplications()
  const idx = apps.findIndex(a => a.id === id)
  if (idx >= 0) {
    apps[idx] = { ...apps[idx], coverLetter }
    fs.writeFileSync(APPS_PATH, JSON.stringify(apps, null, 2), 'utf-8')
  }
}

async function dbPatchCoverLetter(userEmail: string, id: string, coverLetter: string): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado')
  const { error } = await supabase
    .from('applications')
    .update({ coverLetter })
    .eq('user_email', userEmail)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function patchCoverLetter(id: string, coverLetter: string, userEmail?: string): Promise<void> {
  if (dbEnabled()) return dbPatchCoverLetter(normalizeUserEmail(userEmail), id, coverLetter)
  patchCoverLetterLocal(id, coverLetter)
}

export async function getNextApplicationId(userEmail?: string): Promise<string> {
  if (dbEnabled()) return dbGetNextApplicationId(normalizeUserEmail(userEmail))
  const data = readRawApplications()
  const maxId = data.reduce((max, app) => {
    const num = Number.parseInt(app.id, 10)
    return Number.isFinite(num) ? Math.max(max, num) : max
  }, 0)
  return String(maxId + 1).padStart(3, '0')
}

// ── Supabase helpers ─────────────────────────────────────────────────────────

async function dbReadTracker(userEmail: string): Promise<TrackerEntry[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('tracker_entries')
    .select('*')
    .eq('user_email', userEmail)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data || []).map((row: any) => ({
    id: row.id,
    fecha: row.fecha,
    empresa: row.empresa,
    rol: row.rol,
    score: row.score === null ? null : Number(row.score),
    estado: row.estado,
    pdf: Boolean(row.pdf),
    reportSlug: row.report_slug || null,
    url: row.url || '',
    notas: row.notas || '',
  }))
}

async function dbAddTrackerEntry(userEmail: string, entry: Omit<TrackerEntry, 'id'>): Promise<TrackerEntry> {
  if (!supabase) throw new Error('Supabase no está configurado')

  // ID secuencial: buscar el mayor número existente e incrementar
  const { data: existing } = await supabase
    .from('tracker_entries')
    .select('id')
    .eq('user_email', userEmail)

  const maxNum = Math.max(0, ...(existing || []).map(e => {
    const n = parseInt(e.id, 10)
    return isNaN(n) ? 0 : n
  }))
  const id = String(maxNum + 1).padStart(3, '0')

  // Renombrar reportSlug → report_slug para que coincida con la columna de Supabase
  const { reportSlug, ...rest } = entry
  const row = { user_email: userEmail, id, ...rest, report_slug: reportSlug ?? null }
  const { error } = await supabase.from('tracker_entries').insert([row])
  if (error) throw new Error(error.message)
  return { id, ...entry }
}

async function dbUpdateTrackerEntry(userEmail: string, id: string, updates: Partial<TrackerEntry>): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado')
  // Renombrar reportSlug → report_slug y excluir la clave camelCase del objeto enviado
  const { reportSlug, ...rest } = updates
  const dbUpdates: Record<string, unknown> = { ...rest }
  if (reportSlug !== undefined) dbUpdates.report_slug = reportSlug
  const { error } = await supabase
    .from('tracker_entries')
    .update(dbUpdates)
    .match({ id, user_email: userEmail })
  if (error) throw new Error(error.message)
}

async function dbReadPipeline(userEmail: string): Promise<PipelineJob[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('pipeline_jobs')
    .select('*')
    .eq('user_email', userEmail)
    .order('added', { ascending: false })
  if (error) throw new Error(error.message)
  return (data || []).map((row: any) => ({
    url: row.url,
    added: row.added,
    source: row.source || undefined,
  }))
}

async function dbAddToPipeline(userEmail: string, url: string, source?: string): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado')
  const { data, error: findError } = await supabase
    .from('pipeline_jobs')
    .select('id')
    .eq('user_email', userEmail)
    .eq('url', url)
    .limit(1)
  if (findError) throw new Error(findError.message)
  if ((data || []).length > 0) return
  const id = crypto.randomUUID()
  const date = new Date().toISOString().split('T')[0]
  const { error } = await supabase.from('pipeline_jobs').insert([{ id, user_email: userEmail, url, added: date, source }])
  if (error) throw new Error(error.message)
}

async function dbRemoveFromPipeline(userEmail: string, url: string): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado')
  const { error } = await supabase
    .from('pipeline_jobs')
    .delete()
    .match({ user_email: userEmail, url })
  if (error) throw new Error(error.message)
}

async function dbClearScannerPipeline(userEmail: string): Promise<void> {
  if (!supabase) return
  // Elimina todos los jobs del pipeline que NO sean de fuente 'manual'
  // Así el escáner siempre refleja resultados frescos sin borrar lo que el usuario agregó manualmente
  const { error } = await supabase
    .from('pipeline_jobs')
    .delete()
    .eq('user_email', userEmail)
    .neq('source', 'manual')
  if (error) throw new Error(error.message)
}

async function dbReadPortals(userEmail: string): Promise<PortalsConfig> {
  if (!supabase) return { title_filter: { positive: [], negative: [], seniority_boost: [] }, tracked_companies: [], search_queries: [] }
  const { data, error } = await supabase
    .from('portals_config')
    .select('config')
    .eq('user_email', userEmail)
    .single()
  if (error && error.code !== 'PGRST116') throw new Error(error.message)
  return data?.config || { title_filter: { positive: [], negative: [], seniority_boost: [] }, tracked_companies: [], search_queries: [] }
}

async function dbWritePortals(userEmail: string, config: PortalsConfig): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado')
  const { error } = await supabase.from('portals_config').upsert({ user_email: userEmail, config })
  if (error) throw new Error(error.message)
}

async function dbReadProfile(userEmail: string): Promise<Record<string, unknown>> {
  if (!supabase) return {}
  const { data, error } = await supabase
    .from('profiles')
    .select('data')
    .eq('user_email', userEmail)
    .single()
  if (error && error.code !== 'PGRST116') throw new Error(error.message)
  return data?.data || {}
}

async function dbWriteProfile(userEmail: string, data: Record<string, unknown>): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado')
  const { error } = await supabase.from('profiles').upsert({ user_email: userEmail, data })
  if (error) throw new Error(error.message)
}

async function dbReadCV(userEmail: string): Promise<string> {
  if (!supabase) return ''
  const { data, error } = await supabase
    .from('cvs')
    .select('content')
    .eq('user_email', userEmail)
    .single()
  if (error && error.code !== 'PGRST116') throw new Error(error.message)
  return data?.content || ''
}

async function dbWriteCV(userEmail: string, content: string): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado')
  const { error } = await supabase.from('cvs').upsert({ user_email: userEmail, content })
  if (error) throw new Error(error.message)
}

async function dbListReports(userEmail: string): Promise<string[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('reports')
    .select('slug')
    .eq('user_email', userEmail)
  if (error) throw new Error(error.message)
  return (data || []).map((row: any) => row.slug)
}

async function dbReadReport(userEmail: string, slug: string): Promise<string> {
  if (!supabase) return ''
  const { data, error } = await supabase
    .from('reports')
    .select('content')
    .eq('user_email', userEmail)
    .eq('slug', slug)
    .single()
  if (error && error.code !== 'PGRST116') throw new Error(error.message)
  return data?.content || ''
}

async function dbSaveReport(userEmail: string, slug: string, content: string): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado')
  const { error } = await supabase.from('reports').upsert({ user_email: userEmail, slug, content })
  if (error) throw new Error(error.message)
}

async function dbReadApplications(userEmail: string): Promise<Omit<Application, 'cvHtml'>[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('applications')
    .select('id, fecha, empresa, rol, url, "cvTex", "cvPdfFilename", estado, score, notas, "interviewPrep", idioma')
    .eq('user_email', userEmail)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data || []) as Omit<Application, 'cvHtml'>[]
}

async function dbGetApplication(userEmail: string, id: string): Promise<Application | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('user_email', userEmail)
    .eq('id', id)
    .single()
  if (error && error.code !== 'PGRST116') throw new Error(error.message)
  return data || null
}

async function dbSaveApplication(userEmail: string, app: Application): Promise<void> {
  if (!supabase) throw new Error('Supabase no está configurado')
  // coverLetter se excluye del upsert hasta que exista la columna en Supabase.
  // Para agregarla: ALTER TABLE applications ADD COLUMN "coverLetter" text;
  const { coverLetter: _cl, ...appForDb } = app
  const { error } = await supabase.from('applications').upsert({ user_email: userEmail, ...appForDb })
  if (error) throw new Error(error.message)
}

async function dbFindApplicationByUrlOrRole(userEmail: string, url: string | undefined, empresa: string, rol: string): Promise<Application | null> {
  if (!supabase) return null
  if (url) {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('user_email', userEmail)
      .eq('url', url)
      .limit(1)
    if (error) throw new Error(error.message)
    if (data?.length) return data[0] as Application
  }

  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('user_email', userEmail)
    .eq('empresa', empresa)
    .eq('rol', rol)
    .limit(1)
  if (error) throw new Error(error.message)
  return (data && data[0]) || null
}

async function dbGetNextApplicationId(userEmail: string): Promise<string> {
  if (!supabase) return String(1).padStart(3, '0')
  const { data, error } = await supabase
    .from('applications')
    .select('id')
    .eq('user_email', userEmail)
    .order('id', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  const maxId = data?.[0]?.id ? Number.parseInt(data[0].id, 10) : 0
  return String((Number.isFinite(maxId) ? maxId : 0) + 1).padStart(3, '0')
}

export async function getStats(userEmail?: string) {
  if (dbEnabled()) {
    const entries = await readTracker(userEmail)
    const pipeline = await readPipeline(userEmail)
    const reports = await listReports(userEmail)
    const statusCount: Record<string, number> = {}
    entries.forEach(e => {
      statusCount[e.estado] = (statusCount[e.estado] || 0) + 1
    })
    const scored = entries.filter(e => e.score !== null)
    const avgScore = scored.length
      ? (scored.reduce((s, e) => s + (e.score || 0), 0) / scored.length).toFixed(2)
      : null

    return {
      total: entries.length,
      byStatus: statusCount,
      avgScore,
      pipeline: pipeline.length,
      reports: reports.length,
      pdfs: 0,
    }
  }

  const entries = readTrackerLocal()
  const statusCount: Record<string, number> = {}
  entries.forEach(e => {
    statusCount[e.estado] = (statusCount[e.estado] || 0) + 1
  })
  const scored = entries.filter(e => e.score !== null)
  const avgScore = scored.length
    ? (scored.reduce((s, e) => s + (e.score || 0), 0) / scored.length).toFixed(2)
    : null

  return {
    total: entries.length,
    byStatus: statusCount,
    avgScore,
    pipeline: readPipelineLocal().length,
    reports: listReportsLocal().length,
    pdfs: 0,
  }
}

// ── PDF generation (serverless-compatible via @sparticuz/chromium) ────────────

function buildPdfFilename(empresa: string, rol: string, candidateName = '', prefix = 'CV'): string {
  const name = (candidateName || prefix).replace(/\s+/g, '_')
  const emp  = empresa.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')
  const r    = rol.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')
  return `${prefix}_${name}_${emp}_${r}.pdf`
}

export function buildInterviewPrepHtml(prep: string, empresa: string, rol: string): string {
  const safePrep = prep.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Prep. Entrevista ${empresa}</title><style>body{font-family:Arial,Helvetica,sans-serif;color:#111;background:#fff;padding:24px;line-height:1.6;}h1,h2,h3{color:#111;margin-top:1.4rem;}h1{font-size:26px;}h2{font-size:20px;}h3{font-size:17px;}p{margin:0.9rem 0;}ul,ol{margin:0.8rem 0 0.8rem 1.4rem;}code{background:#f3f4f6;padding:0.15rem 0.35rem;border-radius:0.3rem;}pre{white-space:pre-wrap;word-break:break-word;background:#f8fafc;border:1px solid #e5e7eb;padding:16px;border-radius:12px;}</style></head><body><h1>Preparación de Entrevista</h1><p><strong>Empresa:</strong> ${empresa}</p><p><strong>Cargo:</strong> ${rol}</p><pre>${safePrep}</pre></body></html>`
}

// URL del binario de Chromium para @sparticuz/chromium-min (descarga en /tmp en cold start)
const CHROMIUM_BINARY_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar'

async function launchBrowser() {
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_EXECUTION_ENV

  if (isServerless) {
    // Function() evita que tsc transpile import() a require(): chromium-min es ESM-only
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (s: string) => Promise<{ default: { args: string[]; defaultViewport: null; executablePath: (url?: string) => Promise<string> } }>
    const chromium = (await dynamicImport('@sparticuz/chromium-min')).default
    const puppeteer = (await import('puppeteer-core')).default
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(CHROMIUM_BINARY_URL),
      headless: true,
    })
  }

  // Local: system Chrome
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
  ]
  const executablePath = chromePaths.find(p => { try { return fs.existsSync(p) } catch { return false } })
  if (!executablePath) throw new Error('Chrome no encontrado. Instala Chrome o configura CHROME_PATH.')
  const puppeteer = (await import('puppeteer-core')).default
  return puppeteer.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  })
}

export async function generatePDFFromHtml(
  html: string,
  empresa: string,
  rol: string,
  candidateName = '',
  prefix = 'CV'
): Promise<{ buffer: Buffer; filename: string }> {
  const filename = buildPdfFilename(empresa, rol, candidateName, prefix)
  const browser = await launchBrowser()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true })
    return { buffer: Buffer.from(pdf), filename }
  } finally {
    await browser.close()
  }
}

export function readCvTemplate(): string {
  return ''
}

// ── PDF via pdfkit (pure Node.js, no Chrome needed) ──────────────────────────

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
}

export function parseCvDataFromHtml(html: string): CvData {
  const sec = (title: string) => {
    const re = new RegExp(`<div class="section-title">${title}<\\/div>([\\s\\S]*?)(?=<div class="section">|<\\/body>)`)
    return html.match(re)?.[1] || ''
  }

  const name = stripTags(html.match(/<div class="name">([^<]+)<\/div>/)?.[1] || '')

  // contact: two lines separated by <br>
  const contactRaw = html.match(/<div class="contact">([\s\S]*?)<\/div>/)?.[1] || ''
  const [line1 = '', line2 = ''] = contactRaw.split(/<br\s*\/?>/i)
  const parts1 = line1.split(/&nbsp;\|&nbsp;/).map(stripTags).filter(Boolean)
  const parts2 = line2.split(/&nbsp;\|&nbsp;/).map(stripTags).filter(Boolean)
  const [city = '', phone = '', email = ''] = parts1
  const linkedin = parts2.find(p => p.includes('linkedin')) || ''
  const github   = parts2.find(p => p.includes('github'))   || ''

  const summary = stripTags(html.match(/<div class="summary">([\s\S]*?)<\/div>/)?.[1] || '')

  const parseEntries = (sectionHtml: string) =>
    [...sectionHtml.matchAll(/<div class="entry">([\s\S]*?)<\/div>\s*<\/div>/g)].map(m => {
      const inner = m[1]
      const headers = [...inner.matchAll(/<div class="entry-header">([\s\S]*?)<\/div>/g)].map(h => h[1])
      const company = stripTags(headers[0]?.match(/<span class="company">([\s\S]*?)<\/span>/)?.[1] || '')
      const location = stripTags(headers[0]?.match(/<span class="meta">([\s\S]*?)<\/span>/)?.[1] || '')
      const role   = stripTags(headers[1]?.match(/<span class="role">([\s\S]*?)<\/span>/)?.[1] || '')
      const dates  = stripTags(headers[1]?.match(/<span class="meta">([\s\S]*?)<\/span>/)?.[1] || '')
      const bullets = [...inner.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(b => stripTags(b[1]))
      return { company, location, role, dates, bullets }
    })

  const parseProjects = (sectionHtml: string) =>
    [...sectionHtml.matchAll(/<div class="entry">([\s\S]*?)<\/div>\s*<\/div>/g)].map(m => {
      const inner = m[1]
      const header = inner.match(/<div class="entry-header">([\s\S]*?)<\/div>/)?.[1] || ''
      const name   = stripTags(header.match(/<span class="company">([\s\S]*?)<\/span>/)?.[1] || '')
      const year   = stripTags(header.match(/<span class="meta">([\s\S]*?)<\/span>/)?.[1] || '')
      const bullets = [...inner.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(b => stripTags(b[1]))
      return { name, year, bullets }
    })

  const skills: Record<string, string> = {}
  const skillsSection = sec('Habilidades T.cnicas')
  ;[...skillsSection.matchAll(/<div class="skill-line"><strong>([^<]+):<\/strong>\s*([^<]+)<\/div>/g)]
    .forEach(m => { skills[m[1].trim()] = m[2].trim() })

  const education = [...sec('Formaci.n Acad.mica').matchAll(/<div class="edu-entry">([\s\S]*?)<\/div>/g)].map(m => {
    const inner = m[1]
    const title = stripTags(inner.match(/<strong>([^<]+)<\/strong>/)?.[1] || '')
    const rest  = stripTags(inner.replace(/<strong>[^<]+<\/strong>,?\s*/, '').replace(/<span class="edu-year">([^<]+)<\/span>/, ''))
    const year  = stripTags(inner.match(/<span class="edu-year">([^<]+)<\/span>/)?.[1] || '')
    return { title, institution: rest.trim(), year }
  })

  return {
    name,
    contact: { city, phone, email, linkedin, github },
    summary,
    experience: parseEntries(sec('Experiencia Profesional')),
    projects:   parseProjects(sec('Proyectos Destacados')),
    skills,
    education,
  }
}

export async function buildPdfFromCvData(cvData: CvData): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PDFDocument = require('pdfkit')

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 50, bottom: 50, left: 54, right: 54 }, bufferPages: true })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = doc.page.width - 108 // usable width (margins 54+54)
    const gray = '#555555'

    const hr = () => {
      doc.moveTo(54, doc.y).lineTo(54 + W, doc.y).lineWidth(0.5).stroke('#000').moveDown(0.3)
    }
    const section = (title: string) => {
      doc.moveDown(0.5).font('Times-Bold').fontSize(11).text(title.toUpperCase()).moveDown(0.1)
      hr()
    }

    // ── Header ───────────────────────────────────────────────────────────────
    doc.font('Times-Bold').fontSize(18).text(cvData.name.toUpperCase(), { align: 'center' })
    doc.moveDown(0.2)
    const c1 = [cvData.contact.city, cvData.contact.phone, cvData.contact.email].filter(Boolean).join('  |  ')
    doc.font('Times-Roman').fontSize(9.5).fillColor(gray).text(c1, { align: 'center' })
    const c2 = [cvData.contact.linkedin, cvData.contact.github].filter(Boolean).join('  |  ')
    if (c2) doc.text(c2, { align: 'center' })
    doc.fillColor('#000')

    // ── Resumen ───────────────────────────────────────────────────────────────
    section('Resumen Profesional')
    doc.font('Times-Roman').fontSize(10.5).text(cvData.summary, { align: 'justify', lineGap: 1 })

    // helper: two-column row preserving Y alignment
    const row2 = (
      leftText: string, leftFont: string, leftSize: number,
      rightText: string, rightColor: string
    ) => {
      const rowY = doc.y
      doc.font(leftFont).fontSize(leftSize).fillColor('#000').text(leftText, 54, rowY, { width: W * 0.65 })
      const afterLeft = doc.y
      doc.font('Times-Roman').fontSize(10).fillColor(rightColor).text(rightText, 54 + W * 0.65, rowY, { width: W * 0.35, align: 'right' })
      doc.fillColor('#000')
      doc.y = afterLeft  // restore cursor to after left-column text
    }

    // ── Experiencia ───────────────────────────────────────────────────────────
    section('Experiencia Profesional')
    for (const e of cvData.experience) {
      doc.moveDown(0.35)
      row2(e.company, 'Times-Bold', 10.5, e.location, gray)
      row2(e.role, 'Times-Italic', 10.5, e.dates, gray)
      doc.moveDown(0.1)
      for (const b of e.bullets) {
        doc.font('Times-Roman').fontSize(10).fillColor('#000').text(`• ${b}`, 54, doc.y, { width: W, align: 'justify', lineGap: 1 })
      }
    }

    // ── Proyectos ─────────────────────────────────────────────────────────────
    if (cvData.projects.length) {
      section('Proyectos Destacados')
      for (const p of cvData.projects) {
        doc.moveDown(0.35)
        row2(p.name, 'Times-Bold', 10.5, p.year || '', gray)
        doc.moveDown(0.1)
        for (const b of p.bullets) {
          doc.font('Times-Roman').fontSize(10).fillColor('#000').text(`• ${b}`, 54, doc.y, { width: W, align: 'justify', lineGap: 1 })
        }
      }
    }

    // ── Habilidades ───────────────────────────────────────────────────────────
    if (Object.keys(cvData.skills).length) {
      section('Habilidades Técnicas')
      for (const [cat, vals] of Object.entries(cvData.skills)) {
        doc.moveDown(0.2)
        doc.font('Times-Bold').fontSize(10.5).fillColor('#000').text(`${cat}: `, 54, doc.y, { continued: true, width: W })
        doc.font('Times-Roman').fontSize(10.5).text(vals, { lineGap: 1 })
      }
    }

    // ── Educación ─────────────────────────────────────────────────────────────
    if (cvData.education.length) {
      section('Formación Académica')
      for (const ed of cvData.education) {
        doc.moveDown(0.25)
        const label = ed.institution ? `${ed.title}, ${ed.institution}` : ed.title
        row2(label, 'Times-Bold', 10.5, ed.year, gray)
      }
    }

    doc.end()
  })
}

