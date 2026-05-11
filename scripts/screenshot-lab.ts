import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1800, height: 1200 } })
const page = await ctx.newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

await page.goto('http://localhost:5173/tenday-storm/#/lab', {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
})
await page.waitForTimeout(4000)
await page.screenshot({ path: 'scripts/lab.png', fullPage: false })
console.log('lab.png saved')

if (errors.length) {
  console.log('Errors:')
  for (const e of errors.slice(0, 10)) console.log('  ', e)
}
await browser.close()
