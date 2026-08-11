import { useEffect } from 'react'

const DEFAULT_TITLE = 'Ergania — Encuentra trabajo con IA'

export function useDocumentMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title

    // index.html ya trae una description por defecto y el prerender la reemplaza
    // por la de cada ruta: solo hay que actualizar su contenido, nunca sacarla del
    // head, o una navegación SPA dejaría la página sin description.
    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    const previous = meta.getAttribute('content') ?? ''
    meta.setAttribute('content', description)

    return () => {
      document.title = DEFAULT_TITLE
      meta?.setAttribute('content', previous)
    }
  }, [title, description])
}
