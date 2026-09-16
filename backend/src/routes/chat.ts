import { Router } from 'express'
import * as ctrl from '../controllers/chatController'

export const chatRoutes = Router()

chatRoutes.post('/message', ctrl.sendMessage)
chatRoutes.post('/confirm-action', ctrl.confirmAction)
chatRoutes.post('/quick-action', ctrl.quickAction)
chatRoutes.post('/cancel-action', ctrl.cancelAction)
chatRoutes.get('/history', ctrl.getHistory)
chatRoutes.get('/usage', ctrl.getUsage)
