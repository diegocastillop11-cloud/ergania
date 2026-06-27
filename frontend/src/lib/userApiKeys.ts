import { type LlmProvider } from './llmProvider'

const STORAGE_KEY = 'career-ops-api-keys'

export interface ApiKeyStore {
  gemini?: string
  groq?: string
  anthropic?: string
  openai?: string
}

export function loadApiKeys(): ApiKeyStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as ApiKeyStore) : {}
  } catch {
    return {}
  }
}

export function saveApiKeys(keys: ApiKeyStore) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
  } catch { /* ignore */ }
}

export function getKeyForProvider(provider: LlmProvider): string {
  const keys = loadApiKeys()
  return keys[provider] || ''
}

export function hasKeyForProvider(provider: LlmProvider): boolean {
  return Boolean(getKeyForProvider(provider))
}
