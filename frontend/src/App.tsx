import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Landing from './pages/Landing'
import Privacy from './pages/Privacy'
import Subscription from './pages/Subscription'
import SubscriptionCallback from './pages/SubscriptionCallback'
import CareersDashboard from './pages/careers/CareersDashboard'
import CareersPipeline from './pages/careers/CareersPipeline'
import CareersTracker from './pages/careers/CareersTracker'
import CareersPortals from './pages/careers/CareersPortals'
import CareersProfile from './pages/careers/CareersProfile'
import CareersScanner from './pages/careers/CareersScanner'
import CareersPostulaciones from './pages/careers/CareersPostulaciones'
import CareersBusqueda from './pages/careers/CareersBusqueda'
import Admin from './pages/Admin'

function ProtectedLayout() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[var(--text-muted)] text-sm">Cargando...</p>
      </div>
    </div>
  )

  if (!user) return <Navigate to="/login" replace />
  return <Layout />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/privacidad" element={<Privacy />} />
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Redirect pages from MercadoPago — must be public, no auth required */}
      <Route path="/subscription/success" element={<SubscriptionCallback />} />
      <Route path="/subscription/failure" element={<SubscriptionCallback />} />
      <Route path="/subscription/pending" element={<SubscriptionCallback />} />
      {/* Layout route — wraps all protected paths without changing their URLs */}
      <Route element={<ProtectedLayout />}>
        <Route path="/subscription"    element={<Subscription />} />
        <Route path="/dashboard"       element={<CareersDashboard />} />
        <Route path="/busqueda"        element={<CareersBusqueda />} />
        <Route path="/scanner"         element={<CareersScanner />} />
        <Route path="/pipeline"        element={<CareersPipeline />} />
        <Route path="/postulaciones"   element={<CareersPostulaciones />} />
        <Route path="/tracker"         element={<CareersTracker />} />
        <Route path="/portals"         element={<CareersPortals />} />
        <Route path="/profile"         element={<CareersProfile />} />
      </Route>
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
