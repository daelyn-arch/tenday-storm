import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves at <user>.github.io/<repo>/, so assets and routes need
// the repo prefix. Override locally with `vite build --base=/` if you ever
// host this somewhere else (e.g., Vercel) where the app lives at the root.
export default defineConfig({
  base: '/tenday-storm/',
  plugins: [react()],
})
