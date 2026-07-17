import { useState } from 'react'
import { X, Key, ExternalLink, CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { loadApiKeys, saveApiKeys, type ApiKeyStore } from '../../lib/userApiKeys'
import { useTranslation } from '../../lib/i18n/LanguageContext'

interface Props {
  onClose: () => void
}

const PROVIDERS = [
  { id: 'gemini' as const,    label: 'Gemini Flash',       free: true,  placeholder: 'AIzaSy...',   link: 'https://aistudio.google.com/apikey' },
  { id: 'groq' as const,      label: 'Groq / Llama',       free: true,  placeholder: 'gsk_...',     link: 'https://console.groq.com' },
  { id: 'anthropic' as const, label: 'Anthropic / Claude', free: false, placeholder: 'sk-ant-...',  link: 'https://console.anthropic.com/settings/keys' },
  { id: 'openai' as const,    label: 'OpenAI / ChatGPT',   free: false, placeholder: 'sk-proj-...', link: 'https://platform.openai.com/api-keys' },
]

export default function ApiKeySettingsModal({ onClose }: Props) {
  const { t } = useTranslation()
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
      <div className="bg-[var(--bg-surface)] border border-[var(--border-alt)] rounded-2xl w-full max-w-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--border-default)]">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-blue-400" />
            <h2 className="text-[var(--text-primary)] font-semibold text-base">{t('apiKeyModal.title')}</h2>
          </div>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-5">
          <p className="text-sm text-[var(--text-tertiary)]">
            {t('apiKeyModal.intro')}
          </p>

          {PROVIDERS.map(p => (
            <div key={p.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-200">{p.label}</label>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${p.free ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'}`}>
                  {p.free ? t('apiKeyModal.free') : t('apiKeyModal.paid')}
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
                  className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-alt)] rounded-lg px-3 py-2 pr-10 text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShow(s => ({ ...s, [p.id]: !s[p.id] }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                >
                  {show[p.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">{t(`apiKeyModal.providers.${p.id}.hint`)}</span>
                <a
                  href={p.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                >
                  <ExternalLink size={10} /> {t(`apiKeyModal.providers.${p.id}.linkLabel`)}
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 border-t border-[var(--border-default)] flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--text-muted)]">
            {t('apiKeyModal.footerNote')}
          </p>
          <button
            onClick={handleSave}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              saved
                ? 'bg-green-700 text-[var(--text-primary)]'
                : 'bg-blue-600 hover:bg-blue-500 text-[var(--text-primary)]'
            }`}
          >
            {saved ? t('apiKeyModal.saved') : t('apiKeyModal.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
