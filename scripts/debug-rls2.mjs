import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const EMAIL = `test-${Date.now()}@example.com`
const PASSWORD = 'testpass123'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext()
const page = await ctx.newPage()
page.on('console', (m) => console.log(`[console.${m.type()}]`, m.text().slice(0, 600)))
page.on('pageerror', (e) => console.log('[pageerror]', e.message))

await page.goto(BASE)
await page.waitForLoadState('networkidle')
await page.getByRole('button', { name: /^sign up$/i }).first().click()
await page.locator('input[type=email]').fill(EMAIL)
await page.locator('input[type=password]').fill(PASSWORD)
await page.getByRole('button', { name: /create account/i }).click()
await page.waitForTimeout(3000)

const r = await page.evaluate(async () => {
  const { supabase } = await import('/src/lib/supabase.ts')
  const out = {}

  // Insert WITHOUT .select() — no RETURNING, so SELECT policy doesn't apply.
  out.insertNoReturn = await supabase
    .from('campaigns')
    .insert({
      name: 'Probe2',
      seed: 2,
      width: 10,
      height: 10,
      invite_code: 'PRB' + Math.floor(Math.random() * 1e8),
      party_q: 0,
      party_r: 0,
      storm_q: 0,
      storm_r: 0,
    })

  // Try inserting into a downstream table (regions). Should fail with FK if no campaign exists,
  // or succeed if user is somehow a member of a phantom campaign — useful sanity.
  out.insertRegion = await supabase
    .from('regions')
    .insert({
      campaign_id: '00000000-0000-0000-0000-000000000000',
      name: 'X',
      color: '#ffffff',
      kingdom_lore: '',
      dm_lore: '',
      is_homeland: false,
    })

  // Try selecting our own auth user via PostgREST (auth.users isn't exposed, so this should
  // 404 or 401, not RLS — useful to confirm we're definitely authed)
  out.userMe = await supabase.auth.getUser()

  return out
})

console.log('\n=== INSERT campaigns (no RETURNING) ===')
console.log(JSON.stringify(r.insertNoReturn, null, 2))
console.log('\n=== INSERT regions for nonexistent campaign ===')
console.log(JSON.stringify(r.insertRegion, null, 2))
console.log('\n=== auth.getUser() ===')
console.log(JSON.stringify({ id: r.userMe.data?.user?.id, email: r.userMe.data?.user?.email }, null, 2))

await browser.close()
