import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 2400, height: 2000 } })
const page = await ctx.newPage()
for (const [name, url] of [
  ['proc-1', 'http://localhost:5173/tenday-storm/#/preview?seed=1'],
  ['proc-42', 'http://localhost:5173/tenday-storm/#/preview?seed=42'],
  ['proc-9973', 'http://localhost:5173/tenday-storm/#/preview?seed=9973'],
] as const) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `scripts/${name}.png`, fullPage: false })
  console.log(`${name}.png`)
}
await browser.close()
