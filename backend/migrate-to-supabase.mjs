/**
 * migrate-to-supabase.mjs
 * Importa todos los datos locales de career-ops a Supabase.
 * Ejecutar una sola vez: node migrate-to-supabase.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { load } from 'js-yaml'
import { config } from 'dotenv'

config()

const USER_EMAIL = 'diego.castillop11@gmail.com'
const CAREER_OPS = process.env.CAREER_OPS_PATH || 'D:/career-ops-main/career-ops'

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

function read(path, fallback = '') {
  try { return readFileSync(path, 'utf-8') } catch { return fallback }
}

// ── 1. Profile ────────────────────────────────────────────────────────────────
async function migrateProfile() {
  const raw = read(join(CAREER_OPS, 'config/profile.yml'))
  if (!raw) return console.log('⚠️  profile.yml no encontrado, skip')
  const data = load(raw)
  const { error } = await sb.from('profiles').upsert({ user_email: USER_EMAIL, data })
  if (error) console.log('❌ profiles:', error.message)
  else console.log('✅ profile migrado')
}

// ── 2. CV ─────────────────────────────────────────────────────────────────────
async function migrateCv() {
  const content = read(join(CAREER_OPS, 'cv.md'))
  if (!content) return console.log('⚠️  cv.md no encontrado, skip')
  const { error } = await sb.from('cvs').upsert({ user_email: USER_EMAIL, content })
  if (error) console.log('❌ cvs:', error.message)
  else console.log('✅ CV migrado (' + content.length + ' chars)')
}

// ── 3. Applications (applications.json) ───────────────────────────────────────
async function migrateApplications() {
  const raw = read(join(CAREER_OPS, 'data/applications.json'), '[]')
  let apps
  try { apps = JSON.parse(raw) } catch { return console.log('❌ applications.json no parseable') }
  if (!apps.length) return console.log('⚠️  applications.json vacío, skip')

  let ok = 0, fail = 0
  for (const app of apps) {
    const row = {
      user_email:       USER_EMAIL,
      id:               app.id,
      fecha:            app.fecha,
      empresa:          app.empresa,
      rol:              app.rol,
      url:              app.url || '',
      jd:               app.jd || '',
      cvHtml:           app.cvHtml || null,
      cvTex:            app.cvTex || null,
      cvPdfFilename:    app.cvPdfFilename || null,
      estado:           app.estado || 'Evaluada',
      score:            app.score ?? null,
      notas:            app.notas || '',
    }
    const { error } = await sb.from('applications').upsert(row)
    if (error) { console.log('❌ app ' + app.id + ':', error.message); fail++ }
    else ok++
  }
  console.log(`✅ applications: ${ok} migradas, ${fail} errores`)
}

// ── 4. Tracker (applications.md markdown table) ───────────────────────────────
async function migrateTracker() {
  const raw = read(join(CAREER_OPS, 'data/applications.md'))
  if (!raw) return console.log('⚠️  applications.md no encontrado, skip')

  const lines = raw.split('\n').filter(l => l.startsWith('|'))
  const dataLines = lines.slice(2) // skip header + separator
  const entries = dataLines.map(line => {
    const cols = line.split('|').map(c => c.trim()).filter((_, i) => i > 0 && i < 11)
    if (cols.length < 6) return null
    const [id, fecha, empresa, rol, scoreRaw, estado, pdfRaw, reportRaw, url, notas] = cols
    const score = parseFloat(scoreRaw)
    const reportMatch = reportRaw?.match(/\[([^\]]+)\]\(([^)]+)\)/)
    return {
      user_email:  USER_EMAIL,
      id:          id || '',
      fecha:       fecha || new Date().toISOString().split('T')[0],
      empresa:     empresa || '',
      rol:         rol || '',
      score:       isNaN(score) ? null : score,
      estado:      estado || 'Evaluada',
      pdf:         pdfRaw === '✅',
      report_slug: reportMatch ? reportMatch[2] : null,
      url:         url || '',
      notas:       notas || '',
    }
  }).filter(Boolean)

  if (!entries.length) return console.log('⚠️  tracker sin entradas, skip')

  let ok = 0, fail = 0
  for (const entry of entries) {
    const { error } = await sb.from('tracker_entries').upsert(entry)
    if (error) { console.log('❌ tracker ' + entry.id + ':', error.message); fail++ }
    else ok++
  }
  console.log(`✅ tracker: ${ok} entradas migradas, ${fail} errores`)
}

// ── 5. Reports (reports/*.md) ─────────────────────────────────────────────────
async function migrateReports() {
  const dir = join(CAREER_OPS, 'reports')
  if (!existsSync(dir)) return console.log('⚠️  reports/ no encontrado, skip')
  const files = readdirSync(dir).filter(f => f.endsWith('.md'))
  if (!files.length) return console.log('⚠️  reports/ vacío, skip')

  let ok = 0, fail = 0
  for (const slug of files) {
    const content = read(join(dir, slug))
    const { error } = await sb.from('reports').upsert({ user_email: USER_EMAIL, slug, content })
    if (error) { console.log('❌ report ' + slug + ':', error.message); fail++ }
    else ok++
  }
  console.log(`✅ reports: ${ok} migrados, ${fail} errores`)
}

// ── Run all ───────────────────────────────────────────────────────────────────
console.log('🚀 Migrando datos locales → Supabase')
console.log('   Usuario:', USER_EMAIL)
console.log('   Supabase:', process.env.SUPABASE_URL)
console.log('')

await migrateProfile()
await migrateCv()
await migrateApplications()
await migrateTracker()
await migrateReports()

console.log('')
console.log('✅ Migración completa. Reinicia el backend.')
