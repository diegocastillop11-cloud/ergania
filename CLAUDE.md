# CLAUDE.md

## Proyecto: Ergania

Career ops UI — frontend React/Vite + backend Express/TypeScript con Supabase.
URL producción: https://ergania.com

## Roadmap y estado actual

### Fase 1 — completa y en producción (2026-07-08)

1. **Job boards internacionales** — `frontend/src/pages/careers/CareersPortals.tsx`. 5 regiones
   seleccionables por tabs: Chile, Remoto Global, Estados Unidos, España, LATAM (arrays
   `CHILE_PORTALS` / `GLOBAL_PORTALS` / `US_PORTALS` / `SPAIN_PORTALS` / `LATAM_PORTALS`). El
   filtro por país es dinámico según los portales que el usuario tenga agregados.
2. **CV editable** — botón "Editar CV" en el modal de CV de Postulaciones
   (`CvPreviewPanel` en `frontend/src/pages/careers/CareersPostulaciones.tsx`). Edición
   WYSIWYG in-place vía `designMode` sobre el iframe, no un formulario por campos. Guarda con
   `PATCH /applications/:id/cv` (`ctrl.updateApplicationCv` → `svc.patchCvHtml`). El PDF sigue
   usando el mismo pipeline (`parseCvDataFromHtml` → `buildPdfFromCvData`) sin cambios.
3. **Pretensión de renta** — estimación de renta líquida por oferta específica, NO un formulario
   genérico de "cuánto debería cobrar" en el perfil (se descartó ese diseño original).
   - `evaluateJob` (Evaluar Oferta, `backend/src/controllers/careersController.ts`) usa la
     herramienta `web_search` de Anthropic en vivo para investigar el sueldo real del rol —
     reemplaza la idea original de mantener una tabla de anclas manual (no escalaba a otros
     países). El resultado (`salario_clp`) se persiste en `tracker_entries`.
   - Botón "Pretensión de Renta" en cada Postulación (`SalaryPanel`) reusa ese mismo valor si la
     oferta ya fue evaluada (busca en Tracker por empresa+rol/url y lo copia a
     `applications.salario_clp`) en vez de volver a gastar una consulta — evita que Evaluar
     Oferta y Postulaciones muestren números distintos para la misma oferta. Botón
     "Recalcular con IA" fuerza una consulta nueva si hace falta.
   - Piso legal: `CHILE_MINIMUM_WAGE_CLP` (Ley 21.751, revisar cuando cambie el reajuste).
   - Tabla `salary_anchors` (migraciones 006-008) queda como respaldo de baja prioridad, no como
     fuente principal — no hace falta mantenerla poblada.
4. **Login con Google** — ver sección "Arquitectura de auth" más abajo. No estaba en el roadmap
   original, se agregó ad-hoc antes de este release.

### Fase 2 — internacionalización: completa (2026-07-09)

Motor de IA del backend ya no asume Chile/CLP hardcodeado. Se hizo como trabajo completo y
planificado (no función por función, según lo decidido 2026-07-07): país/moneda dinámicos
(`backend/src/config/countries.ts`, `getCountryConfig`), detección del país real de la oferta
con prioridad sobre el default preseleccionado, y CV/cartas/optimización LinkedIn/sugerencia de
cargos adaptados al idioma detectado.

De paso, en la misma ronda se resolvió una tanda de bugs/gaps reportados por la socia de Diego
(triage completo con `/abogado-del-diablo` — ver histórico de conversación si hace falta el
razonamiento de qué se descartó y por qué):
- `parseCv` (`backend/src/controllers/careersController.ts`) ya no traduce a español un CV
  subido en otro idioma — detecta el idioma original y lo preserva.
- Optimización de LinkedIn (`linkedin_optimization` dentro del perfil, `careersController.ts` /
  `CareersProfile.tsx`) ahora se persiste por perfil — antes vivía solo en estado de React y un
  perfil pisaba el resultado del otro.
- Score de `evaluateJob` normalizado a escala 1.0–5.0 con clamp defensivo (antes el modelo podía
  devolver escala 1-10 y se veía "6.2/5").
