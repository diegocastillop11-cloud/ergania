import { Router } from 'express'
import { getStatus, createCheckout, createPayPalCheckout, cancelSub, deleteAccount, webhook, paypalWebhook, reminders, signupDigest, revertPending, expireTrials, reconcile, trialReminders } from '../controllers/subscriptionController'

export const subscriptionRoutes = Router()

subscriptionRoutes.get('/status',    getStatus)
subscriptionRoutes.get('/reminders', reminders)
subscriptionRoutes.get('/signup-digest', signupDigest)
subscriptionRoutes.get('/revert-pending', revertPending)
subscriptionRoutes.get('/expire-trials', expireTrials)
subscriptionRoutes.get('/reconcile', reconcile)
subscriptionRoutes.get('/trial-reminders', trialReminders)
subscriptionRoutes.post('/checkout', createCheckout)
subscriptionRoutes.post('/checkout/paypal', createPayPalCheckout)
subscriptionRoutes.post('/cancel',  cancelSub)
subscriptionRoutes.post('/delete-account', deleteAccount)
subscriptionRoutes.post('/webhook', webhook)
subscriptionRoutes.post('/webhook/paypal', paypalWebhook)
