#!/usr/bin/env node
// Chequeo de la configuración de MercadoPago para el cobro recurrente, contra
// la API real. Lee el token de backend/.env — no lo imprime nunca.
//
// Uso:
//   node scripts/mp-preapproval-smoke.mjs                 → revisa cuenta + plan
//   node scripts/mp-preapproval-smoke.mjs <preapproval_id> → revisa una suscripción
//
// Antes de correrlo, en backend/.env:
//   MERCADOPAGO_ACCESS_TOKEN=<token de PRODUCCIÓN de la cuenta empresa>
//   MP_PREAPPROVAL_PLAN_ID=<id que imprime setup-mp-preapproval-plan.mjs>

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', 'backend', '.env')

if (!fs.existsSync(envPath)) {
  console.error(`No existe ${envPath} — creálo con MERCADOPAGO_ACCESS_TOKEN y MP_PREAPPROVAL_PLAN_ID`)
  process.exit(1)
}

const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf-8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })
)

const token = env.MERCADOPAGO_ACCESS_TOKEN
const planId = env.MP_PREAPPROVAL_PLAN_ID

if (!token) {
  console.error('Falta MERCADOPAGO_ACCESS_TOKEN en backend/.env')
  process.exit(1)
}

async function mp(path) {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`)
  return JSON.parse(text)
}

const ok = m => console.log(`  ✓ ${m}`)
const mal = m => console.log(`  ✗ ${m}`)

let problemas = 0

// 1. ¿De qué cuenta es el token? Es EL chequeo que evita el accidente clásico:
//    dejar el token de la cuenta personal creyendo que es el de la empresa.
console.log('\n1. Cuenta del token')
let cuenta
try {
  cuenta = await mp('/users/me')
  ok(`${cuenta.nickname} · ${cuenta.email} · site ${cuenta.site_id} · id ${cuenta.id}`)
  if (cuenta.site_id !== 'MLC') {
    mal(`El site es ${cuenta.site_id}, no MLC (Chile) — el plan está en CLP y no va a calzar`)
    problemas++
  }
  console.log('     ↳ Confirmá a ojo que esta es la cuenta EMPRESA, no la personal.')
} catch (e) {
  mal(`El token no sirve: ${e.message}`)
  process.exit(1)
}

// 2. El plan queda atado a la cuenta que lo creó. Si el token cambió de cuenta
//    y el plan no se regeneró, crear suscripciones falla y nadie puede pagar.
console.log('\n2. Plan de suscripción')
if (!planId) {
  mal('Falta MP_PREAPPROVAL_PLAN_ID — corré antes: node scripts/setup-mp-preapproval-plan.mjs')
  problemas++
} else {
  try {
    const plan = await mp(`/preapproval_plan/${planId}`)
    const monto = plan.auto_recurring?.transaction_amount
    const moneda = plan.auto_recurring?.currency_id
    ok(`${plan.id} · "${plan.reason}" · ${monto} ${moneda} cada ${plan.auto_recurring?.frequency} ${plan.auto_recurring?.frequency_type} · status ${plan.status}`)
    if (String(plan.collector_id) !== String(cuenta.id)) {
      mal(`El plan es de la cuenta ${plan.collector_id}, pero el token es de la ${cuenta.id} — REGENERAR el plan`)
      problemas++
    }
    if (monto !== 9990 || moneda !== 'CLP') {
      mal(`El plan cobra ${monto} ${moneda}, pero la app muestra $9.990 CLP`)
      problemas++
    }
  } catch (e) {
    mal(`No se pudo leer el plan ${planId}: ${e.message}`)
    mal('Si dice 404, el plan es de otra cuenta: regeneralo con setup-mp-preapproval-plan.mjs')
    problemas++
  }
}

// 3. Estado de una suscripción concreta (para después de pagar de prueba).
const preapprovalId = process.argv[2]
if (preapprovalId) {
  console.log('\n3. Suscripción de prueba')
  try {
    const p = await mp(`/preapproval/${preapprovalId}`)
    ok(`status: ${p.status}`)
    ok(`usuario (external_reference): ${p.external_reference || '(vacío — la app no va a saber de quién es)'}`)
    ok(`cuotas cobradas: ${p.summarized?.charged_quantity ?? 0} · último cobro: ${p.summarized?.last_charged_date ?? 'ninguno'}`)
    ok(`próximo cobro: ${p.next_payment_date ?? 'sin fecha'}`)
    if (!p.external_reference) problemas++
  } catch (e) {
    mal(`No se pudo leer el preapproval: ${e.message}`)
    problemas++
  }
}

console.log(problemas === 0
  ? '\nTodo en orden.\n'
  : `\n${problemas} problema(s) — resolverlos ANTES de mergear a master.\n`)
process.exit(problemas === 0 ? 0 : 1)
