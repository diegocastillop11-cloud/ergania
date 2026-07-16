#!/usr/bin/env node
// Setup de un solo uso: crea el Plan de Preapproval de Ergania en MercadoPago
// ($9.990 CLP/mes, cobro automático) y devuelve el MP_PREAPPROVAL_PLAN_ID.
// Usa el mismo MERCADOPAGO_ACCESS_TOKEN que ya tienes para Checkout Pro — no
// necesitas credenciales nuevas de MP, solo agregar esa var a backend/.env si
// no está (la tenías solo en Vercel, no localmente).
//
// Uso:
//   1. Agrega a backend/.env: MERCADOPAGO_ACCESS_TOKEN=...
//   2. node scripts/setup-mp-preapproval-plan.mjs
//   3. Copia el "Plan ID" que imprime al final → esa es tu MP_PREAPPROVAL_PLAN_ID

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

const token = env.MERCADOPAGO_ACCESS_TOKEN
if (!token) {
  console.error('Falta MERCADOPAGO_ACCESS_TOKEN en backend/.env')
  console.error('Sácalo de Vercel (Settings → Environment Variables) o de donde lo guardaste originalmente.')
  process.exit(1)
}

const res = await fetch('https://api.mercadopago.com/preapproval_plan', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    reason: 'Ergania — Plan mensual',
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: 9990,
      currency_id: 'CLP',
    },
    back_url: 'https://ergania.com/subscription/success',
  }),
})

const text = await res.text()
if (!res.ok) {
  console.error(`Error MP ${res.status}: ${text}`)
  process.exit(1)
}

const plan = JSON.parse(text)
console.log(`✓ Plan creado: ${plan.id} (status: ${plan.status})`)
console.log(`\nGuarda esto como MP_PREAPPROVAL_PLAN_ID:\n  ${plan.id}`)
