import { Router } from 'express'
import { getStats, notifySignup } from '../controllers/adminController'

const router = Router()

router.get('/stats', getStats)
router.post('/notify-signup', notifySignup)

export { router as adminRoutes }
