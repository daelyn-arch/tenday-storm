import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const EMAIL = `test-${Date.now()}@example.com`
const PASSWORD = 'testpass123'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext()
const page = await ctx.newPage()
page.on('console', (m) => console.log(`[console.${m.type()}]`, m.text().slice(0, 500)))
page.on('pageerror', (e) => console.log('[pageerror]', e.message))

await page.goto(BASE)
await page.waitForLoadState('networkidle')
await page.getByRole('button', { name: /^sign up$/i }).first().click()
await page.locator('input[type=email]').fill(EMAIL)
await page.locator('input[type=password]').fill(PASSWORD)
await page.getByRole('button', { name: /create account/i }).click()
await page.waitForTimeout(3000)

// Pull session token + decode JWT payload from inside the page.
const result = await page.evaluate(() => {
  const out = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.includes('auth-token')) {
      try {
        const parsed = JSON.parse(localStorage.getItem(k))
        out.session = {
          token_type: parsed.token_type,
          expires_in: parsed.expires_in,
          expires_at: parsed.expires_at,
          user: parsed.user
            ? {
                id: parsed.user.id,
                email: parsed.user.email,
                aud: parsed.user.aud,
                role: parsed.user.role,
                email_confirmed_at: parsed.user.email_confirmed_at,
                confirmed_at: parsed.user.confirmed_at,
                is_anonymous: parsed.user.is_anonymous,
              }
            : null,
        }
        // Decode JWT payload
        const at = parsed.access_token
        if (at) {
          const parts = at.split('.')
          if (parts.length === 3) {
            const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
            const padded = b64 + '=='.slice(0, (4 - (b64.length % 4)) % 4)
            try {
              out.jwtPayload = JSON.parse(atob(padded))
            } catch (e) {
              out.jwtError = e.message
            }
          }
        }
      } catch (e) {
        out.parseError = e.message
      }
    }
  }
  return out
})

console.log('\n=== Session / user ===')
console.log(JSON.stringify(result.session, null, 2))
console.log('\n=== Decoded JWT payload ===')
console.log(JSON.stringify(result.jwtPayload, null, 2))

await browser.close()
