import { chromium } from 'playwright'

const TYPES = [
  'plains',
  'forest',
  'hills',
  'mountain_range',
  'mountain_peak',
  'island_small',
  'island_medium',
  'lake',
  'beach',
  'fortress',
  'walled_city',
  'village',
  'watchtower',
  'cabin',
]

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.error('pageerror:', e.message))

await page.goto('http://localhost:5173/tenday-storm/#/elements', {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
})
await page.waitForTimeout(2000)

for (const t of TYPES) {
  await page.evaluate((type) => {
    const sidebar = document.querySelectorAll('aside button')
    for (const b of Array.from(sidebar)) {
      if ((b.textContent ?? '').toLowerCase().includes(type.replace('_', ' '))) {
        ;(b as HTMLButtonElement).click()
        return
      }
    }
  }, t)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `scripts/el-${t}.png`, fullPage: false })
  console.log(`el-${t}.png`)
}

await browser.close()
