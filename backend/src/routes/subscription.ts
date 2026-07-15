import { Router } from 'express'
import { getStatus, createCheckout, cancelSub, webhook, reminders, signupDigest, revertPending } from '../controllers/subscriptionController'

export const subscriptionRoutes = Router()

subscriptionRoutes.get('/status',    getStatus)
subscriptionRoutes.get('/reminders', reminders)
subscriptionRoutes.get('/signup-digest', signupDigest)
subscriptionRoutes.get('/revert-pending', revertPending)
subscriptionRoutes.post('/checkout', createCheckout)
subscriptionRoutes.post('/cancel',  cancelSub)
subscriptionRoutes.post('/webhook', webhook)
