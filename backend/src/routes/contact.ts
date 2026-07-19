import { Router } from 'express'
import { sendContact, getMyThreads, addMyMessage } from '../controllers/contactController'

const router = Router()

router.post('/', sendContact)
router.get('/mine', getMyThreads)
router.post('/:id/messages', addMyMessage)

export { router as contactRoutes }
