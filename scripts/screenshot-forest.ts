import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.error('pageerror:', e.message))
await page.goto('http://localhost:5173/tenday-storm/#/elements', {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
})
await page.waitForTimeout(2500)
// Forest is selected by default
await page.screenshot({ path: 'scripts/el-forest-v2.png' })
console.log('saved')
await browser.close()
