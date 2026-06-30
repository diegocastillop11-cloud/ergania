import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true })

import express from 'express'
import cors from 'cors'
import { careersRoutes } from './routes/careers'
import { subscriptionRoutes } from './routes/subscription'
import { contactRoutes } from './routes/contact'
import { adminRoutes } from './routes/admin'

const app = express()

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3001',
  'https://ergania.com',
  'https://www.ergania.com',
  /\.vercel\.app$/,
]

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    const ok = allowedOrigins.some(o =>
      o instanceof RegExp ? o.test(origin) : o === origin
    )
    cb(ok ? null : new Error('Not allowed by CORS'), ok)
  },
  credentials: true,
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.use('/api/careers', careersRoutes)
app.use('/api/subscription', subscriptionRoutes)
app.use('/api/contact', contactRoutes)
app.use('/api/admin', adminRoutes)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

export default app
