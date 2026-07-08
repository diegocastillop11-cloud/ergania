import { Router } from 'express'
import {
  getStats, notifySignup,
  listSalaryAnchors, createSalaryAnchor, updateSalaryAnchor, deleteSalaryAnchor,
} from '../controllers/adminController'

const router = Router()

router.get('/stats', getStats)
router.post('/notify-signup', notifySignup)

router.get('/salary-anchors', listSalaryAnchors)
router.post('/salary-anchors', createSalaryAnchor)
router.put('/salary-anchors/:id', updateSalaryAnchor)
router.delete('/salary-anchors/:id', deleteSalaryAnchor)

export { router as adminRoutes }
