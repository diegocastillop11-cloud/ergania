import { Router } from 'express'
import * as ctrl from '../controllers/careersController'
import { uploadMiddleware } from '../controllers/careersController'

export const careersRoutes = Router()

careersRoutes.get('/stats', ctrl.getStats)

careersRoutes.get('/tracker', ctrl.getTracker)
careersRoutes.patch('/tracker/:id', ctrl.updateTrackerStatus)
careersRoutes.delete('/tracker/:id', ctrl.deleteTrackerEntry)
careersRoutes.post('/tracker/:id/apply', ctrl.markApplied)

careersRoutes.get('/pipeline', ctrl.getPipeline)
careersRoutes.post('/pipeline', ctrl.addToPipeline)
careersRoutes.delete('/pipeline', ctrl.removeFromPipeline)

careersRoutes.get('/portals', ctrl.getPortals)
careersRoutes.put('/portals', ctrl.updatePortals)

careersRoutes.get('/profile', ctrl.getProfile)
careersRoutes.put('/profile', ctrl.updateProfile)

// Perfiles (multi-perfil)
careersRoutes.get('/perfiles', ctrl.listPerfiles)
careersRoutes.post('/perfiles', ctrl.createPerfil)
careersRoutes.patch('/perfiles/:id', ctrl.renamePerfil)
careersRoutes.post('/perfiles/:id/activate', ctrl.activatePerfil)
careersRoutes.delete('/perfiles/:id', ctrl.deletePerfil)

careersRoutes.get('/cv', ctrl.getCV)
careersRoutes.put('/cv', ctrl.updateCV)

careersRoutes.get('/reports', ctrl.listReports)
careersRoutes.get('/reports/:slug', ctrl.getReport)

careersRoutes.post('/evaluate', ctrl.evaluateJob)
careersRoutes.post('/generate-cv', ctrl.generateCV)
careersRoutes.post('/salary-recommendation', ctrl.getSalaryRecommendation)

// Postulaciones
careersRoutes.get('/applications', ctrl.listApplications)
careersRoutes.post('/applications', ctrl.createApplication)
careersRoutes.get('/applications/:id', ctrl.getApplicationById)
careersRoutes.get('/applications/:id/pdf', ctrl.downloadApplicationPdf)
careersRoutes.get('/applications/:id/interview-prep/pdf', ctrl.downloadInterviewPrepPdf)
careersRoutes.patch('/applications/:id', ctrl.updateApplicationStatus)
careersRoutes.post('/applications/:id/interview-prep', ctrl.generateInterviewPrep)
careersRoutes.post('/applications/:id/answer', ctrl.answerQuestion)
careersRoutes.post('/applications/:id/cover-letter', ctrl.generateCoverLetter)
careersRoutes.post('/applications/:id/apply-kit', ctrl.generateApplyKit)
careersRoutes.post('/applications/:id/regenerate-cv', ctrl.regenerateCV)

// Optimizador LinkedIn
careersRoutes.post('/linkedin-optimize', ctrl.linkedinOptimize)

// Test de conectividad IA
careersRoutes.post('/test-ai', ctrl.testAi)

// Targets de búsqueda
careersRoutes.post('/suggest-targets', ctrl.suggestTargets)

// SSE: scanner en tiempo real
careersRoutes.get('/scan', ctrl.scanPortals)

// Backup / Restore
careersRoutes.get('/backup', ctrl.exportBackup)
careersRoutes.post('/restore', ctrl.importBackup)

// Parse CV con IA
careersRoutes.post('/parse-cv', uploadMiddleware, ctrl.parseCv)
