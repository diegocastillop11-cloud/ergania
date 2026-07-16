#!/usr/bin/env node
// Setup de un solo uso: crea el Producto + Plan de suscripción de Ergania en
// PayPal (USD $12.99/mes) y devuelve el PAYPAL_PLAN_ID para guardar en Vercel.
// Lee PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_ENV de backend/.env —
// así el Secret nunca se escribe a mano en la terminal ni se pega en el chat.
//
// Uso:
//   1. Agrega a backend/.env: PAYPAL_CLIENT_ID=... / PAYPAL_CLIENT_SECRET=... / PAYPAL_ENV=sandbox
//   2. node scripts/setup-paypal-plan.mjs
//   3. Copia el "Plan ID" que imprime al final → esa es tu PAYPAL_PLAN_ID

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

const clientId = env.PAYPAL_CLIENT_ID
const clientSecret = env.PAYPAL_CLIENT_SECRET
const isLive = (env.PAYPAL_ENV || 'sandbox').trim() === 'live'
const API = isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'

if (!clientId || !clientSecret) {
  console.error('Falta PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET en backend/.env')
  process.exit(1)
}

console.log(`Ambiente: ${isLive ? 'LIVE (dinero real)' : 'sandbox (pruebas)'}`)

async function getToken() {
  const res = await fetch(`${API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`oauth2 ${res.status}: ${text}`)
  return JSON.parse(text).access_token
}

async function ppFetch(token, path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text}`)
  return JSON.parse(text)
}

const token = await getToken()
console.log('✓ Token obtenido')

const product = await ppFetch(token, '/v1/catalogs/products', {
  name: 'Ergania — Plan mensual',
  description: 'Acceso completo a Ergania: postulaciones, CV con IA, escáner de ofertas',
  type: 'SERVICE',
  category: 'SOFTWARE',
})
console.log(`✓ Producto creado: ${product.id}`)

const plan = await ppFetch(token, '/v1/billing/plans', {
  product_id: product.id,
  name: 'Ergania — Plan mensual',
  description: 'USD $12.99/mes, cobro automático',
  billing_cycles: [{
    frequency: { interval_unit: 'MONTH', interval_count: 1 },
    tenure_type: 'REGULAR',
    sequence: 1,
    total_cycles: 0, // 0 = indefinido, se renueva hasta que se cancele
    pricing_scheme: { fixed_price: { value: '12.99', currency_code: 'USD' } },
  }],
  payment_preferences: {
    auto_bill_outstanding: true,
    payment_failure_threshold: 3,
  },
})
console.log(`✓ Plan creado: ${plan.id} (status: ${plan.status})`)
console.log(`\nGuarda esto como PAYPAL_PLAN_ID en Vercel:\n  ${plan.id}`)
