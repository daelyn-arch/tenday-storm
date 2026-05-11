// Capture Scenes.tmx and GuideExamples.tmx at native resolution so we can
// inspect them and pick out structure coordinates for the stamp library.

import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 2400, height: 2000 } })
const page = await ctx.newPage()

for (const slug of ['', '?map=guide']) {
  const url = `http://localhost:5173/tenday-storm/#/preview${slug}`
  console.log(`Loading ${url}`)
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2500) // give the canvas bake time
  const fname = slug === '' ? 'tmx-scenes.png' : 'tmx-guide.png'
  await page.screenshot({ path: `scripts/${fname}`, fullPage: false })
  console.log(`  saved scripts/${fname}`)
}

await browser.close()
