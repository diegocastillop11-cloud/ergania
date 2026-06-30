import { Router } from 'express'
import { sendContact } from '../controllers/contactController'

const router = Router()

router.post('/', sendContact)

export { router as contactRoutes }