- `evaluateJob` reutiliza la evaluación previa de una misma URL en el perfil activo en vez de
  gastar un `web_search` nuevo cada vez (evitaba que la misma oferta mostrara rentas distintas en
  cada re-evaluación) — botón "Recalcular ahora" para forzar una consulta fresca.
- Tracker: cada entrada guarda `perfil_id` (migración `011_tracker_perfil.sql`) y muestra un
  badge de qué perfil evaluó/postuló cada oferta.
- Generador de CV base con instrucciones (`POST /cv/optimize`, `CareersProfile.tsx`): aplica las
  "Instrucciones de Redacción de CV" al CV base (no solo al de una postulación puntual), con
  preview y descarga en PDF sin pasar por `Application`.
- Escáner: filtro Chile/Remoto sobre resultados ya encontrados (no es scraping nuevo — ver nota
  abajo sobre por qué "resto del mundo" no se construyó).

**Pendiente real de Fase 2:**
- Pagos con PayPal / otras plataformas LATAM.
- Reviews de empresas desde Glassdoor / Trustpilot (ver nota legal: ninguna de las dos tiene API
  pública gratuita para esto — evaluar Trustpilot Business API o partners de datos).

### Fase 3 — pendiente

- Job board para que empresas publiquen ofertas directamente (nuevo tipo de cuenta B2B).
- Job board de proyectos cortos / freelance (reusa la infraestructura del anterior).
- Postulaciones con video (grabación/carga + Supabase Storage).

### Fase 4 — pendiente (exploratorio, sin fecha)

- Voz + traducción en vivo (speech-to-text, costo alto por uso).
- Integración con LinkedIn para ver conexiones en la empresa a la que se postula — riesgo alto:
  la API oficial de LinkedIn no expone esto a nivel de búsqueda; investigar antes de comprometer
  la feature.

### Backlog — features premium fuera del trial (decisión de Diego, 2026-07-09)

Estos 3 items fueron evaluados con `/abogado-del-diablo` y descartados para construir ahora (no
ayudan a convertir un pagante en el trial de 3 días, y algunos traen mantenimiento recurrente).
Diego decidió que, cuando se construyan, NO deben estar incluidos en el trial gratuito de 3 días
— son funciones de pago — pero SÍ deben promocionarse/mostrarse en la app (ej. landing o
dashboard) como disponibles solo con suscripción activa, para generar el gancho de upgrade. No
implementar el paywall ni la promoción todavía — es una nota de producto para cuando se aborden:

- **Escaneo real de portales de otros países** ("resto del mundo" del Escáner) — requiere
  construir parsers nuevos por portal/región desde cero (hoy los 7 portales del Escáner —
  GetOnBoard, LinkedIn, Indeed, Computrabajo, Bumeran, Laborum, Trabajando.cl — están todos
  cableados a Chile). Proyecto grande, no un fix.
- **Portal First Job** — nuevo scraper, mismo riesgo que Indeed (puede romperse por anti-bot sin
  aviso, sin monitoreo en prod para detectarlo).
- **Speedtest / video / audio de presentación** (para requisitos de proficiencia de idioma de
  empresas extranjeras) — feature nueva completa con subida a Supabase Storage y UI de captura.

## Reglas generales

1. Leer archivos antes de escribir código.
2. Preferir edición sobre reescritura completa.
3. Sin comentarios obvios; solo cuando el WHY no es evidente.
4. Soluciones simples y directas, sin abstracciones prematuras.
5. Trabajar de forma ordenada para gastar pocos tokens: leer → editar → commit.

## Stack

- **Frontend**: React + Vite + TailwindCSS · `frontend/src/`
- **Backend**: Express + TypeScript como Vercel Serverless Function · `backend/src/` · entry: `api/index.ts`
- **Auth/DB**: Supabase (anon key en frontend, service role key en backend)
- **Pagos**: MercadoPago Checkout Pro (no Preapproval)
- **Deploy**: Vercel — push a `master` → deploy automático

## Arquitectura de auth

