import { Router } from 'express'
import {
  getStats, setUserTestFlag, deleteUser, replyToMessage,
  listSalaryAnchors, createSalaryAnchor, updateSalaryAnchor, deleteSalaryAnchor,
  listReports, createReport, updateReport, deleteReport, downloadReportPdf,
  listReceipts, downloadReceiptPdf,
} from '../controllers/adminController'

const router = Router()

router.get('/stats', getStats)

router.patch('/users/:id/test', setUserTestFlag)
router.delete('/users/:id', deleteUser)

router.post('/messages/:id/reply', replyToMessage)

router.get('/receipts', listReceipts)
router.get('/receipts/:id/pdf', downloadReceiptPdf)

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
