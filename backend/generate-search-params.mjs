/**
 * Genera parámetros de búsqueda desde el perfil con Claude y los guarda en Supabase.
 * node generate-search-params.mjs
 */
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { config } from 'dotenv'
config()

const USER_EMAIL = 'diego.castillo.p11@gmail.com'
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 1. Leer perfil y CV desde Supabase
const { data: profRow } = await sb.from('profiles').select('data').eq('user_email', USER_EMAIL).single()
const { data: cvRow }   = await sb.from('cvs').select('content').eq('user_email', USER_EMAIL).single()

const profile = profRow?.data ?? {}
const cv      = cvRow?.content ?? ''

const roles       = profile.target_roles?.primary?.join(', ') ?? ''
const superpowers = profile.narrative?.superpowers?.join('\n') ?? ''
const location    = profile.location ?? {}
const comp        = profile.compensation ?? {}

console.log('Perfil cargado:', profile.candidate?.full_name)
console.log('Roles actuales:', roles)
console.log('Generando parámetros con Claude...\n')

// 2. Llamar a Claude
const response = await claude.messages.create({
  model: 'claude-haiku-4-5',
  max_tokens: 2000,
  system: 'Eres un experto en búsqueda de empleo en Chile. Analizas CVs y perfiles para generar los mejores parámetros de búsqueda.',
  messages: [{
    role: 'user',
    content: `Analiza este perfil profesional y genera parámetros de búsqueda para el mercado laboral chileno.

PERFIL:
- Nombre: ${profile.candidate?.full_name}
- Roles objetivo: ${roles}
- Superpoderes: ${superpowers}
- Ubicación: ${location.city}, ${location.region}
- Disponibilidad: ${location.modalidad ?? 'Remoto o Híbrido'}
- Compensación objetivo: ${comp.target_range}

CV (extracto):
${cv.slice(0, 3000)}

Retorna SOLO JSON válido (sin markdown, sin explicaciones):
{
  "title_filter": {
    "positive": ["SQL", "T-SQL", "SQL Server", "Data", "Base de Datos", "DBA", "Analytics", "BI", "Power BI", "Azure", "Python", "ETL", "Reportería", "Stored Procedures"],
    "negative": ["Call Center", "Ventas", "Telemarketing", "Soporte L1", "Help Desk", "Cajero", "Junior sin experiencia", "PHP", "Java Developer", "Android", "iOS", "Blockchain"],
    "seniority_boost": ["Senior", "Especialista", "Analista Senior", "Lead"]
  },
  "search_queries": [
    {"name": "nombre descriptivo", "query": "término de búsqueda exacto", "enabled": true}
  ],
  "tracked_companies": []
}

REGLAS para title_filter.positive: tecnologías y términos del CV (10-15 items)
REGLAS para title_filter.negative: roles que definitivamente no le sirven (8-12 items)
REGLAS para search_queries: 6-8 búsquedas específicas para portales chilenos como GetOnBoard, Laborum, LinkedIn Chile`,
  }],
})

const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('')
const match = text.match(/\{[\s\S]*\}/)
if (!match) { console.error('Claude no devolvió JSON válido:\n', text); process.exit(1) }

let config_data
try { config_data = JSON.parse(match[0]) }
catch (e) { console.error('Error parseando JSON:', e.message); console.log(match[0]); process.exit(1) }

console.log('✅ Generado:')
console.log('  Positive:', config_data.title_filter?.positive?.length, 'términos')
console.log('  Negative:', config_data.title_filter?.negative?.length, 'términos')
console.log('  Queries:', config_data.search_queries?.length, 'búsquedas')
console.log('\nQueries generadas:')
config_data.search_queries?.forEach((q, i) => console.log(`  ${i+1}. [${q.enabled?'✓':'✗'}] ${q.name}: "${q.query}"`))

// 3. Guardar en Supabase
const { error } = await sb.from('portals_config').upsert({ user_email: USER_EMAIL, config: config_data })
if (error) { console.error('\n❌ Error guardando:', error.message); process.exit(1) }

console.log('\n✅ Guardado en Supabase. Recarga la app.')