Frontend envía `Authorization: Bearer <supabase_access_token>` en todas las peticiones.
Backend llama `supabaseAdmin.auth.getUser(token)` para verificar.

Login con Google: `signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/dashboard' } })`
en `frontend/src/lib/AuthContext.tsx`. Requiere Google configurado como provider en Supabase
(Client ID/Secret de Google Cloud Console) y, sobre todo, la config de **Authentication → URL
Configuration** en Supabase:
- **Site URL**: debe ser `https://ergania.com` (viene por defecto en `http://localhost:3000` al
  crear el proyecto — si no se cambia, cualquier redirect que Supabase no reconozca cae ahí).
- **Redirect URLs**: debe incluir `https://ergania.com/**`, `https://www.ergania.com/**` (el
  dominio real redirige a `www`, así que `window.location.origin` calcula `www.ergania.com` en
  producción) y `https://*.vercel.app/**` (para poder probarlo en previews).

Si falta cualquiera de estas entradas, Supabase completa el login OAuth correctamente pero
redirige de vuelta a `localhost:3000` con el `access_token` en el hash — no es un bug de código,
es el fallback silencioso de Supabase cuando el `redirectTo` no matchea el allow-list.

## Variables de entorno requeridas en Vercel

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
MERCADOPAGO_ACCESS_TOKEN     # access token de MP (empieza con APP_USR-)
FRONTEND_URL                 # https://ergania.com
```

Frontend (prefix `VITE_`):
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

### ⚠️ Gotcha: env vars de Preview están escopeadas por rama, no generales

Las 4 vars de arriba (`SUPABASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `FRONTEND_URL`)
solo existen en Vercel para ramas específicas ya usadas antes (`vercel env ls` lo muestra como
`Preview (nombre-de-rama)`), **no** para "Preview" en general. Toda rama nueva sale en negro
(`supabaseUrl is required`) hasta que se agregan a mano para esa rama:

```
vercel env add SUPABASE_URL preview <nombre-de-rama> --value "https://nbywvjvtucohhlofqlbc.supabase.co" --yes
vercel env add VITE_SUPABASE_URL preview <nombre-de-rama> --value "..." --yes
vercel env add VITE_SUPABASE_ANON_KEY preview <nombre-de-rama> --value "..." --yes
vercel env add FRONTEND_URL preview <nombre-de-rama> --value "https://ergania.com" --yes
git commit --allow-empty -m "chore: rebuild preview con env vars de la rama" && git push
```

`vercel env add NAME preview --value ... --yes` (sin rama, para "todas las Preview") falla en modo
no interactivo/agente — el CLI devuelve `action_required: git_branch_required` en loop sin ejecutar
nunca. Hay que escopear por rama sí o sí desde este entorno, o hacerlo a mano desde el dashboard
(Settings → Environment Variables → editar cada var → marcar "Preview" sin restringir a una rama).

**Antes de copiar el valor de otra rama/Production, verificar que no tenga basura pegada**
(pasó con `SUPABASE_URL`, que en Production quedó como `https://...supabase.co\r\n` — el texto
literal `\r\n`, no un salto de línea real — probablemente pegado sin querer al configurarlo la
primera vez). El código limpia BOM (`clean()` en `backend/src/config/supabase.ts`) pero NO esto,
y produce errores confusos tipo `"Token inválido: Unexpected end of JSON input"` en vez de un
error claro de URL malformada. Verificar con:

```
vercel env pull .tmp_env --environment=preview --git-branch=<rama> --yes
grep "^SUPABASE_URL=" .tmp_env | od -c   # no debe haber nada raro después de "supabase.co\""
rm .tmp_env
```

## Sistema de suscripciones

- `trial` (3 días al registrarse) → `pending_payment` (al crear checkout) → `active` (30 días tras pago aprobado) → `expired`/`cancelled`
- Tabla Supabase: `subscriptions` (UNIQUE user_id)
- MP webhook: `POST /api/subscription/webhook` (no auth, responde siempre 200)
- Back URLs de MP: `/subscription/success`, `/subscription/failure`, `/subscription/pending`

