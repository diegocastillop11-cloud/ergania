#!/usr/bin/env node
// Registra un reporte en el módulo Reportes del Admin (tabla internal_reports)
// sin pasar por la UI — pensado para que Claude lo corra apenas termina un fix
// o una feature, así Diego nunca tiene que crearlo a mano.
//
// Uso:
//   node scripts/log-report.mjs --tipo correccion --titulo "Título corto" \
//     --contenido "Descripción para alguien no técnico" \
//     --checklist "Ítem 1|Ítem 2|Ítem 3"
//
// tipo: correccion | implementacion | plan

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', 'backend', '.env')
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

function arg(name, required = true) {
  const i = process.argv.indexOf(`--${name}`)
  const v = i !== -1 ? process.argv[i + 1] : undefined
  if (required && !v) { console.error(`Falta --${name}`); process.exit(1) }
  return v
}

const tipo = arg('tipo')
const titulo = arg('titulo')
const contenido = arg('contenido', false) || ''
const checklistRaw = arg('checklist', false) || ''
const checklist = checklistRaw
  ? checklistRaw.split('|').map(t => t.trim()).filter(Boolean).map(texto => ({ texto, marcado: false, nota: '' }))
  : []

if (!['correccion', 'implementacion', 'plan'].includes(tipo)) {
  console.error('--tipo debe ser correccion | implementacion | plan')
  process.exit(1)
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const { data, error } = await supabase
  .from('internal_reports')
  .insert({ tipo, titulo, contenido, checklist, observaciones: '' })
  .select()
  .single()

if (error) { console.error('Error al registrar reporte:', error.message); process.exit(1) }
console.log(`✓ Reporte registrado: [${tipo}] ${titulo} (id ${data.id})`)
