export type LlmProvider = 'gemini' | 'groq' | 'anthropic' | 'openai'

const STORAGE_KEY = 'career-ops-llm-provider'
export const DEFAULT_PROVIDER: LlmProvider = 'gemini'

export function loadLlmProvider(): LlmProvider {
  if (typeof window === 'undefined') return DEFAULT_PROVIDER
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === 'gemini' || raw === 'groq' || raw === 'anthropic' || raw === 'openai') return raw
  } catch {
    // ignore localStorage failures
  }
  return DEFAULT_PROVIDER
}

export function saveLlmProvider(provider: LlmProvider) {
  try {
    window.localStorage.setItem(STORAGE_KEY, provider)
  } catch {
    // ignore localStorage failures
  }
}
