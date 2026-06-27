import { useState } from 'react'
import { X, Key, ExternalLink, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { loadApiKeys, saveApiKeys, type ApiKeyStore } from '../../lib/userApiKeys'

interface Props {
  onClose: () => void
}

const PROVIDERS = [
  {
    id: 'gemini' as const,
    label: 'Gemini Flash',
    badge: 'Gratis',
    badgeColor: 'bg-green-900 text-green-300',
    placeholder: 'AIzaSy...',
    link: 'https://aistudio.google.com/apikey',
    linkLabel: 'Obtén tu key gratis en Google AI Studio',
    hint: '1.500 req/día gratis · Recomendado',
  },
  {
    id: 'groq' as const,
    label: 'Groq / Llama',
    badge: 'Gratis',
    badgeColor: 'bg-green-900 text-green-300',
    placeholder: 'gsk_...',
    link: 'https://console.groq.com',
    linkLabel: 'Obtén tu key gratis en Groq Console',
    hint: '14.400 req/día gratis · Alternativa',
  },
  {
    id: 'anthropic' as const,
    label: 'Anthropic / Claude',
    badge: 'Pago',
    badgeColor: 'bg-yellow-900 text-yellow-300',
    placeholder: 'sk-ant-...',
    link: 'https://console.anthropic.com/settings/keys',
    linkLabel: 'Obtén tu key en Anthropic Console',
    hint: 'De pago · Muy alta calidad',
  },
  {
    id: 'openai' as const,
    label: 'OpenAI / ChatGPT',
    badge: 'Pago',
    badgeColor: 'bg-yellow-900 text-yellow-300',
    placeholder: 'sk-proj-...',
    link: 'https://platform.openai.com/api-keys',
    linkLabel: 'Obtén tu key en OpenAI Platform',
    hint: 'De pago · Alternativa premium',
  },
]

export default function ApiKeySettingsModal({ onClose }: Props) {
  const [keys, setKeys] = useState<ApiKeyStore>(() => loadApiKeys())
  const [show, setShow] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState(false)

  function handleSave() {
    // Only save non-empty keys (trim whitespace)
    const cleaned: ApiKeyStore = {}
    for (const p of PROVIDERS) {
      const val = (keys[p.id] || '').trim()
      if (val) cleaned[p.id] = val
    }
    saveApiKeys(cleaned)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-blue-400" />
            <h2 className="text-white font-semibold text-base">Mis API Keys</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-5">
          <p className="text-sm text-gray-400">
            Ingresa tus propias keys. Se guardan solo en tu navegador, nunca se envían a terceros.
          </p>

          {PROVIDERS.map(p => (
            <div key={p.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-200">{p.label}</label>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.badgeColor}`}>
                  {p.badge}
                </span>
                {keys[p.id] && (
                  <CheckCircle2 size={14} className="text-green-400 ml-auto" />
                )}
              </div>
              <div className="relative">
                <input
                  type={show[p.id] ? 'text' : 'password'}
                  value={keys[p.id] || ''}
                  onChange={e => setKeys(k => ({ ...k, [p.id]: e.target.value }))}
                  placeholder={p.placeholder}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShow(s => ({ ...s, [p.id]: !s[p.id] }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {show[p.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{p.hint}</span>
                <a
                  href={p.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  <ExternalLink size={10} /> {p.linkLabel}
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-gray-800 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            Solo en tu navegador. Nunca se envían al servidor.
          </p>
          <button
            onClick={handleSave}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              saved
                ? 'bg-green-700 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {saved ? '✓ Guardado' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
