import { Router } from 'express'
import { runAlerts, unsubscribeAlerts } from '../controllers/jobAlertsController'

export const alertsRoutes = Router()

alertsRoutes.get('/run', runAlerts)
alertsRoutes.get('/unsubscribe', unsubscribeAlerts)
