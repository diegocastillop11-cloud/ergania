// Mantener sincronizado a mano con frontend/src/lib/adminEmails.ts — son dos
// proyectos separados (frontend/backend) sin runtime compartido, así que no
// hay forma de que un solo array cubra ambos. Al menos este archivo es la
// única fuente de verdad del lado servidor: todo endpoint admin del backend
// debe importar de acá, nunca redefinir el array localmente.
export const ADMIN_EMAILS = ['ergania.ai@gmail.com', 'diego.castillop11@gmail.com', 'emesmediacontact@gmail.com']

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email)
}
