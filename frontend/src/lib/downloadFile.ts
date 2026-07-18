import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

// El patrón blob + <a download> no dispara el Administrador de Descargas de
// Android dentro del WebView de la app — en nativo escribimos el archivo y
// abrimos la hoja de compartir de Android para que el usuario lo guarde o
// lo envíe directo (WhatsApp, Drive, etc.).
export async function saveBlob(data: Blob, filename: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    return
  }

  const base64Data = await blobToBase64(data)
  const { uri } = await Filesystem.writeFile({ path: filename, data: base64Data, directory: Directory.Cache })
  await Share.share({ url: uri, title: filename })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
