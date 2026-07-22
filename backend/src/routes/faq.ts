import { Router } from 'express'
import { listPublicFaqs } from '../controllers/faqController'

const router = Router()

router.get('/', listPublicFaqs)

export { router as faqRoutes }
