import { Router } from 'express'
import { logApkDownload } from '../controllers/apkController'

const router = Router()

router.post('/download', logApkDownload)

export { router as apkRoutes }
