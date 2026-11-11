import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths, so the build works at a domain root (Cloudflare
  // Pages) and under a sub-path (GitHub Pages) without changes.
  base: './',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
