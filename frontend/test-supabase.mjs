import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync(new URL('./.env.local', import.meta.url)).toString().split('\n').reduce((acc, line) => {
  const [k, ...rest] = line.split('=')
  if (!k) return acc
  acc[k.trim()] = rest.join('=').trim()
  return acc
}, {})

const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY

console.log('Using URL:', url)
console.log('Using KEY prefix:', key && key.slice(0, 10))

const supabase = createClient(url, key)

async function run(){
  try{
    const { data, error } = await supabase.from('careers').select().limit(1)
    console.log('Query result:', { data, error: error && error.message })
  }catch(e){
    console.error('Exception:', e.message)
  }
}

run()
