import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './', // required for Power Apps Code Apps: assets are hosted under a
              // per-environment content URL, not the domain root, so paths
              // must be relative or the built JS/CSS 404 at runtime.
  plugins: [react()],
})