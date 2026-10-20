/**
 * Reemplazo local de Supabase para correr Ergania sin base de datos ni internet
 * (salvo las llamadas a la IA). Se activa con LOCAL_MODE=1 — ver scripts/local.mjs.
 *
 * Implementa solo el subconjunto de supabase-js que usa el backend (from().select/
 * insert/update/upsert/delete + filtros) sobre un único JSON en disco. No es una
 * base de datos: sin índices, sin transacciones, sin esquema. Para un solo usuario
 * en su máquina alcanza de sobra.
 */
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

export const LOCAL_MODE = process.env.LOCAL_MODE === '1'

export const LOCAL_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: (process.env.LOCAL_USER_EMAIL || 'local@ergania.local').trim().toLowerCase(),
}

const DATA_FILE = process.env.LOCAL_DB_FILE
  || path.resolve(__dirname, '../../.local-data/db.json')

type Row = Record<string, any>
type Db = Record<string, Row[]>

// Claves primarias reales de las migraciones: upsert() sin onConflict resuelve contra ellas.
const PRIMARY_KEYS: Record<string, string[]> = {
  tracker_entries: ['user_email', 'id'],
  applications: ['user_email', 'id'],
  reports: ['user_email', 'slug'],
  profiles: ['user_email'],
  cvs: ['user_email'],
  portals_config: ['user_email'],
  perfil_profiles: ['user_email', 'perfil_id'],
  perfil_cvs: ['user_email', 'perfil_id'],
  perfil_portals: ['user_email', 'perfil_id'],
  subscriptions: ['user_id'],
}

let db: Db | null = null

function load(): Db {
  if (db) return db
  try {
    db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as Db
  } catch {
    db = {}
  }
  // Cuenta exenta: getSubscriptionStatus() la trata como 'active' sin fechas ni pagos.
  const subs = (db.subscriptions ??= [])
  if (!subs.some(s => s.user_id === LOCAL_USER.id)) {
    subs.push({ user_id: LOCAL_USER.id, status: 'active', is_exempt: true, created_at: new Date().toISOString() })
    save()
  }
  return db
}

function save() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
  // Escribir a un temporal y renombrar: un corte a mitad de escritura no deja el JSON truncado.
  const tmp = DATA_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(db))
  fs.renameSync(tmp, DATA_FILE)
}

const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)))

type Pred = (r: Row) => boolean

function cmp(a: any, b: any): number {
  if (a == null || b == null) return a == null ? (b == null ? 0 : -1) : 1
  return a < b ? -1 : a > b ? 1 : 0
}

function likeRegex(pattern: string, ci: boolean): RegExp {
  const esc = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.')
  return new RegExp(`^${esc}$`, ci ? 'i' : '')
}

function makePred(col: string, op: string, val: any): Pred {
  switch (op) {
    case 'eq': return r => r[col] === val
    case 'neq': return r => r[col] !== val
    case 'gt': return r => r[col] != null && r[col] > val
    case 'gte': return r => r[col] != null && r[col] >= val
    case 'lt': return r => r[col] != null && r[col] < val
    case 'lte': return r => r[col] != null && r[col] <= val
    case 'is': return r => (val === null || val === 'null' ? r[col] == null : r[col] === val)
    case 'in': {
      const list: any[] = Array.isArray(val) ? val : String(val).replace(/^\(|\)$/g, '').split(',')
      return r => list.includes(r[col])
    }
    case 'like': return r => typeof r[col] === 'string' && likeRegex(val, false).test(r[col])
    case 'ilike': return r => typeof r[col] === 'string' && likeRegex(val, true).test(r[col])
    default: throw new Error(`[localDb] operador no soportado: ${op}`)
  }
}

