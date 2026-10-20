// Arranca Ergania en modo local: sin Supabase ni login, datos en backend/.local-data/db.json.
// Uso: npm run local   (o doble clic en Ergania-local.bat)
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT_FRONT = 3001
const children = []

function run(name, cmd, cwd, env) {
  const child = spawn(cmd, { cwd: path.join(root, cwd), shell: true, stdio: 'inherit', env: { ...process.env, ...env } })
  child.on('exit', code => { console.log(`[${name}] terminó (${code})`); shutdown() })
  children.push(child)
}

function shutdown() {
  for (const c of children) { try { c.kill() } catch {} }
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

run('backend', 'npx ts-node src/index.ts', 'backend', { LOCAL_MODE: '1', PORT: '4001' })
run('frontend', `npx vite --mode offline --host 127.0.0.1 --port ${PORT_FRONT}`, 'frontend', {})

const url = `http://localhost:${PORT_FRONT}/dashboard`
console.log(`\nErgania local → ${url}\nDatos guardados en backend/.local-data/db.json\n`)
setTimeout(() => spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true }).unref(), 6000)
