import { Router } from 'express'
import {
  requireAdminAuth,
  getStats, setUserTestFlag, deleteUser, replyToMessage, getMessageThread,
  listSalaryAnchors, createSalaryAnchor, updateSalaryAnchor, deleteSalaryAnchor,
  listFaqs, createFaq, updateFaq, deleteFaq,
  listReports, createReport, updateReport, deleteReport, downloadReportPdf,
  listReceipts, downloadReceiptPdf,
  listBulkEmails, createBulkEmail, updateBulkEmail, deleteBulkEmail,
  getBulkEmailPreview, listBulkEmailSent, sendBulkEmail,
  listScheduledEmails, createScheduledEmail, deleteScheduledEmail, runScheduledBulkEmails,
  listGastos, createGasto, updateGasto, deleteGasto,
  uploadGastoArchivoMiddleware, uploadGastoArchivo, downloadGastoArchivo, deleteGastoArchivo,
} from '../controllers/adminController'

const router = Router()

// Autenticado por CRON_SECRET (llamado por un cron job, no por una sesión de
// usuario) — debe quedar antes del gate de sesión admin de abajo.
router.get('/bulk-email/run-scheduled', runScheduledBulkEmails)

router.use(requireAdminAuth)

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

router.get('/faqs', listFaqs)
router.post('/faqs', createFaq)
router.put('/faqs/:id', updateFaq)
router.delete('/faqs/:id', deleteFaq)

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

router.get('/gastos', listGastos)
router.post('/gastos', createGasto)
router.put('/gastos/:id', updateGasto)
router.delete('/gastos/:id', deleteGasto)
router.post('/gastos/:id/archivos', uploadGastoArchivoMiddleware, uploadGastoArchivo)
router.get('/gastos/:gastoId/archivos/:archivoId', downloadGastoArchivo)
router.delete('/gastos/:gastoId/archivos/:archivoId', deleteGastoArchivo)

export { router as adminRoutes }
