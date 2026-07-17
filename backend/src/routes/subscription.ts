import { Router } from 'express'
import { getStatus, createCheckout, createPayPalCheckout, cancelSub, webhook, paypalWebhook, reminders, signupDigest, revertPending, expireTrials } from '../controllers/subscriptionController'

export const subscriptionRoutes = Router()

subscriptionRoutes.get('/status',    getStatus)
subscriptionRoutes.get('/reminders', reminders)
subscriptionRoutes.get('/signup-digest', signupDigest)
subscriptionRoutes.get('/revert-pending', revertPending)
subscriptionRoutes.get('/expire-trials', expireTrials)
subscriptionRoutes.post('/checkout', createCheckout)
subscriptionRoutes.post('/checkout/paypal', createPayPalCheckout)
subscriptionRoutes.post('/cancel',  cancelSub)
subscriptionRoutes.post('/webhook', webhook)
subscriptionRoutes.post('/webhook/paypal', paypalWebhook)
