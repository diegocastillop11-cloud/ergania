import { Router } from 'express'
import { getStatus, createCheckout, createPayPalCheckout, cancelSub, webhook, paypalWebhook, signupDigest, revertPending } from '../controllers/subscriptionController'

export const subscriptionRoutes = Router()

subscriptionRoutes.get('/status',    getStatus)
subscriptionRoutes.get('/signup-digest', signupDigest)
subscriptionRoutes.get('/revert-pending', revertPending)
subscriptionRoutes.post('/checkout', createCheckout)
subscriptionRoutes.post('/checkout/paypal', createPayPalCheckout)
subscriptionRoutes.post('/cancel',  cancelSub)
subscriptionRoutes.post('/webhook', webhook)
subscriptionRoutes.post('/webhook/paypal', paypalWebhook)
