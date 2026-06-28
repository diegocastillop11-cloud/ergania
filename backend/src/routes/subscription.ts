import { Router } from 'express'
import { getStatus, createCheckout, cancelSub, webhook } from '../controllers/subscriptionController'

export const subscriptionRoutes = Router()

subscriptionRoutes.get('/status',   getStatus)
subscriptionRoutes.post('/checkout', createCheckout)
subscriptionRoutes.post('/cancel',  cancelSub)
subscriptionRoutes.post('/webhook', webhook)
