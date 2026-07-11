import { Router } from 'express'
import {
  getStats, notifySignup,
  listSalaryAnchors, createSalaryAnchor, updateSalaryAnchor, deleteSalaryAnchor,
  listReports, createReport, updateReport, deleteReport, downloadReportPdf,
} from '../controllers/adminController'

const router = Router()

router.get('/stats', getStats)
router.post('/notify-signup', notifySignup)

router.get('/salary-anchors', listSalaryAnchors)
router.post('/salary-anchors', createSalaryAnchor)
router.put('/salary-anchors/:id', updateSalaryAnchor)
router.delete('/salary-anchors/:id', deleteSalaryAnchor)

router.get('/reports', listReports)
router.post('/reports', createReport)
router.put('/reports/:id', updateReport)
router.delete('/reports/:id', deleteReport)
router.get('/reports/:id/pdf', downloadReportPdf)

export { router as adminRoutes }
