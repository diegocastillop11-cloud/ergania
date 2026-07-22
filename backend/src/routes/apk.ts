import { Router } from 'express'
import { logApkDownload, getApkVersion } from '../controllers/apkController'

const router = Router()

router.post('/download', logApkDownload)
router.get('/version', getApkVersion)

export { router as apkRoutes }
