import { chromium } from 'playwright'

const URL = 'https://daelyn-arch.github.io/tenday-storm/'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

const consoleErrors: string[] = []
const pageErrors: string[] = []
const failedRequests: { url: string; status: number; statusText: string }[] = []

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
page.on('pageerror', (err) => pageErrors.push(err.message))
page.on('response', (resp) => {
  if (resp.status() >= 400) {
    failedRequests.push({ url: resp.url(), status: resp.status(), statusText: resp.statusText() })
  }
})

console.log(`Loading ${URL}…`)
const resp = await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })
console.log(`HTTP ${resp?.status()} ${resp?.statusText()}`)

await page.waitForTimeout(2000)

const title = await page.title()
const bodyText = (await page.textContent('body')) ?? ''
const hasRoot = (await page.$('#root')) !== null
const rootChildCount = await page.evaluate(() => document.getElementById('root')?.children.length ?? 0)
const url = page.url()

console.log(`\nFinal URL: ${url}`)
console.log(`Title: ${title}`)
console.log(`#root present: ${hasRoot}, children: ${rootChildCount}`)
console.log(`Body text (first 500 chars): ${bodyText.slice(0, 500).replace(/\s+/g, ' ').trim()}`)

if (failedRequests.length) {
  console.log(`\n=== Failed requests (${failedRequests.length}) ===`)
  for (const r of failedRequests.slice(0, 20)) console.log(`  ${r.status} ${r.url}`)
}
if (consoleErrors.length) {
  console.log(`\n=== Console errors (${consoleErrors.length}) ===`)
  for (const e of consoleErrors.slice(0, 20)) console.log(`  ${e}`)
}
if (pageErrors.length) {
  console.log(`\n=== Page errors (${pageErrors.length}) ===`)
  for (const e of pageErrors.slice(0, 20)) console.log(`  ${e}`)
}

await page.screenshot({ path: 'scripts/smoke-test.png', fullPage: false })
console.log(`\nScreenshot → scripts/smoke-test.png`)

await browser.close()