Archivos clave:
- `backend/src/services/subscriptionService.ts` — lógica MP + Supabase
- `backend/src/controllers/subscriptionController.ts`
- `backend/src/routes/subscription.ts`
- `frontend/src/hooks/useSubscription.ts`
- `frontend/src/components/subscription/SubscriptionBanner.tsx`

## Landing page

- Ruta pública `/` → `frontend/src/pages/Landing.tsx`
- Diseño Variante B: crema (#FAF7F2) + terracota (#C4633A) + Playfair Display
- Usuarios ya autenticados → redirect automático a `/dashboard`
- Copy: español neutro profesional chileno (no argentino — sin voseo)

## Routing (App.tsx)

```
/          → Landing (pública)
/login     → Login
/dashboard → CareersDashboard  } todos protegidos por ProtectedLayout
/busqueda  → CareersBusqueda   } (layout route sin path propio)
/scanner   → CareersScanner    }
...etc
```

## Cuándo usar G Stack

| Situación | Skill |
|-----------|-------|
| Bug difícil de reproducir | `/investigate` |
| Quiero ver variantes de UI | `/design-shotgun` |
| Revisar código antes de PR | `/review` |
| QA de la app en producción | `/qa` |
| Diseño de una nueva feature | `/spec` |
| Deploy completo con review | `/ship` |
| Auditoría visual | `/design-review` |

## G Stack — Herramientas disponibles

Instalado en `~/.claude/skills/gstack` (v1.58.5.0).

| Skill | Descripción |
|-------|-------------|
| `/autoplan` | Pipeline de revisión automática (CEO, design, eng, DX) |
| `/browse` | Navegador headless para QA y dogfooding |
| `/qa` | QA completo de la app |
| `/qa-only` | Solo QA sin build |
| `/review` | Code review del diff actual |
| `/ship` | Flujo completo land + deploy |
| `/health` | Dashboard de calidad del código |
| `/investigate` | Debugging sistemático con análisis de causa raíz |
| `/design-review` | Auditoría visual de diseño |
| `/design-consultation` | Consultoría de sistema de diseño |
| `/design-html` | Genera HTML/CSS de producción |
| `/design-shotgun` | Genera múltiples variantes de diseño |
| `/spec` | Genera spec técnico de una feature |
| `/office-hours` | Sesión estilo YC Office Hours |
| `/retro` | Retrospectiva del trabajo |
| `/plan-eng-review` | Revisión de plan de ingeniería |
| `/plan-design-review` | Revisión de plan de diseño |
| `/plan-ceo-review` | Revisión de plan a nivel CEO |
| `/plan-devex-review` | Revisión de DX del plan |
| `/benchmark` | Detección de regresiones de performance |
| `/canary` | Monitoreo post-deploy |
| `/freeze` | Restringe ediciones a un directorio |
| `/guard` | Modo seguro completo |
| `/careful` | Advertencias para comandos destructivos |
| `/scrape` | Scraping de páginas web |
| `/learn` | Modo aprendizaje sobre el codebase |
| `/diagram` | Genera diagramas desde descripción en inglés |
| `/document-generate` | Genera documentación desde cero |
| `/document-release` | Actualiza docs post-deploy |
| `/skillify` | Crea nuevas skills de gstack |
| `/cso` | Modo Chief Security Officer |
| `/codex` | Wrapper de OpenAI Codex CLI |
| `/make-pdf` | Genera PDFs |
| `/context-save` / `/context-restore` | Guarda y restaura contexto de trabajo |
| `/gstack-upgrade` | Actualiza gstack a la última versión |

## Skill routing

Cuando la solicitud del usuario encaja con una skill disponible, invocarla via la herramienta Skill.

- Bugs/errores → `/investigate`
- QA/probar comportamiento → `/qa` o `/qa-only`
- Code review/diff → `/review`
- Variantes de diseño → `/design-shotgun`
- Pulido visual → `/design-review`
- Nueva feature (diseño) → `/spec`
- Ship/deploy/PR → `/ship`
