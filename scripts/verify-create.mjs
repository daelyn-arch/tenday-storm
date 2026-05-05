import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const EMAIL = `verify-${Date.now()}@example.com`
const PASSWORD = 'testpass123'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext()
const page = await ctx.newPage()
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warn') console.log(`[${m.type()}]`, m.text().slice(0, 400))
})
page.on('pageerror', (e) => console.log('[pageerror]', e.message))

const failures = []
page.on('response', async (resp) => {
  if (resp.url().includes('supabase.co') && resp.status() >= 400) {
    let body = ''
    try { body = await resp.text() } catch {}
    failures.push({ method: resp.request().method(), url: resp.url(), status: resp.status(), body: body.slice(0, 300) })
  }
})

await page.goto(BASE)
await page.waitForLoadState('networkidle')
await page.getByRole('button', { name: /^sign up$/i }).first().click()
await page.locator('input[type=email]').fill(EMAIL)
await page.locator('input[type=password]').fill(PASSWORD)
await page.getByRole('button', { name: /create account/i }).click()
await page.waitForTimeout(3000)

await page.goto(`${BASE}/c/new`)
await page.waitForLoadState('networkidle')
await page.waitForTimeout(1000)

console.log('Clicking Create campaign…')
await page.getByRole('button', { name: /create campaign/i }).click()

// Wait up to 15s for navigation to /c/:id/dm
const start = Date.now()
let navigated = false
while (Date.now() - start < 15000) {
  if (/\/c\/[0-9a-f-]+\/dm/.test(page.url())) {
    navigated = true
    break
  }
  await page.waitForTimeout(500)
}

console.log(`Final URL: ${page.url()}`)
console.log(`Navigated to DM view: ${navigated}`)
const errEl = await page.locator('.text-red-400').first().textContent().catch(() => null)
if (errEl) console.log(`Visible error: ${errEl}`)

if (failures.length) {
  console.log('\n=== Supabase failures ===')
  for (const f of failures) console.log(`  ${f.method} ${f.url.replace(/^https:\/\/[^/]+/, '')} ${f.status}: ${f.body}`)
} else {
  console.log('\n=== No Supabase errors ===')
}

const finalText = await page.locator('body').innerText()
console.log('\n=== Final body text (first 600 chars) ===')
console.log(finalText.slice(0, 600))

await browser.close()
process.exit(navigated && failures.length === 0 ? 0 : 1)
