import { Router } from 'express'
import { logVideoPlay } from '../controllers/videoController'

const router = Router()

router.post('/play', logVideoPlay)

export { router as videoRoutes }
