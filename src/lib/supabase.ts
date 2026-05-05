import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey && !url.includes('YOUR-PROJECT'))

if (!supabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[tenday-storm] Supabase env vars not set. Copy .env.example to .env and fill in your project URL + anon key.',
  )
}

// Untyped client — we cast Row types at read sites via our own interfaces in src/types/db.ts.
export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder-anon-key',
  {
    auth: { persistSession: true, autoRefreshToken: true },
  },
)
