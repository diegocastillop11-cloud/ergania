import { useState, FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, Lock, Loader, AlertCircle, UserPlus, LogIn, Eye, EyeOff, MessageSquare } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import ContactModal from '../components/ContactModal'

type Mode = 'login' | 'register'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  )
}

export default function Login() {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [mode,      setMode]      = useState<Mode>(searchParams.get('tab') === 'registro' ? 'register' : 'login')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [showConf,  setShowConf]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error,     setError]     = useState('')
  const [info,      setInfo]      = useState('')

  const [showContact, setShowContact] = useState(false)

  const reset = (m: Mode) => { setMode(m); setError(''); setInfo(''); setConfirm('') }

  const handleGoogle = async () => {
    setError('')
    setInfo('')
    setGoogleLoading(true)
    const { error } = await signInWithGoogle()
    if (error) { setError(error); setGoogleLoading(false) }
    // si no hay error, Supabase redirige a Google — no hace falta apagar el loading
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')

    if (mode === 'register') {
      if (password !== confirm) return setError('Las contraseñas no coinciden')
      if (password.length < 6)  return setError('La contraseña debe tener al menos 6 caracteres')
    }

    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError(error)
      else navigate('/dashboard')
    } else {
      const { error, session } = await signUp(email, password)
      if (error) setError(error)
      else if (session) navigate('/dashboard')
      else setInfo('¡Cuenta creada! Revisa tu correo para confirmar y luego inicia sesión.')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="Ergania" className="w-14 h-14 rounded-2xl mb-4 shadow-lg object-contain" />
          <h1 className="text-2xl font-bold text-white">Ergania</h1>
          <p className="text-gray-500 text-sm mt-1">Búsqueda laboral con IA · Chile 🇨🇱</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 shadow-xl">

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-gray-800 rounded-xl p-1">
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => reset(m)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === m
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {m === 'login'
                  ? <><LogIn size={14} /> Ingresar</>
                  : <><UserPlus size={14} /> Registrarme</>
                }
              </button>
            ))}
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 bg-white hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed text-gray-800 rounded-xl text-sm font-medium border border-gray-300 transition-colors"
          >
            {googleLoading
              ? <Loader size={16} className="animate-spin" />
              : <GoogleIcon />
            }
            {mode === 'login' ? 'Ingresar con Google' : 'Registrarme con Google'}
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-600">o con tu correo</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Email */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Correo electrónico</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@correo.cl"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Contraseña</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-10 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Confirm password — solo en registro */}
            {mode === 'register' && (
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Confirmar contraseña</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  <input
                    type={showConf ? 'text' : 'password'}
                    required
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repite tu contraseña"
                    className={`w-full bg-gray-800 border rounded-xl pl-9 pr-10 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:border-transparent transition-colors ${
                      confirm && confirm !== password
                        ? 'border-red-600 focus:ring-red-500'
                        : confirm && confirm === password
                          ? 'border-green-600 focus:ring-green-500'
                          : 'border-gray-700 focus:ring-blue-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConf(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showConf ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {/* Indicador en tiempo real */}
                {confirm && (
                  <p className={`text-xs mt-1 ${confirm === password ? 'text-green-400' : 'text-red-400'}`}>
                    {confirm === password ? '✓ Las contraseñas coinciden' : '✗ No coinciden'}
                  </p>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 bg-red-950 border border-red-800 rounded-xl px-3 py-2.5 text-sm text-red-300">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Info */}
            {info && (
              <div className="bg-green-950 border border-green-800 rounded-xl px-3 py-2.5 text-sm text-green-300">
                {info}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || (mode === 'register' && !!confirm && confirm !== password)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-colors"
            >
              {loading
                ? <><Loader size={14} className="animate-spin" /> Procesando...</>
                : mode === 'login'
                  ? <><LogIn size={14} /> Ingresar</>
                  : <><UserPlus size={14} /> Crear cuenta</>
              }
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Tus datos se guardan en tu propia cuenta y nadie más los ve.
        </p>

        <div className="flex justify-center mt-3">
          <button
            onClick={() => setShowContact(true)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <MessageSquare size={12} />
            ¿Tienes dudas? Contáctanos
          </button>
        </div>

      </div>

      {showContact && <ContactModal onClose={() => setShowContact(false)} />}
    </div>
  )
}
