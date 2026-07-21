import { Router } from 'express'
import {
  getStats, setUserTestFlag, deleteUser, replyToMessage, getMessageThread,
  listSalaryAnchors, createSalaryAnchor, updateSalaryAnchor, deleteSalaryAnchor,
  listReports, createReport, updateReport, deleteReport, downloadReportPdf,
  listReceipts, downloadReceiptPdf,
  listBulkEmails, createBulkEmail, updateBulkEmail, deleteBulkEmail,
  getBulkEmailPreview, listBulkEmailSent, sendBulkEmail,
  listScheduledEmails, createScheduledEmail, deleteScheduledEmail, runScheduledBulkEmails,
  listGastos, createGasto, updateGasto, deleteGasto,
} from '../controllers/adminController'

const router = Router()

router.get('/stats', getStats)

router.patch('/users/:id/test', setUserTestFlag)
router.delete('/users/:id', deleteUser)

router.post('/messages/:id/reply', replyToMessage)
router.get('/messages/:id/thread', getMessageThread)

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

router.get('/bulk-emails', listBulkEmails)
router.post('/bulk-emails', createBulkEmail)
router.put('/bulk-emails/:id', updateBulkEmail)
router.delete('/bulk-emails/:id', deleteBulkEmail)
router.get('/bulk-emails/:id/preview', getBulkEmailPreview)
router.get('/bulk-emails/:id/sent', listBulkEmailSent)
router.post('/bulk-emails/:id/send', sendBulkEmail)
router.get('/bulk-emails/:id/scheduled', listScheduledEmails)
router.post('/bulk-emails/:id/scheduled', createScheduledEmail)
router.delete('/scheduled/:id', deleteScheduledEmail)
router.get('/bulk-email/run-scheduled', runScheduledBulkEmails)

router.get('/gastos', listGastos)
router.post('/gastos', createGasto)
router.put('/gastos/:id', updateGasto)
router.delete('/gastos/:id', deleteGasto)

export { router as adminRoutes }
