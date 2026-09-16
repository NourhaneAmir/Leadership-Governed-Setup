import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/* ---------------------------------------------------------------------------
   Andalusia Pulse · Governance Setup

   One of two Code Apps built from this repo. This directory is the app root --
   power.config.json, index.html and dist/ all live here, which is what makes
   `npx power-apps push` unambiguous: it reads ./power.config.json from the
   working directory and has no --config flag.

   The SOURCE, though, is shared: ../../src holds dataverse.js, theme.css and
   both module trees, and neither app owns it. Only the generated Dataverse SDK
   is per-app, because `pac code add-data-source` writes it next to the config
   it finds -- hence the @generated alias below.
   --------------------------------------------------------------------------- */
const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../..')

export default defineConfig({
  root: here,
  base: './', // required for Power Apps Code Apps: assets are hosted under a
              // per-environment content URL, not the domain root, so paths
              // must be relative or the built JS/CSS 404 at runtime.

  // public/ and postcss.config.js are shared and live at the repo root, which
  // is no longer this app's root -- both have to be pointed at explicitly or
  // Vite looks for them under this directory and silently finds nothing.
  publicDir: path.resolve(repo, 'public'),
  css: { postcss: repo },

  resolve: {
    alias: {
      // dataverse.js is shared by both apps, but the generated SDK it imports
      // is not -- there is one per app root. This alias is what lets a single
      // service file bind to whichever app is being built.
      '@generated': path.resolve(here, 'src/generated'),
    },
  },

  build: {
    outDir: path.resolve(here, 'dist'),   // matches power.config.json buildPath
    emptyOutDir: true,
    // Without this, the CSS minifier rewrites every `@media(max-width:760px)`
    // into the modern range syntax `@media (width<=760px)`, which Safari did
    // not support until 16.4. An iPad on iPadOS 15 would then ignore EVERY
    // responsive rule and render the desktop layout. Pinning an older CSS
    // target keeps the classic syntax. It affects syntax only, not which
    // rules are emitted.
    cssTarget: 'chrome61',
    assetsInlineLimit: 0, // Power Apps' CSP is font-src 'self' -- small font
                          // subset files would otherwise get base64-inlined
                          // as data: URIs and get blocked. Force every asset
                          // to stay a real file served from the app's origin.
  },

  server: {
    // power.config.json pins localAppUrl to this port, and `npx power-apps
    // run` waits for the app there before handing it the Dataverse connection.
    // The two apps must not share a port.
    port: 3000,
    strictPort: true,
    // the shared source tree sits ABOVE this root, so Vite has to be told it
    // is allowed to serve from there
    fs: { allow: [repo] },
  },

  plugins: [react()],
})
