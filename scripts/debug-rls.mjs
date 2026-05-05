import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const EMAIL = `test-${Date.now()}@example.com`
const PASSWORD = 'testpass123'

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext()
const page = await ctx.newPage()
page.on('console', (m) => console.log(`[console.${m.type()}]`, m.text().slice(0, 800)))
page.on('pageerror', (e) => console.log('[pageerror]', e.message))

await page.goto(BASE)
await page.waitForLoadState('networkidle')
await page.getByRole('button', { name: /^sign up$/i }).first().click()
await page.locator('input[type=email]').fill(EMAIL)
await page.locator('input[type=password]').fill(PASSWORD)
await page.getByRole('button', { name: /create account/i }).click()
await page.waitForTimeout(3000)

// Run a battery of probes from inside the page using the existing supabase client.
const probes = await page.evaluate(async () => {
  const { supabase } = await import('/src/lib/supabase.ts')
  const out = {}

  // Who am I?
  const { data: u } = await supabase.auth.getUser()
  out.user = { id: u.user?.id, email: u.user?.email, role: u.user?.role }

  // Probe 1: SELECT * FROM campaigns (should return [], not error, if RLS is set up).
  out.selectCampaigns = await supabase.from('campaigns').select('id').limit(1)

  // Probe 2: Call join_by_code with bogus code — proves authenticated role can execute the RPC.
  out.rpcJoin = await supabase.rpc('join_by_code', { code: 'NONEXISTENT', name: 'probe' })

  // Probe 3: Minimal insert — only required fields, no triggers needed if it fails on WITH CHECK.
  out.minimalInsert = await supabase
    .from('campaigns')
    .insert({
      name: 'Probe',
      seed: 1,
      width: 10,
      height: 10,
      invite_code: 'PROBE' + Math.floor(Math.random() * 100000),
      party_q: 0,
      party_r: 0,
      storm_q: 0,
      storm_r: 0,
    })
    .select('id')

  return out
})

console.log('\n=== User from getUser() ===')
console.log(JSON.stringify(probes.user, null, 2))
console.log('\n=== SELECT campaigns LIMIT 1 ===')
console.log(JSON.stringify(probes.selectCampaigns, null, 2))
console.log('\n=== RPC join_by_code(NONEXISTENT) ===')
console.log(JSON.stringify(probes.rpcJoin, null, 2))
console.log('\n=== Minimal INSERT into campaigns ===')
console.log(JSON.stringify(probes.minimalInsert, null, 2))

await browser.close()
