import { useEffect } from 'react'

const DEFAULT_TITLE = 'Ergania — Encuentra trabajo con IA'

export function useDocumentMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title

    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', description)

    return () => {
      document.title = DEFAULT_TITLE
      meta?.remove()
    }
  }, [title, description])
}
