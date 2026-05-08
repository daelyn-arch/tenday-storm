import { chromium } from 'playwright'

const URL = process.env.URL ?? 'http://localhost:5173/'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } })
const page = await ctx.newPage()
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(500)
await page.screenshot({ path: 'scripts/local.png', fullPage: false })
console.log('→ scripts/local.png')
await browser.close()
