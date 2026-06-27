import puppeteer from 'puppeteer-core'
import fs from 'fs'
import path from 'path'

async function findChrome() {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH
  if (envPath && fs.existsSync(envPath)) return envPath

  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]
  for (const c of candidates) if (fs.existsSync(c)) return c
  return null
}

async function main() {
  const [,, htmlPath, pdfPath] = process.argv
  if (!htmlPath || !pdfPath) {
    console.error('Usage: node generate-pdf.mjs <htmlPath> <pdfPath>')
    process.exit(2)
  }
  const absHtml = path.resolve(htmlPath)
  const absPdf = path.resolve(pdfPath)
  if (!fs.existsSync(absHtml)) {
    console.error('HTML file not found:', absHtml)
    process.exit(3)
  }

  const chrome = await findChrome()
  if (!chrome) {
    console.error('No Chrome/Edge executable found. Set PUPPETEER_EXECUTABLE_PATH or install Chrome/Edge.')
    process.exit(4)
  }

  const browser = await puppeteer.launch({ executablePath: chrome, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  try {
    const page = await browser.newPage()
    await page.goto('file://' + absHtml, { waitUntil: 'networkidle0' })
    await page.pdf({ path: absPdf, format: 'A4', printBackground: true })
    console.log(JSON.stringify({ ok: true, filename: path.basename(absPdf), pdfPath: absPdf }))
  } catch (err) {
    console.error('PDF generation error:', (err && err.message) || err)
    process.exit(5)
  } finally {
    await browser.close()
  }
}

main()
