import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Self-hosted fonts, replacing the Google Fonts CDN <link> from the
// original prototype (Code Apps block external network calls via CSP).
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/500.css'
import '@fontsource/outfit/600.css'
import '@fontsource/outfit/700.css'
import '@fontsource/outfit/800.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'

import '../../../src/index.css'
import GovernanceApp from '../../../src/modules/governance/GovernanceApp.jsx'
import { smokeTestCreate, DATA_ORG } from '../../../src/services/xenv.js'

/* TEMPORARY -- the cross-environment proof. Run from the app's browser
   console:  await window.__xenvSmokeTest()
   It creates one throwaway lm_setupactivity row in DATA_ORG, reports whether
   the new record's GUID came back, and deletes the row again. Remove this
   block once the question is answered either way. */
window.__xenvSmokeTest = smokeTestCreate
window.__xenvDataOrg = DATA_ORG

/* This app ships ONE module. The sidebar's "Modules" switch button renders
   only when an onSwitch handler is passed, so it is absent here.

   To link the two apps once both are published, pass a handler that opens the
   other app's Power Apps URL:

     <GovernanceApp onSwitch={() => window.open('<Leadership Execution app URL>', '_blank')} />

   A plain window.open is the right call rather than an iframe -- see
   PROJECT-CONTEXT.md section 8 on the host CSP. */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GovernanceApp />
  </StrictMode>,
)
