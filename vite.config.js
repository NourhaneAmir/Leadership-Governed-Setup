import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './', // required for Power Apps Code Apps: assets are hosted under a
              // per-environment content URL, not the domain root, so paths
              // must be relative or the built JS/CSS 404 at runtime.
  build: {
    assetsInlineLimit: 0, // Power Apps' CSP is font-src 'self' -- small font
                          // subset files would otherwise get base64-inlined
                          // as data: URIs and get blocked. Force every asset
                          // to stay a real file served from the app's origin.
  },
  plugins: [react()],
})