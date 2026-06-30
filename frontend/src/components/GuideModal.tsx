import { X, UserCircle, Target, Globe, Radio, Zap, Send } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const STEPS = [
  {
    num: 1,
    icon: UserCircle,
    color: 'from-blue-600 to-blue-800',
    iconColor: 'text-blue-200',
    title: 'Configura tu perfil y CV',
    desc: 'Ingresa tu experiencia, habilidades y el CV que quieres presentar. La IA usará esta información para personalizar cada evaluación.',
    route: '/profile',
    cta: 'Ir a Perfil & CV',
  },
  {
    num: 2,
    icon: Target,
    color: 'from-amber-600 to-amber-800',
    iconColor: 'text-amber-200',
    title: 'Define tu búsqueda',
    desc: 'Indica los cargos que buscas y las keywords clave. El Escáner filtrará miles de ofertas usando estos criterios.',
    route: '/busqueda',
    cta: 'Ir a Mi Búsqueda',
  },
  {
    num: 3,
    icon: Globe,
    color: 'from-teal-600 to-teal-800',
    iconColor: 'text-teal-200',
    title: 'Activa portales de empleo',
    desc: 'Selecciona los portales que quieres monitorear: GetOnBoard, Bumeran, LinkedIn, Indeed y más.',
    route: '/portals',
    cta: 'Ir a Portales',
  },
  {
    num: 4,
    icon: Radio,
    color: 'from-purple-600 to-purple-800',
    iconColor: 'text-purple-200',
    title: 'Escanea ofertas automáticamente',
    desc: 'El Escáner recorre los portales activos y te trae solo las ofertas que coinciden con tu búsqueda.',
    route: '/scanner',
    cta: 'Ir al Escáner',
  },
  {
    num: 5,
    icon: Zap,
    color: 'from-yellow-600 to-yellow-800',
    iconColor: 'text-yellow-200',
    title: 'Evalúa cada oferta con IA',
    desc: 'Pega la URL o el texto de una oferta. La IA analiza el match con tu perfil, sugiere estrategia salarial y prepara preguntas de entrevista.',
    route: '/pipeline',
    cta: 'Ir a Evaluar Oferta',
  },
  {
    num: 6,
    icon: Send,
    color: 'from-green-600 to-green-800',
    iconColor: 'text-green-200',
    title: 'Registra tus postulaciones',
    desc: 'Lleva el seguimiento de cada postulación: desde "Evaluada" hasta "Oferta recibida". Todo en un solo lugar.',
    route: '/postulaciones',
    cta: 'Ir a Postulaciones',
  },
]

interface Props { onClose: () => void }

export default function GuideModal({ onClose }: Props) {
  const navigate = useNavigate()

  const go = (route: string) => {
    onClose()
    navigate(route)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 overflow-y-auto py-6 px-4">
      <div className="w-full max-w-xl bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="text-white font-bold text-lg">Cómo usar Ergania</h2>
            <p className="text-gray-400 text-sm mt-0.5">6 pasos para encontrar tu trabajo ideal</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {/* Steps */}
        <div className="p-5 space-y-3">
          {STEPS.map(step => {
            const Icon = step.icon
            return (
              <div key={step.num} className="flex gap-4 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {/* Visual strip */}
                <div className={`bg-gradient-to-b ${step.color} flex flex-col items-center justify-center px-4 py-4 shrink-0 gap-2`}>
                  <span className="text-white/60 text-xs font-bold">{step.num}</span>
                  <Icon size={22} className={step.iconColor} />
                </div>
                {/* Content */}
                <div className="py-4 pr-4 flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm mb-1">{step.title}</p>
                  <p className="text-gray-400 text-xs leading-relaxed mb-3">{step.desc}</p>
                  <button
                    onClick={() => go(step.route)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                  >
                    {step.cta} →
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            ¡Entendido, vamos!
          </button>
        </div>
      </div>
    </div>
  )
}
