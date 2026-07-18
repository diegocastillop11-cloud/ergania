export const ADMIN_EMAILS = ['ergania.ai@gmail.com', 'diego.castillop11@gmail.com', 'emesmediacontact@gmail.com']

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email)
}