// "a.eq.1,b.is.null" y "a.not.is.null" — mismo formato que PostgREST.
function parseOr(expr: string): Pred {
  const preds = expr.split(',').map(part => {
    const [col, op, ...rest] = part.split('.')
    if (op === 'not') {
      const [op2, ...v2] = rest
      const inner = makePred(col, op2, v2.join('.'))
      return (r: Row) => !inner(r)
    }
    return makePred(col, op, rest.join('.'))
  })
  return r => preds.some(p => p(r))
}

class Query implements PromiseLike<{ data: any; error: any; count?: number | null }> {
  private action: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private preds: Pred[] = []
  private orders: { col: string; asc: boolean }[] = []
  private limitN: number | null = null
  private rangeFrom: number | null = null
  private payload: any
  private onConflict: string[] | null = null
  private cols = '*'
  private returning = false
  private countMode = false
  private headOnly = false
  private mode: 'many' | 'single' | 'maybe' = 'many'

  constructor(private table: string) {}

  select(cols = '*', opts?: { count?: string; head?: boolean }) {
    if (this.action === 'select') this.cols = cols
    else this.returning = true
    if (opts?.count) this.countMode = true
    if (opts?.head) this.headOnly = true
    return this
  }
  insert(rows: Row | Row[]) { this.action = 'insert'; this.payload = rows; return this }
  update(patch: Row) { this.action = 'update'; this.payload = patch; return this }
  upsert(rows: Row | Row[], opts?: { onConflict?: string }) {
    this.action = 'upsert'; this.payload = rows
    this.onConflict = opts?.onConflict ? opts.onConflict.split(',').map(s => s.trim()) : null
    return this
  }
  delete() { this.action = 'delete'; return this }

  eq(c: string, v: any) { return this.f(c, 'eq', v) }
  neq(c: string, v: any) { return this.f(c, 'neq', v) }
  gt(c: string, v: any) { return this.f(c, 'gt', v) }
  gte(c: string, v: any) { return this.f(c, 'gte', v) }
  lt(c: string, v: any) { return this.f(c, 'lt', v) }
  lte(c: string, v: any) { return this.f(c, 'lte', v) }
  is(c: string, v: any) { return this.f(c, 'is', v) }
  in(c: string, v: any[]) { return this.f(c, 'in', v) }
  like(c: string, v: string) { return this.f(c, 'like', v) }
  ilike(c: string, v: string) { return this.f(c, 'ilike', v) }
  filter(c: string, op: string, v: any) { return this.f(c, op, v) }
  not(c: string, op: string, v: any) { const p = makePred(c, op, v); this.preds.push(r => !p(r)); return this }
  or(expr: string) { this.preds.push(parseOr(expr)); return this }
  match(obj: Row) { for (const [k, v] of Object.entries(obj)) this.f(k, 'eq', v); return this }

  order(col: string, opts?: { ascending?: boolean }) { this.orders.push({ col, asc: opts?.ascending !== false }); return this }
  limit(n: number) { this.limitN = n; return this }
  range(from: number, to: number) { this.rangeFrom = from; this.limitN = to - from + 1; return this }
  single() { this.mode = 'single'; return this }
  maybeSingle() { this.mode = 'maybe'; return this }

  private f(c: string, op: string, v: any) { this.preds.push(makePred(c, op, v)); return this }

  private project(rows: Row[]): Row[] {
    if (this.cols === '*' || this.cols.includes('(')) return rows
    const names = this.cols.split(',').map(s => s.trim()).filter(Boolean)
    return rows.map(r => Object.fromEntries(names.map(n => [n, r[n]])))
  }

  private pk(): string[] { return this.onConflict ?? PRIMARY_KEYS[this.table] ?? ['id'] }

  private fresh(row: Row): Row {
    const now = new Date().toISOString()
    const out = { ...row }
    if (this.pk().length === 1 && this.pk()[0] === 'id' && out.id == null) out.id = crypto.randomUUID()
    if (out.created_at == null) out.created_at = now
    return out
  }

