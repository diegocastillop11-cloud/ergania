const AUTH_ERRORS: Record<string, string> = {
  'Invalid login credentials':                 'Correo o contraseña incorrectos',
  'Email not confirmed':                       'Debes confirmar tu correo antes de ingresar',
  'User already registered':                   'Ya existe una cuenta con ese correo',
  'Password should be at least 6 characters':  'La contraseña debe tener al menos 6 caracteres',
  'Signup is disabled':                        'El registro está desactivado temporalmente',
  'Email rate limit exceeded':                 'Demasiados intentos. Espera unos minutos e intenta de nuevo',
  'Invalid email':                             'El correo electrónico no es válido',
  'User not found':                            'No existe una cuenta con ese correo',
  'over_email_send_rate_limit':                'Demasiados correos enviados. Espera antes de intentar de nuevo',
}

export function translateAuthError(msg: string): string {
  for (const [en, es] of Object.entries(AUTH_ERRORS)) {
    if (msg.toLowerCase().includes(en.toLowerCase())) return es
  }
  return msg
}
