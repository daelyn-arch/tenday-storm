// Reproduces the "Create campaign" flow end-to-end through a real browser to
// see exactly which request gets the RLS error and what auth state the page
// actually has at that moment. Logs:
//   - All console messages
//   - All network requests/responses to supabase.co (with auth header presence)
//   - localStorage snapshot before + after sign-in
//   - The actual error body returned for the failing campaign insert

import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const EMAIL = `test-${Date.now()}@example.com`
const PASSWORD = 'testpass123'

function trunc(s, n = 200) {
  if (s == null) return ''
  s = String(s)
  return s.length > n ? s.slice(0, n) + '…' : s
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

const log = (...args) => console.log('[browser]', ...args)
page.on('console', (msg) => log(`console.${msg.type()}:`, trunc(msg.text(), 400)))
page.on('pageerror', (err) => log('pageerror:', err.message))

const supabaseRequests = []
page.on('request', (req) => {
  const url = req.url()
  if (url.includes('supabase.co') || url.includes('localhost:5173/rest')) {
    const auth = req.headers()['authorization']
    supabaseRequests.push({
      method: req.method(),
      url,
      hasAuth: Boolean(auth),
      authPrefix: auth ? auth.slice(0, 16) + '…' : null,
      bodyPreview: req.postData() ? trunc(req.postData(), 200) : null,
    })
  }
})
page.on('response', async (resp) => {
  const url = resp.url()
  if (url.includes('supabase.co')) {
    const status = resp.status()
    if (status >= 400) {
      let body = ''
      try {
        body = await resp.text()
      } catch {
        // ignore
      }
      log(`✖ ${resp.request().method()} ${url} → ${status}: ${trunc(body, 400)}`)
    }
  }
})

console.log('=== Step 1: Open landing ===')
await page.goto(BASE)
await page.waitForLoadState('networkidle')

const beforeStorage = await page.evaluate(() => {
  const out = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    out[k] = localStorage.getItem(k)?.slice(0, 80) + '…'
  }
  return out
})
console.log('localStorage before sign-in keys:', Object.keys(beforeStorage))

console.log(`\n=== Step 2: Sign up as ${EMAIL} ===`)
// Click "Sign up" tab
await page.getByRole('button', { name: /^sign up$/i }).first().click()
await page.locator('input[type=email]').fill(EMAIL)
await page.locator('input[type=password]').fill(PASSWORD)
await page.getByRole('button', { name: /create account/i }).click()
await page.waitForTimeout(3000)

const afterSignup = await page.evaluate(() => {
  const out = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    const v = localStorage.getItem(k)
    out[k] = v ? v.slice(0, 100) : v
  }
  return out
})
console.log('localStorage after sign-up keys:', Object.keys(afterSignup))
const authKey = Object.keys(afterSignup).find((k) => k.includes('auth-token'))
if (authKey) {
  try {
    const parsed = JSON.parse(localStorage_get(afterSignup[authKey]))
    console.log('auth-token preview:', trunc(JSON.stringify(parsed), 300))
  } catch {
    console.log('auth-token preview:', trunc(afterSignup[authKey], 300))
  }
}
function localStorage_get(v) {
  return v
}

// Check the visible state on the page
const bodyText = await page.locator('body').innerText()
console.log('\nVisible body text (first 600 chars):\n', trunc(bodyText, 600))

console.log(`\n=== Step 3: Visit /c/new and try to Create campaign ===`)
await page.goto(`${BASE}/c/new`)
await page.waitForLoadState('networkidle')
await page.waitForTimeout(1000)

// The wizard generates a preview from defaults; "Create campaign" should be enabled.
const createBtn = page.getByRole('button', { name: /create campaign/i })
const exists = await createBtn.count()
console.log(`Create campaign button found: ${exists > 0}`)
if (exists > 0) {
  await createBtn.click()
  await page.waitForTimeout(4000)
}

console.log('\n=== Network requests to Supabase ===')
for (const r of supabaseRequests) {
  console.log(
    `  ${r.method} ${r.url.replace(/^https:\/\/[^/]+/, '')} hasAuth=${r.hasAuth} authPrefix=${r.authPrefix} body=${trunc(r.bodyPreview, 80)}`,
  )
}

console.log('\n=== Final visible body text ===')
console.log(trunc(await page.locator('body').innerText(), 800))

await browser.close()
