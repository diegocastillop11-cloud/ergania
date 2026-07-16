import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import {
  Users, Crown, CreditCard, MessageSquare, TrendingUp, LogOut, DollarSign,
  Plus, Trash2, Pencil, X, FileText, ChevronDown, ChevronUp, Check, Save, Download, FlaskConical, Send, Megaphone,
} from 'lucide-react'

const ADMIN_EMAIL = 'ergania.ai@gmail.com'

interface SalaryAnchor {
  id: string
  carrera: string
  pais: string
  rango_min: number
  rango_max: number
  moneda: string
  nota: string | null
}

const EMPTY_ANCHOR_FORM = { carrera: '', pais: '', rango_min: '', rango_max: '', moneda: 'CLP', nota: '' }

function SalaryAnchorsTab({ token }: { token: string }) {
  const [anchors, setAnchors] = useState<SalaryAnchor[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY_ANCHOR_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const load = () => {
    setLoading(true)
    fetch('/api/admin/salary-anchors', { headers: authHeaders })
      .then(r => r.json())
      .then(d => { setAnchors(d.anchors || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const startEdit = (a: SalaryAnchor) => {
    setEditingId(a.id)
    setForm({
      carrera: a.carrera, pais: a.pais,
      rango_min: String(a.rango_min), rango_max: String(a.rango_max),
      moneda: a.moneda, nota: a.nota || '',
    })
  }

  const cancelEdit = () => { setEditingId(null); setForm(EMPTY_ANCHOR_FORM) }

  const submit = async () => {
    setError('')
    const payload = {
      carrera: form.carrera.trim(),
      pais: form.pais.trim(),
      rango_min: Number(form.rango_min),
      rango_max: Number(form.rango_max),
      moneda: form.moneda.trim() || 'CLP',
      nota: form.nota.trim() || null,
    }
    if (!payload.carrera || !payload.pais || !Number.isFinite(payload.rango_min) || !Number.isFinite(payload.rango_max)) {
      setError('Carrera, país y ambos rangos (numéricos) son requeridos')
      return
    }
    try {
      const res = await fetch(
        editingId ? `/api/admin/salary-anchors/${editingId}` : '/api/admin/salary-anchors',
        { method: editingId ? 'PUT' : 'POST', headers: authHeaders, body: JSON.stringify(payload) }
      )
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error al guardar') }
      cancelEdit()
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm('¿Eliminar esta ancla salarial?')) return
    await fetch(`/api/admin/salary-anchors/${id}`, { method: 'DELETE', headers: authHeaders })
    load()
  }

  return (
    <div className="p-5 space-y-5">
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white">{editingId ? 'Editar ancla' : 'Agregar ancla salarial'}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <input placeholder="Carrera (ej: Data Analyst)" value={form.carrera}
            onChange={e => setForm(f => ({ ...f, carrera: e.target.value }))}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
          <input placeholder="País (ej: Chile)" value={form.pais}
            onChange={e => setForm(f => ({ ...f, pais: e.target.value }))}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
          <input placeholder="Moneda (CLP, USD...)" value={form.moneda}
            onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
          <input placeholder="Rango mínimo" type="number" value={form.rango_min}
            onChange={e => setForm(f => ({ ...f, rango_min: e.target.value }))}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
          <input placeholder="Rango máximo" type="number" value={form.rango_max}
            onChange={e => setForm(f => ({ ...f, rango_max: e.target.value }))}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
          <input placeholder="Nota (opcional)" value={form.nota}
            onChange={e => setForm(f => ({ ...f, nota: e.target.value }))}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <div className="flex gap-2">
          <button onClick={submit} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium">
            {editingId ? <Pencil size={13} /> : <Plus size={13} />} {editingId ? 'Guardar cambios' : 'Agregar'}
          </button>
          {editingId && (
            <button onClick={cancelEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs">
              <X size={13} /> Cancelar
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : anchors.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-6">Sin anclas salariales configuradas aún.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
              <th className="text-left px-3 py-2">Carrera</th>
              <th className="text-left px-3 py-2">País</th>
              <th className="text-left px-3 py-2">Rango</th>
              <th className="text-left px-3 py-2">Nota</th>
              <th className="text-right px-3 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {anchors.map(a => (
              <tr key={a.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-3 py-2 text-white font-medium">{a.carrera}</td>
                <td className="px-3 py-2 text-gray-400">{a.pais}</td>
                <td className="px-3 py-2 text-green-400 font-mono text-xs">
                  {a.rango_min.toLocaleString('es-CL')}-{a.rango_max.toLocaleString('es-CL')} {a.moneda}
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs">{a.nota || '—'}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => startEdit(a)} className="p-1 text-gray-500 hover:text-blue-400"><Pencil size={14} /></button>
                  <button onClick={() => remove(a.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Reportes internos (correcciones / implementaciones / planes) ──────────────

interface ChecklistItem { texto: string; marcado: boolean; nota: string }
interface Report {
  id: string
  tipo: 'correccion' | 'implementacion' | 'plan'
  titulo: string
  fecha: string
  contenido: string
  checklist: ChecklistItem[]
  observaciones: string
}

const TIPO_LABEL: Record<Report['tipo'], { label: string; color: string; bg: string }> = {
  correccion:     { label: 'Corrección',     color: 'text-red-400',    bg: 'bg-red-900/30' },
  implementacion: { label: 'Implementación', color: 'text-blue-400',   bg: 'bg-blue-900/30' },
  plan:           { label: 'Plan futuro',    color: 'text-violet-400', bg: 'bg-violet-900/30' },
}

function ReportCard({ report, token, onChanged }: { report: Report; token: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(report.checklist)
  const [observaciones, setObservaciones] = useState(report.observaciones)
  const [newItem, setNewItem] = useState('')
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const tipoCfg = TIPO_LABEL[report.tipo]

  const downloadPdf = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`/api/admin/reports/${report.id}/pdf`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Error al generar el PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Reporte_${report.titulo.replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      window.alert('No se pudo descargar el PDF')
    } finally {
      setDownloading(false)
    }
  }

  const dirty = JSON.stringify(checklist) !== JSON.stringify(report.checklist) || observaciones !== report.observaciones

  const save = async () => {
    setSaving(true)
    try {
      await fetch(`/api/admin/reports/${report.id}`, {
        method: 'PUT', headers: authHeaders,
        body: JSON.stringify({ ...report, checklist, observaciones }),
      })
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`¿Eliminar el reporte "${report.titulo}"?`)) return
    await fetch(`/api/admin/reports/${report.id}`, { method: 'DELETE', headers: authHeaders })
    onChanged()
  }

  const toggleItem = (i: number) => setChecklist(cl => cl.map((it, idx) => idx === i ? { ...it, marcado: !it.marcado } : it))
  const updateNota  = (i: number, nota: string) => setChecklist(cl => cl.map((it, idx) => idx === i ? { ...it, nota } : it))
  const removeItem  = (i: number) => setChecklist(cl => cl.filter((_, idx) => idx !== i))
  const addItem = () => {
    if (!newItem.trim()) return
    setChecklist(cl => [...cl, { texto: newItem.trim(), marcado: false, nota: '' }])
    setNewItem('')
  }

  const doneCount = checklist.filter(i => i.marcado).length

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/30 transition-colors text-left">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${tipoCfg.bg} ${tipoCfg.color}`}>{tipoCfg.label}</span>
          <span className="text-white font-medium text-sm truncate">{report.titulo}</span>
          <span className="text-gray-600 text-xs shrink-0">{report.fecha}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {checklist.length > 0 && <span className="text-xs text-gray-500">{doneCount}/{checklist.length}</span>}
          {open ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-3">
          {report.contenido && <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">{report.contenido}</p>}

          {checklist.length > 0 && (
            <div className="space-y-2">
              {checklist.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <button
                    onClick={() => toggleItem(i)}
                    className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center ${item.marcado ? 'bg-green-600 border-green-600' : 'border-gray-600'}`}
                  >
                    {item.marcado && <Check size={11} className="text-white" />}
                  </button>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className={`text-sm ${item.marcado ? 'text-gray-500 line-through' : 'text-gray-200'}`}>{item.texto}</p>
                    <input
                      value={item.nota}
                      onChange={e => updateNota(i, e.target.value)}
                      placeholder="Observación de este ítem (opcional)"
                      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button onClick={() => removeItem(i)} className="text-gray-600 hover:text-red-400 shrink-0"><X size={13} /></button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              placeholder="Agregar ítem al checklist..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button onClick={addItem} className="px-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs"><Plus size={13} /></button>
          </div>

          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-1 block">Observaciones generales</label>
            <textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Notas de la reunión, feedback, etc."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-y"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={!dirty || saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium"
            >
              <Save size={13} /> {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button
              onClick={downloadPdf}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-xs font-medium"
            >
              <Download size={13} /> {downloading ? 'Generando...' : 'Descargar PDF'}
            </button>
            <button onClick={remove} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-400 rounded-lg text-xs">
              <Trash2 size={13} /> Eliminar reporte
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ReportsTab({ token }: { token: string }) {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ tipo: 'correccion' as Report['tipo'], titulo: '', fecha: new Date().toISOString().slice(0, 10), contenido: '', checklistText: '' })
  const [error, setError] = useState('')
  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const load = () => {
    setLoading(true)
    fetch('/api/admin/reports', { headers: authHeaders })
      .then(r => r.json())
      .then(d => { setReports(d.reports || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const submit = async () => {
    setError('')
    if (!form.titulo.trim()) { setError('El título es requerido'); return }
    const checklist = form.checklistText.split('\n').map(t => t.trim()).filter(Boolean)
      .map(texto => ({ texto, marcado: false, nota: '' }))
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ ...form, checklist }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error al guardar') }
      setForm({ tipo: 'correccion', titulo: '', fecha: new Date().toISOString().slice(0, 10), contenido: '', checklistText: '' })
      load()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  return (
    <div className="p-5 space-y-5">
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white">Nuevo reporte</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={form.tipo}
            onChange={e => setForm(f => ({ ...f, tipo: e.target.value as Report['tipo'] }))}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="correccion">Corrección</option>
            <option value="implementacion">Implementación</option>
            <option value="plan">Plan futuro</option>
          </select>
          <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
          <input placeholder="Título" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 sm:col-span-1" />
        </div>
        <textarea
          placeholder="Descripción del reporte"
          value={form.contenido}
          onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))}
          rows={3}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-y"
        />
        <textarea
          placeholder="Ítems del checklist, uno por línea (opcional)"
          value={form.checklistText}
          onChange={e => setForm(f => ({ ...f, checklistText: e.target.value }))}
          rows={3}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-y font-mono"
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button onClick={submit} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium">
          <Plus size={13} /> Crear reporte
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Cargando...</p>
      ) : reports.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-6">Sin reportes todavía.</p>
      ) : (
        <div className="space-y-2">
          {reports.map(r => <ReportCard key={r.id} report={r} token={token} onChanged={load} />)}
        </div>
      )}
    </div>
  )
}

// ── Correos masivos ────────────────────────────────────────────────────────

interface BulkUser { id: string; email: string; createdAt: string; sub: any; evaluationsCount: number }

interface BulkEmail {
  id: string; titulo: string; asunto: string; cuerpo: string
  cta1_texto: string | null; cta1_url: string | null
  cta2_texto: string | null; cta2_url: string | null
}

interface ScheduledEmail {
  id: string; bulk_email_id: string; send_date: string; max_evals: number
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
  sent_at: string | null; result: any
}

const EMPTY_BULK_EMAIL_FORM = { titulo: '', asunto: '', cuerpo: '', cta1_texto: '', cta1_url: '', cta2_texto: '', cta2_url: '' }
type BulkEmailFormState = typeof EMPTY_BULK_EMAIL_FORM

function BulkEmailFields({ form, setForm }: { form: BulkEmailFormState; setForm: (fn: (f: BulkEmailFormState) => BulkEmailFormState) => void }) {
  return (
    <>
      <input placeholder="Título interno" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
      <input placeholder="Asunto del correo" value={form.asunto} onChange={e => setForm(f => ({ ...f, asunto: e.target.value }))}
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
      <textarea
        placeholder="Cuerpo del correo. Deja una línea en blanco entre párrafos. Las líneas que empiecen con '- ' se muestran como lista."
        value={form.cuerpo} onChange={e => setForm(f => ({ ...f, cuerpo: e.target.value }))} rows={8}
        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-y font-mono" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input placeholder="Texto botón principal (opcional)" value={form.cta1_texto} onChange={e => setForm(f => ({ ...f, cta1_texto: e.target.value }))}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        <input placeholder="URL botón principal" value={form.cta1_url} onChange={e => setForm(f => ({ ...f, cta1_url: e.target.value }))}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        <input placeholder="Texto link secundario (opcional)" value={form.cta2_texto} onChange={e => setForm(f => ({ ...f, cta2_texto: e.target.value }))}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
        <input placeholder="URL link secundario" value={form.cta2_url} onChange={e => setForm(f => ({ ...f, cta2_url: e.target.value }))}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" />
      </div>
    </>
  )
}

function BulkEmailCard({ email, token, userList, onChanged, onDeleted, startOpen }: {
  email: BulkEmail; token: string; userList: BulkUser[]
  onChanged: () => void; onDeleted: () => void; startOpen?: boolean
}) {
  const [open, setOpen] = useState(!!startOpen)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(EMPTY_BULK_EMAIL_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [maxEvals, setMaxEvals] = useState(1)
  const [sentEmails, setSentEmails] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null)
  const [loadingAux, setLoadingAux] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ sent: string[]; skipped: string[]; failed: { email: string; error: string }[] } | null>(null)
  const [sendError, setSendError] = useState('')

  const [scheduled, setScheduled] = useState<ScheduledEmail[]>([])
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleMaxEvals, setScheduleMaxEvals] = useState(1)
  const [scheduling, setScheduling] = useState(false)
  const [scheduleError, setScheduleError] = useState('')

  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const loadAux = () => {
    setLoadingAux(true)
    Promise.all([
      fetch(`/api/admin/bulk-emails/${email.id}/preview`, { headers: authHeaders }).then(r => r.json()),
      fetch(`/api/admin/bulk-emails/${email.id}/sent`, { headers: authHeaders }).then(r => r.json()),
      fetch(`/api/admin/bulk-emails/${email.id}/scheduled`, { headers: authHeaders }).then(r => r.json()),
    ]).then(([previewData, sentData, scheduledData]) => {
      setPreview(previewData)
      setSentEmails(new Set((sentData.sent || []).map((r: any) => r.email)))
      setScheduled(scheduledData.scheduled || [])
      setLoadingAux(false)
    }).catch(() => setLoadingAux(false))
  }

  useEffect(() => { if (open) loadAux() }, [open, email.id])

  const candidates = userList.filter(u =>
    u.sub?.status === 'trial' && !u.sub?.is_test && u.evaluationsCount <= maxEvals
  )

  // Al cambiar el filtro, selecciona por defecto a los candidatos que aún no
  // recibieron este correo — así el envío nunca parte seleccionando a quien
  // ya se le mandó.
  useEffect(() => {
    setSelected(new Set(candidates.filter(u => !sentEmails.has(u.email)).map(u => u.email)))
    setSendResult(null)
  }, [maxEvals, userList.length, sentEmails.size])

  const toggle = (addr: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(addr) ? next.delete(addr) : next.add(addr)
      return next
    })
  }

  const allSelected = candidates.length > 0 && candidates.every(u => selected.has(u.email))
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(candidates.map(u => u.email)))
  }

  const startEdit = () => {
    setForm({
      titulo: email.titulo, asunto: email.asunto, cuerpo: email.cuerpo,
      cta1_texto: email.cta1_texto || '', cta1_url: email.cta1_url || '',
      cta2_texto: email.cta2_texto || '', cta2_url: email.cta2_url || '',
    })
    setSaveError('')
    setEditing(true)
  }

  const saveEdit = async () => {
    setSaveError('')
    if (!form.titulo.trim() || !form.asunto.trim()) { setSaveError('Título y asunto son requeridos'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/bulk-emails/${email.id}`, {
        method: 'PUT', headers: authHeaders, body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error al guardar') }
      setEditing(false)
      onChanged()
      loadAux()
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`¿Eliminar el correo "${email.titulo}"? Esta acción no se puede deshacer.`)) return
    await fetch(`/api/admin/bulk-emails/${email.id}`, { method: 'DELETE', headers: authHeaders })
    onDeleted()
  }

  const send = async () => {
    if (selected.size === 0) return
    if (!window.confirm(`¿Enviar este correo a ${selected.size} usuario${selected.size === 1 ? '' : 's'}? Esta acción no se puede deshacer.`)) return
    setSending(true)
    setSendError('')
    setSendResult(null)
    try {
      const res = await fetch(`/api/admin/bulk-emails/${email.id}/send`, {
        method: 'POST', headers: authHeaders, body: JSON.stringify({ emails: Array.from(selected) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al enviar')
      setSendResult(data)
      setSentEmails(prev => new Set([...prev, ...data.sent]))
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Error al enviar')
    } finally {
      setSending(false)
    }
  }

  const schedule = async () => {
    setScheduleError('')
    if (!scheduleDate) { setScheduleError('Elige una fecha'); return }
    setScheduling(true)
    try {
      const res = await fetch(`/api/admin/bulk-emails/${email.id}/scheduled`, {
        method: 'POST', headers: authHeaders,
        body: JSON.stringify({ send_date: scheduleDate, max_evals: scheduleMaxEvals }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al programar')
      setScheduled(prev => [...prev, data.scheduled])
      setScheduleDate('')
    } catch (err: unknown) {
      setScheduleError(err instanceof Error ? err.message : 'Error al programar')
    } finally {
      setScheduling(false)
    }
  }

  const cancelScheduled = async (id: string) => {
    if (!window.confirm('¿Cancelar este envío programado?')) return
    await fetch(`/api/admin/scheduled/${id}`, { method: 'DELETE', headers: authHeaders })
    setScheduled(prev => prev.filter(s => s.id !== id))
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/30 transition-colors text-left">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-white font-medium text-sm truncate">{email.titulo}</span>
          <span className="text-gray-500 text-xs truncate hidden sm:inline">{email.asunto}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {scheduled.some(s => s.status === 'pending') && (
            <span className="bg-blue-600/20 text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">Programado</span>
          )}
          {open ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-4">

          {/* Edición de texto */}
          {editing ? (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
              <BulkEmailFields form={form} setForm={setForm} />
              {saveError && <p className="text-red-400 text-xs">{saveError}</p>}
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium">
                  <Save size={13} /> {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs">
                  <X size={13} /> Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs">
                <Pencil size={13} /> Editar texto
              </button>
              <button onClick={remove} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-400 rounded-lg text-xs">
                <Trash2 size={13} /> Eliminar correo
              </button>
            </div>
          )}

          {/* Preview */}
          {loadingAux ? (
            <p className="text-gray-500 text-xs">Cargando...</p>
          ) : preview && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-700 text-xs text-gray-400">
                Vista previa · Asunto: <span className="text-white">{preview.subject}</span>
              </div>
              <iframe title={`preview-${email.id}`} srcDoc={preview.html} className="w-full bg-white" style={{ height: 380 }} />
            </div>
          )}

          {/* Programar envío */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Programar envío</h4>
            <p className="text-[11px] text-gray-500">
              Se envía en algún momento del día elegido, no a una hora exacta (el servidor revisa una vez al día). La audiencia se recalcula justo antes de enviar, para no mandarle el correo a alguien que ya pagó o dejó de calificar el filtro entre medio.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs text-gray-400 flex flex-col gap-1">
                Fecha
                <input type="date" min={today} value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                  className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500" />
              </label>
              <label className="text-xs text-gray-400 flex flex-col gap-1">
                Audiencia
                <select value={scheduleMaxEvals} onChange={e => setScheduleMaxEvals(Number(e.target.value))}
                  className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
                  <option value={0}>Trial con 0 ofertas evaluadas</option>
                  <option value={1}>Trial con 1 o menos</option>
                  <option value={2}>Trial con 2 o menos</option>
                  <option value={3}>Trial con 3 o menos</option>
                </select>
              </label>
              <button onClick={schedule} disabled={scheduling} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium">
                <Plus size={13} /> {scheduling ? 'Programando...' : 'Programar'}
              </button>
            </div>
            {scheduleError && <p className="text-red-400 text-xs">{scheduleError}</p>}
            {scheduled.length > 0 && (
              <div className="space-y-1 pt-1">
                {scheduled.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-xs bg-gray-900/50 rounded px-3 py-1.5">
                    <span className="text-gray-300">
                      {new Date(s.send_date + 'T00:00:00').toLocaleDateString('es-CL')} · audiencia ≤{s.max_evals} evaluadas
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={
                        s.status === 'pending' ? 'text-blue-400' :
                        s.status === 'sent' ? 'text-green-400' :
                        s.status === 'failed' ? 'text-red-400' : 'text-gray-500'
                      }>
                        {s.status === 'pending' ? 'Pendiente' : s.status === 'sent' ? `Enviado (${s.result?.sent?.length ?? 0})` : s.status === 'failed' ? 'Falló' : 'Cancelado'}
                      </span>
                      {s.status === 'pending' && (
                        <button onClick={() => cancelScheduled(s.id)} className="text-gray-500 hover:text-red-400"><X size={12} /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {sendError && <p className="text-red-400 text-xs">{sendError}</p>}

          {sendResult && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-xs space-y-1">
              <p className="text-green-400">Enviados: {sendResult.sent.length}</p>
              {sendResult.skipped.length > 0 && <p className="text-gray-400">Ya habían recibido este correo (omitidos): {sendResult.skipped.length}</p>}
              {sendResult.failed.length > 0 && (
                <div className="text-red-400">
                  Fallaron: {sendResult.failed.length}
                  <ul className="list-disc pl-4 mt-1">
                    {sendResult.failed.map(f => <li key={f.email}>{f.email}: {f.error}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Envío manual ahora */}
          <div>
            <label className="text-xs text-gray-400 flex items-center gap-2 mb-2">
              Mostrar usuarios en trial con
              <select value={maxEvals} onChange={e => setMaxEvals(Number(e.target.value))}
                className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500">
                <option value={0}>0 ofertas evaluadas</option>
                <option value={1}>1 o menos ofertas evaluadas</option>
                <option value={2}>2 o menos ofertas evaluadas</option>
                <option value={3}>3 o menos ofertas evaluadas</option>
              </select>
            </label>

            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-500">{selected.size} de {candidates.length} seleccionados</p>
                <button onClick={toggleAll} disabled={candidates.length === 0}
                  className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:hover:text-blue-400">
                  {allSelected ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
              </div>
              <button onClick={send} disabled={sending || selected.size === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                <Send size={14} /> {sending ? 'Enviando...' : 'Enviar correo ahora'}
              </button>
            </div>

            {candidates.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-6">Sin usuarios que cumplan este filtro.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                    <th className="text-left px-3 py-2 w-8">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} title="Marcar/desmarcar todos" />
                    </th>
                    <th className="text-left px-3 py-2">Email</th>
                    <th className="text-left px-3 py-2">Registro</th>
                    <th className="text-right px-3 py-2">Ofertas evaluadas</th>
                    <th className="text-right px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map(u => {
                    const wasSent = sentEmails.has(u.email)
                    return (
                      <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selected.has(u.email)} onChange={() => toggle(u.email)} />
                        </td>
                        <td className="px-3 py-2 text-white">{u.email}</td>
                        <td className="px-3 py-2 text-gray-400">{new Date(u.createdAt).toLocaleDateString('es-CL')}</td>
                        <td className="px-3 py-2 text-right text-gray-300">{u.evaluationsCount}</td>
                        <td className="px-3 py-2 text-right">
                          {wasSent
                            ? <span className="text-green-400 text-xs">Ya enviado</span>
                            : <span className="text-gray-600 text-xs">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function BulkEmailTab({ token, userList }: { token: string; userList: BulkUser[] }) {
  const [emails, setEmails] = useState<BulkEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [drafting, setDrafting] = useState(false)
  const [draft, setDraft] = useState<BulkEmailFormState>(EMPTY_BULK_EMAIL_FORM)
  const [saving, setSaving] = useState(false)
  const [draftError, setDraftError] = useState('')
  const [newestId, setNewestId] = useState<string | null>(null)
  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const load = () => {
    setLoading(true)
    fetch('/api/admin/bulk-emails', { headers: authHeaders })
      .then(r => r.json())
      .then(d => { setEmails(d.emails || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const startDraft = () => {
    setDraft({ ...EMPTY_BULK_EMAIL_FORM, titulo: 'Nuevo correo', asunto: 'Asunto del correo' })
    setDraftError('')
    setDrafting(true)
  }

  const cancelDraft = () => {
    setDrafting(false)
    setDraft(EMPTY_BULK_EMAIL_FORM)
    setDraftError('')
  }

  // No se crea nada en la base hasta que se confirma acá — así "Cancelar"
  // no deja filas huérfanas si Diego se arrepiente de armar un correo nuevo.
  const saveDraft = async () => {
    setDraftError('')
    if (!draft.titulo.trim() || !draft.asunto.trim()) { setDraftError('Título y asunto son requeridos'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/bulk-emails', {
        method: 'POST', headers: authHeaders, body: JSON.stringify(draft),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      setNewestId(data.email.id)
      setDrafting(false)
      setDraft(EMPTY_BULK_EMAIL_FORM)
      load()
    } catch (err: unknown) {
      setDraftError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-gray-500 text-sm p-5">Cargando...</p>

  return (
    <div className="p-5 space-y-3">
      {drafting ? (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Nuevo correo</h3>
          <BulkEmailFields form={draft} setForm={setDraft} />
          {draftError && <p className="text-red-400 text-xs">{draftError}</p>}
          <div className="flex gap-2">
            <button onClick={saveDraft} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium">
              <Save size={13} /> {saving ? 'Guardando...' : 'Guardar correo'}
            </button>
            <button onClick={cancelDraft} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs">
              <X size={13} /> Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <button onClick={startDraft}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium">
            <Plus size={13} /> Nuevo correo
          </button>
        </div>
      )}

      {emails.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-6">Sin correos guardados todavía.</p>
      ) : (
        <div className="space-y-2">
          {emails.map(e => (
            <BulkEmailCard
              key={e.id} email={e} token={token} userList={userList}
              onChanged={load} onDeleted={load}
              startOpen={e.id === newestId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  trial:           { label: 'Trial',     color: 'text-blue-400'   },
  active:          { label: 'Activo',    color: 'text-green-400'  },
  expired:         { label: 'Expirado',  color: 'text-red-400'    },
  cancelled:       { label: 'Cancelado', color: 'text-gray-400'   },
  pending_payment: { label: 'Pendiente', color: 'text-yellow-400' },
}

interface Stats {
  totalUsers:      number
  statusCount:     Record<string, number>
  testCount:       number
  payments:        { userId: string; userEmail: string; paymentId: string; receiptId: string; amount: number; date: string }[]
  userList:        { id: string; email: string; createdAt: string; sub: any; evaluationsCount: number }[]
  contactMessages: { id: string; name: string; email: string; category: string; message: string; created_at: string; replied_at: string | null; reply_text: string | null }[]
}

const SEEN_USERS_KEY = 'ergania_admin_seen_users'

function SortTh({ label, active, dir, align = 'left', onClick }: {
  label: string; active: boolean; dir: 'asc' | 'desc'; align?: 'left' | 'right'; onClick: () => void
}) {
  return (
    <th className={`px-5 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        onClick={onClick}
        className={`flex items-center gap-1 hover:text-white transition-colors ${align === 'right' ? 'ml-auto' : ''} ${active ? 'text-white' : ''}`}
      >
        {label}
        {active
          ? (dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
          : <ChevronDown size={12} className="opacity-20" />}
      </button>
    </th>
  )
}

export default function Admin() {
  const { user, session, loading: authLoading, signOut } = useAuth()
  const navigate  = useNavigate()
  const [stats,   setStats]   = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<'users' | 'payments' | 'messages' | 'salaries' | 'reportes' | 'bulkemail'>('users')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<'email' | 'createdAt' | 'status' | 'vence' | 'evaluationsCount'>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [newUserIds, setNewUserIds] = useState<Set<string>>(new Set())
  const [openMsgIds, setOpenMsgIds] = useState<Set<string>>(new Set())
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [replyErrors, setReplyErrors] = useState<Record<string, string>>({})
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null)

  const loadStats = () => {
    if (!session) return
    fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(data => { setStats(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    if (authLoading) return // todavía resolviendo la sesión inicial — no decidir nada aún
    if (!session) { navigate('/login'); return }
    if (user?.email !== ADMIN_EMAIL) { navigate('/dashboard'); return }
    loadStats()
  }, [session, user, authLoading])

  // "Nuevo" en usuarios que no estaban la última vez que se cargó este panel —
  // se marca al comparar contra localStorage y se "consume" (deja de ser nuevo)
  // apenas se guarda la lista actual, o sea en el próximo refresh ya no aparece.
  useEffect(() => {
    if (!stats) return
    const seen = new Set<string>(JSON.parse(localStorage.getItem(SEEN_USERS_KEY) || '[]'))
    const currentIds = stats.userList.map(u => u.id)
    setNewUserIds(new Set(currentIds.filter(id => !seen.has(id))))
    localStorage.setItem(SEEN_USERS_KEY, JSON.stringify(currentIds))
  }, [stats])

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return }
    setSortKey(key)
    setSortDir('desc')
  }

  const sortValue = (u: Stats['userList'][number], key: typeof sortKey): string | number => {
    switch (key) {
      case 'email':            return u.email?.toLowerCase() ?? ''
      case 'createdAt':        return new Date(u.createdAt).getTime()
      case 'status':           return u.sub?.status ?? ''
      case 'vence':            return new Date(u.sub?.current_period_end ?? u.sub?.trial_ends_at ?? 0).getTime()
      case 'evaluationsCount': return u.evaluationsCount
    }
  }

  const handleLogout = async () => { await signOut(); navigate('/login') }

  const toggleTestFlag = async (u: { id: string; sub: any }) => {
    if (!session) return
    await fetch(`/api/admin/users/${u.id}/test`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isTest: !u.sub?.is_test }),
    })
    loadStats()
  }

  const deleteUserAccount = async (u: { id: string; email: string }) => {
    if (!session) return
    if (!window.confirm(`¿Eliminar la cuenta de ${u.email}? Esta acción no se puede deshacer.`)) return
    await fetch(`/api/admin/users/${u.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    loadStats()
  }

  const toggleMsg = (id: string) => {
    setOpenMsgIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const sendReply = async (m: { id: string }) => {
    if (!session) return
    const text = replyDrafts[m.id]?.trim()
    if (!text) return
    setSendingReplyId(m.id)
    setReplyErrors(errs => ({ ...errs, [m.id]: '' }))
    try {
      const res = await fetch(`/api/admin/messages/${m.id}/reply`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: text }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error al enviar') }
      setReplyDrafts(d => { const next = { ...d }; delete next[m.id]; return next })
      loadStats()
    } catch (err: unknown) {
      setReplyErrors(errs => ({ ...errs, [m.id]: err instanceof Error ? err.message : 'Error al enviar' }))
    } finally {
      setSendingReplyId(null)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!stats) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-red-400">
      Error cargando datos
    </div>
  )

  const revenue = (stats.statusCount['active'] ?? 0) * 9990

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Ergania" className="w-8 h-8 rounded-lg object-contain" />
          <div>
            <h1 className="text-sm font-bold text-white">Ergania Admin</h1>
            <p className="text-xs text-gray-500">Panel de administración</p>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-gray-400 hover:text-red-400 transition-colors">
          <LogOut size={14} /> Cerrar sesión
        </button>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {([
            { icon: Users,      label: 'Usuarios totales', value: stats.totalUsers,                      color: 'text-blue-400',   bg: 'bg-blue-600/10',   tabTarget: 'users'    },
            { icon: Crown,      label: 'Suscritos activos', value: stats.statusCount['active'] ?? 0,     color: 'text-green-400',  bg: 'bg-green-600/10',  tabTarget: 'users'    },
            { icon: TrendingUp, label: 'Ingresos/mes',      value: `$${revenue.toLocaleString('es-CL')}`, color: 'text-orange-400', bg: 'bg-orange-600/10', tabTarget: 'payments' },
            { icon: MessageSquare, label: 'Mensajes recibidos', value: stats.contactMessages.length,     color: 'text-purple-400', bg: 'bg-purple-600/10', tabTarget: 'messages' },
          ] as const).map(({ icon: Icon, label, value, color, bg, tabTarget }) => (
            <button
              key={label}
              onClick={() => setTab(tabTarget)}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-left hover:border-gray-700 hover:bg-gray-800/40 transition-colors"
            >
              <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center mb-3`}>
                <Icon size={18} className={color} />
              </div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </button>
          ))}
        </div>

        {/* Estado suscripciones */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Estado de suscripciones</h2>
            {statusFilter && (
              <button onClick={() => setStatusFilter(null)} className="text-xs text-gray-500 hover:text-white transition-colors">
                Limpiar filtro
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => { setStatusFilter(null); setTab('users') }}
              className={`bg-gray-800 rounded-lg px-4 py-2 flex items-center gap-2 border transition-colors ${statusFilter === null ? 'border-blue-500' : 'border-gray-700 hover:border-gray-600'}`}
            >
              <span className="text-lg font-bold text-white">
                {Object.values(stats.statusCount).reduce((a, b) => a + b, 0)}
              </span>
              <span className="text-xs text-gray-400">Total</span>
            </button>
            {Object.entries(STATUS_LABEL).map(([key, { label, color }]) => (
              <button
                key={key}
                onClick={() => { setStatusFilter(f => f === key ? null : key); setTab('users') }}
                className={`bg-gray-800 rounded-lg px-4 py-2 flex items-center gap-2 border transition-colors ${statusFilter === key ? 'border-blue-500' : 'border-transparent hover:border-gray-600'}`}
              >
                <span className={`text-lg font-bold ${color}`}>{stats.statusCount[key] ?? 0}</span>
                <span className="text-xs text-gray-400">{label}</span>
              </button>
            ))}
            <button
              onClick={() => { setStatusFilter(f => f === 'test' ? null : 'test'); setTab('users') }}
              className={`bg-gray-800 rounded-lg px-4 py-2 flex items-center gap-2 border transition-colors ${statusFilter === 'test' ? 'border-blue-500' : 'border-transparent hover:border-gray-600'}`}
            >
              <span className="text-lg font-bold text-gray-500">{stats.testCount}</span>
              <span className="text-xs text-gray-400">Prueba</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="flex overflow-x-auto border-b border-gray-800">
            {([
              { key: 'users',    label: 'Usuarios',          icon: Users        },
              { key: 'payments', label: 'Pagos',             icon: CreditCard   },
              { key: 'messages', label: 'Mensajes contacto', icon: MessageSquare },
              { key: 'salaries', label: 'Salarios',           icon: DollarSign },
              { key: 'reportes', label: 'Reportes',           icon: FileText },
              { key: 'bulkemail', label: 'Correos masivos',    icon: Megaphone },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 shrink-0 whitespace-nowrap ${
                  tab === key
                    ? 'border-blue-500 text-blue-400 bg-blue-600/5'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">

            {/* Tabla usuarios */}
            {tab === 'users' && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                    <SortTh label="Email" active={sortKey === 'email'} dir={sortDir} onClick={() => toggleSort('email')} />
                    <SortTh label="Registro" active={sortKey === 'createdAt'} dir={sortDir} onClick={() => toggleSort('createdAt')} />
                    <SortTh label="Suscripción" active={sortKey === 'status'} dir={sortDir} onClick={() => toggleSort('status')} />
                    <SortTh label="Vence" active={sortKey === 'vence'} dir={sortDir} onClick={() => toggleSort('vence')} />
                    <SortTh label="Ofertas evaluadas" active={sortKey === 'evaluationsCount'} dir={sortDir} align="right" onClick={() => toggleSort('evaluationsCount')} />
                    <th className="text-right px-5 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.userList
                    .filter(u => {
                      if (!statusFilter) return true
                      if (statusFilter === 'test') return !!u.sub?.is_test
                      return u.sub?.status === statusFilter && !u.sub?.is_test
                    })
                    .sort((a, b) => {
                      const av = sortValue(a, sortKey)
                      const bv = sortValue(b, sortKey)
                      const cmp = av < bv ? -1 : av > bv ? 1 : 0
                      return sortDir === 'asc' ? cmp : -cmp
                    })
                    .map(u => {
                    const s = STATUS_LABEL[u.sub?.status] ?? { label: '—', color: 'text-gray-600' }
                    const vence = u.sub?.current_period_end ?? u.sub?.trial_ends_at
                    const isTest = !!u.sub?.is_test
                    return (
                      <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="px-5 py-3 text-white font-medium">
                          <div className="flex items-center gap-2 flex-wrap">
                            {u.email}
                            {newUserIds.has(u.id) && (
                              <span className="bg-green-600/20 text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">Nuevo</span>
                            )}
                            {isTest && (
                              <span className="bg-gray-700 text-gray-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">Prueba</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-gray-400">{new Date(u.createdAt).toLocaleDateString('es-CL')}</td>
                        <td className="px-5 py-3"><span className={`font-semibold ${s.color}`}>{s.label}</span></td>
                        <td className="px-5 py-3 text-gray-400">
                          {vence
                            ? <>
                                {new Date(vence).toLocaleDateString('es-CL')}{' '}
                                <span className="text-gray-600 text-xs">
                                  {new Date(vence).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </>
                            : '—'}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-300 font-medium">{u.evaluationsCount}</td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => toggleTestFlag(u)}
                            title={isTest ? 'Quitar marca de prueba' : 'Marcar como cuenta de prueba'}
                            className={`p-1 ${isTest ? 'text-yellow-400 hover:text-gray-500' : 'text-gray-500 hover:text-yellow-400'}`}
                          >
                            <FlaskConical size={14} />
                          </button>
                          <button onClick={() => deleteUserAccount(u)} title="Eliminar usuario" className="p-1 text-gray-500 hover:text-red-400">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {/* Tabla pagos */}
            {tab === 'payments' && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase">
                    <th className="text-left px-5 py-3">Fecha</th>
                    <th className="text-left px-5 py-3">Cliente</th>
                    <th className="text-left px-5 py-3">Monto</th>
                    <th className="text-left px-5 py-3">Payment ID</th>
                    <th className="text-left px-5 py-3">Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.payments.length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-600">Sin pagos registrados aún</td></tr>
                  )}
                  {stats.payments.map(p => (
                    <tr key={p.receiptId} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-3 text-gray-400">{new Date(p.date).toLocaleDateString('es-CL')}</td>
                      <td className="px-5 py-3 text-white">{p.userEmail}</td>
                      <td className="px-5 py-3 text-green-400 font-bold">${p.amount.toLocaleString('es-CL')} CLP</td>
                      <td className="px-5 py-3 text-gray-500 font-mono text-xs">{p.paymentId}</td>
                      <td className="px-5 py-3">
                        <button
                          onClick={async () => {
                            const res = await fetch(`/api/admin/receipts/${p.receiptId}/pdf`, {
                              headers: { Authorization: `Bearer ${session?.access_token}` },
                            })
                            if (!res.ok) return
                            const blob = await res.blob()
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `Comprobante_${p.userEmail}.pdf`
                            a.click()
                            URL.revokeObjectURL(url)
                          }}
                          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
                        >
                          <FileText size={12} /> Descargar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Mensajes de contacto */}
            {tab === 'messages' && (
              <div className="divide-y divide-gray-800">
                {stats.contactMessages.length === 0 && (
                  <p className="px-5 py-8 text-center text-gray-600">Sin mensajes de contacto aún</p>
                )}
                {stats.contactMessages.map(m => {
                  const open = openMsgIds.has(m.id)
                  return (
                    <div key={m.id} className="px-5 py-4">
                      <button
                        onClick={() => toggleMsg(m.id)}
                        className="w-full text-left hover:opacity-80 transition-opacity"
                      >
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            <span className="text-white font-medium text-sm">{m.name}</span>
                            <span className="text-gray-500 text-xs break-all">{m.email}</span>
                            <span className="bg-gray-800 text-gray-400 text-xs px-2 py-0.5 rounded-full shrink-0">{m.category}</span>
                            {m.replied_at && (
                              <span className="bg-green-600/20 text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">Respondido</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-gray-600">{new Date(m.created_at).toLocaleDateString('es-CL')}</span>
                            {open ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                          </div>
                        </div>
                        <p className={`text-sm text-gray-400 leading-relaxed break-words whitespace-pre-wrap ${open ? '' : 'line-clamp-2'}`}>
                          {m.message}
                        </p>
                      </button>

                      {open && (
                        <div className="mt-3 space-y-2">
                          {m.replied_at ? (
                            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                              <p className="text-xs text-green-400 mb-1">
                                Respondiste el {new Date(m.replied_at).toLocaleDateString('es-CL')}
                              </p>
                              <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">{m.reply_text}</p>
                            </div>
                          ) : (
                            <>
                              <textarea
                                value={replyDrafts[m.id] ?? ''}
                                onChange={e => setReplyDrafts(d => ({ ...d, [m.id]: e.target.value }))}
                                rows={3}
                                placeholder={`Responder a ${m.name}...`}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-y"
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => sendReply(m)}
                                  disabled={!replyDrafts[m.id]?.trim() || sendingReplyId === m.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium"
                                >
                                  <Send size={13} /> {sendingReplyId === m.id ? 'Enviando...' : 'Enviar respuesta'}
                                </button>
                                {replyErrors[m.id] && <p className="text-red-400 text-xs">{replyErrors[m.id]}</p>}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Anclas salariales */}
            {tab === 'salaries' && session && <SalaryAnchorsTab token={session.access_token} />}

            {/* Reportes internos */}
            {tab === 'reportes' && session && <ReportsTab token={session.access_token} />}

            {/* Correos masivos */}
            {tab === 'bulkemail' && session && <BulkEmailTab token={session.access_token} userList={stats.userList} />}

          </div>
        </div>
      </div>
    </div>
  )
}
