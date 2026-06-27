const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: './backend/.env' })

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function check() {
  const tables = ['tracker_entries', 'applications', 'cvs', 'profiles', 'pipeline_jobs', 'portals_config', 'reports']

  console.log('\n=== SUPABASE DATA CHECK ===\n')

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('user_email').limit(100)
    if (error) {
      console.log(`❌ ${table}: ERROR - ${error.message}`)
    } else {
      const emails = [...new Set((data || []).map(r => r.user_email))]
      const counts = {}
      for (const e of emails) {
        counts[e] = (data || []).filter(r => r.user_email === e).length
      }
      if (emails.length === 0) {
        console.log(`⚠️  ${table}: VACÍA`)
      } else {
        console.log(`✅ ${table}:`)
        for (const [email, count] of Object.entries(counts)) {
          console.log(`   ${email}: ${count} registros`)
        }
      }
    }
  }
}

check().catch(console.error)