  private run(): { data: any; error: any; count?: number | null } {
    const tbl = (load()[this.table] ??= [])
    const matches = () => tbl.filter(r => this.preds.every(p => p(r)))
    let affected: Row[] = []

    if (this.action === 'insert') {
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map(r => this.fresh(r))
      const keys = this.pk()
      for (const r of rows) {
        const dup = keys.every(k => r[k] != null) && tbl.some(t => keys.every(k => t[k] === r[k]))
        if (dup) return { data: null, error: { code: '23505', message: `duplicate key value violates unique constraint (${this.table})` } }
      }
      tbl.push(...rows); affected = rows; save()
    } else if (this.action === 'upsert') {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload]
      const keys = this.pk()
      for (const input of rows) {
        const existing = keys.every(k => input[k] != null)
          ? tbl.find(t => keys.every(k => t[k] === input[k]))
          : undefined
        if (existing) { Object.assign(existing, input, { updated_at: new Date().toISOString() }); affected.push(existing) }
        else { const r = this.fresh(input); tbl.push(r); affected.push(r) }
      }
      save()
    } else if (this.action === 'update') {
      affected = matches()
      const now = new Date().toISOString()
      for (const r of affected) Object.assign(r, this.payload, { updated_at: now })
      save()
    } else if (this.action === 'delete') {
      affected = matches()
      const gone = new Set(affected)
      db![this.table] = tbl.filter(r => !gone.has(r))
      save()
    } else {
      affected = matches()
    }

    const readsRows = this.action === 'select' || this.returning
    let rows = affected
    if (readsRows) {
      for (const { col, asc } of [...this.orders].reverse()) {
        rows = [...rows].sort((a, b) => (asc ? 1 : -1) * cmp(a[col], b[col]))
      }
      const total = rows.length
      if (this.rangeFrom != null) rows = rows.slice(this.rangeFrom)
      if (this.limitN != null) rows = rows.slice(0, this.limitN)
      const out = clone(this.project(rows))
      const count = this.countMode ? total : null
      if (this.headOnly) return { data: null, error: null, count }
      if (this.mode === 'many') return { data: out, error: null, count }
      if (out.length === 1) return { data: out[0], error: null, count }
      if (out.length === 0) {
        return this.mode === 'maybe'
          ? { data: null, error: null, count }
          : { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, count }
      }
      return { data: null, error: { code: 'PGRST116', message: 'multiple rows returned' }, count }
    }
    return { data: null, error: null, count: this.countMode ? affected.length : null }
  }

  then<R1, R2>(
    onfulfilled?: ((v: { data: any; error: any; count?: number | null }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((e: any) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    let result: { data: any; error: any; count?: number | null }
    try { result = this.run() } catch (e: any) { result = { data: null, error: { message: e?.message ?? String(e) } } }
    return Promise.resolve(result).then(onfulfilled, onrejected)
  }
}

function localUser() {
  return {
    id: LOCAL_USER.id,
    email: LOCAL_USER.email,
    user_metadata: { terms_accepted_at: '2026-01-01T00:00:00.000Z' },
    created_at: '2026-01-01T00:00:00.000Z',
  }
}

const notSupported = (what: string) => ({ data: null, error: { message: `${what} no está disponible en modo local` } })

/** Cliente con la misma forma que SupabaseClient para lo que el backend consume. */
export function createLocalClient(): any {
  load()
  return {
    from: (table: string) => new Query(table),
    auth: {
      getUser: async () => ({ data: { user: localUser() }, error: null }),
      admin: {
        getUserById: async () => ({ data: { user: localUser() }, error: null }),
        listUsers: async () => ({ data: { users: [localUser()] }, error: null }),
        deleteUser: async () => notSupported('Eliminar cuenta'),
      },
    },
    storage: { from: () => ({ upload: async () => notSupported('Storage'), download: async () => notSupported('Storage'), remove: async () => notSupported('Storage') }) },
  }
}
