import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1800, height: 1400 } })
const page = await ctx.newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

for (const seed of ['1', '42']) {
  await page.goto(`http://localhost:5173/tenday-storm/#/preview?wfc=${seed}&size=40x30`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await page.waitForTimeout(15000)
  await page.screenshot({ path: `scripts/wfc-${seed}.png`, fullPage: false })
  console.log(`saved wfc-${seed}.png`)
}

if (errors.length) {
  console.log('\nErrors:')
  for (const e of errors.slice(0, 10)) console.log('  ', e)
}
await browser.close()
