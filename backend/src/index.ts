import app from './app'

const PORT = process.env.PORT || 4001

// En modo local no hay login real (cualquier token entra), así que solo se escucha en loopback.
const HOST = process.env.LOCAL_MODE === '1' ? '127.0.0.1' : undefined

app.listen(Number(PORT), HOST as string, () => {
  console.log(`Ergania backend running on http://localhost:${PORT}`)
  console.log(`Base de datos: ${process.env.LOCAL_MODE === '1' ? '💾 local (JSON, sin Supabase)' : process.env.SUPABASE_URL ? '✅ Supabase conectado' : '❌ sin configurar'}`)
  console.log(`Anthropic: ${process.env.ANTHROPIC_API_KEY ? '✅ configurado' : '❌ sin configurar'}`)
})
