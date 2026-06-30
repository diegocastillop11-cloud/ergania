import { useState, FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, Lock, Loader, AlertCircle, UserPlus, LogIn, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

type Mode = 'login' | 'register'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [mode,      setMode]      = useState<Mode>(searchParams.get('tab') === 'registro' ? 'register' : 'login')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPass,  setShowPass]  = useState(false)
  const [showConf,  setShowConf]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [info,      setInfo]      = useState('')

  const reset = (m: Mode) => { setMode(m); setError(''); setInfo(''); setConfirm('') }

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
      </div>
    </div>
  )
}
