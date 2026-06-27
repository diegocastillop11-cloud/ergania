import app from './app'

const PORT = process.env.PORT || 4001

app.listen(PORT, () => {
  console.log(`Ergania backend running on http://localhost:${PORT}`)
  console.log(`Supabase: ${process.env.SUPABASE_URL ? '✅ conectado' : '❌ sin configurar'}`)
  console.log(`Anthropic: ${process.env.ANTHROPIC_API_KEY ? '✅ configurado' : '❌ sin configurar'}`)
})
