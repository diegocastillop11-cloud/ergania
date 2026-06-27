// IMPORTANTE: dotenv debe cargarse antes que cualquier otro módulo
// que lea process.env al momento de ser importado.
import dotenv from 'dotenv'
import path from 'path'
// override:true para que el .env siempre gane sobre vars heredadas vacías del shell padre
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true })

import express from 'express'
import cors from 'cors'
import { careersRoutes } from './routes/careers'

const app = express()
const PORT = process.env.PORT || 4001

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3001' }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.use('/api/careers', careersRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`Career Ops backend running on http://localhost:${PORT}`)
  console.log(`Supabase: ${process.env.SUPABASE_URL ? '✅ conectado' : '❌ sin configurar'}`)
  console.log(`Anthropic: ${process.env.ANTHROPIC_API_KEY ? '✅ configurado' : '❌ sin configurar'}`)
})
