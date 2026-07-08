import { Router } from 'express'
import { getStatus, createCheckout, cancelSub, webhook, reminders } from '../controllers/subscriptionController'

export const subscriptionRoutes = Router()

subscriptionRoutes.get('/status',    getStatus)
subscriptionRoutes.get('/reminders', reminders)
subscriptionRoutes.post('/checkout', createCheckout)
subscriptionRoutes.post('/cancel',  cancelSub)
subscriptionRoutes.post('/webhook', webhook)
