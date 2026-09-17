# Deployment — Code App Development

How to push a new build of either Code App to the **same existing app
registrations** (same play URL, same app tile) instead of accidentally
registering a new app. Read this before running `power-apps push`.

## Environments

| | Environment ID / URL |
|---|---|
| **Code App Development** (where both apps are *hosted*) | `cd78a59b-e16f-e4aa-b0a1-8e450a70ed56` / `https://org998df960.crm4.dynamics.com` |
| **DT New** (where the *data* lives — see `src/services/xenv.js`) | `https://org319b4ea9.crm4.dynamics.com` |

Code App Development is reachable by URL via `pac`/`power-apps`, but does
**not** show up by GUID in `pac env list` / `pac admin list` — a known,
harmless quirk of this tenant, not a sign the environment is wrong.

Both apps read/write DT New's tables regardless of where they're hosted —
`DATA_ORG` in `xenv.js` hardcodes this. Nothing below changes that.

## The two apps

| App | App ID | Staging folder | Play URL |
|---|---|---|---|
| **Andalusia Pulse - Governance Setup (2)** | `786c1b14-bf09-4dd7-a0a2-5730e87744fe` | `C:\tmp\cad-gov-new` | `https://apps.powerapps.com/play/e/cd78a59b-e16f-e4aa-b0a1-8e450a70ed56/app/786c1b14-bf09-4dd7-a0a2-5730e87744fe` |
| **Andalusia Pulse - Leadership Execution (2)** | `d61c6237-fec1-45c7-80e0-a9c63dd1e662` | `C:\tmp\cad-exec-new` | `https://apps.powerapps.com/play/e/cd78a59b-e16f-e4aa-b0a1-8e450a70ed56/app/d61c6237-fec1-45c7-80e0-a9c63dd1e662` |

The `(2)` in both display names is not a typo — the original app IDs
(`4912152c…` Governance, `83db0ef8…` Leadership, plus an orphaned
`2ffd8322…`) are dead: their staging folders (`C:\tmp\cad-gov`,
`C:\tmp\cad-exec`) were lost, and Power Platform enforces unique app
*display names* per environment, so the replacements had to be named
differently. **Those three old apps still exist in the environment and
should eventually be deleted from the Power Apps portal** (no CLI command
for this) — do that only once the `(2)` apps are confirmed as the ones
actually in use.

**These two staging folders are the only copies of the metadata that lets
`power-apps push` target these exact app IDs.** If `C:\tmp\cad-gov-new` or
`C:\tmp\cad-exec-new` is lost again, the next push will be forced to
register a **third** set of apps under yet another display name — back up
these two folders somewhere durable (a zip in the repo's OneDrive folder,
a second machine, anywhere outside `C:\tmp`).

Each staging folder holds:
- `power.config.json` — the file that pins the push to this app ID and
  environment (see below)
- `.power/schemas/` — the cached Dataverse connector schema `pac`/
  `power-apps` needs present to push (do not delete)
- `dist/` — build output, overwritten fresh before every push
- `src/generated/` — leftover from initial registration, not used by push

## `power.config.json` (for reference — do not hand-edit these)

**Governance** (`C:\tmp\cad-gov-new\power.config.json`):
```json
{
  "version": "1.0",
  "appId": "786c1b14-bf09-4dd7-a0a2-5730e87744fe",
  "appDisplayName": "Andalusia Pulse - Governance Setup (2)",
  "region": "prod",
  "appType": "CodeApp",
  "environmentId": "cd78a59b-e16f-e4aa-b0a1-8e450a70ed56",
  "buildPath": "./dist",
  "buildEntryPoint": "index.html",
  "localAppUrl": "http://localhost:3000",
  "logoPath": "Default",
  "connectionReferences": {
    "3dccf2fe-8b6b-4516-99d3-8098d7f17111": {
      "id": "/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps",
      "displayName": "Microsoft Dataverse",
      "dataSources": ["commondataserviceforapps"],
      "authenticationType": "Oauth",
      "dataSets": {}
    }
  },
  "databaseReferences": {}
}
```

**Leadership** (`C:\tmp\cad-exec-new\power.config.json`): identical shape,
`appId` `d61c6237-fec1-45c7-80e0-a9c63dd1e662`, `localAppUrl`
`http://localhost:3001`, connection reference key
`04acb2af-5691-448a-945f-e7379b25f249`.

Both bind to `shared_commondataserviceforapps` generically (no `-t`
table flag, no `databaseReferences`) — this is what makes the
`dvTable()` cross-environment trick in `xenv.js` possible. Do not run
`pac code add-data-source -t <table>` against either staging folder; it
adds a home-environment-only per-table service and defeats the whole
cross-environment setup (see `xenv.js`'s header comment).

## How to push a new build to the SAME apps

Run from the repo root (`Leadership practice/`):

```bash
# 1. Build both apps from current source
npm run build

# 2. Copy fresh build output into each staging folder
rm -rf /c/tmp/cad-gov-new/dist  && cp -r apps/governance/dist /c/tmp/cad-gov-new/dist
rm -rf /c/tmp/cad-exec-new/dist && cp -r apps/leadership/dist /c/tmp/cad-exec-new/dist

# 3. Push each — from INSIDE its own staging folder, not the repo root
cd /c/tmp/cad-gov-new  && power-apps push --non-interactive
cd /c/tmp/cad-exec-new && power-apps push --non-interactive
```

A successful push prints the same play URL as above — that confirms it
landed on the existing app, not a new one. If the display name is ever
reported as already in use, or a push results in a URL with a different
app ID than the tables above, **stop** — something is wrong with the
staging folder, not a reason to just accept a third app.

## Auth (if a push fails with an auth/login error)

Each CLI keeps its own auth cache. Re-authenticate with:

```bash
pac auth create --deviceCode --environment https://org998df960.crm4.dynamics.com/ --name codeAppDev
power-apps login --device-code --environment-id cd78a59b-e16f-e4aa-b0a1-8e450a70ed56
```

Each prints a device code and a URL — sign in as the account that owns
these two app registrations.

## Diagnosing a live data problem after pushing

Open the deployed app's play URL (not `npm run dev`, which has no
Dataverse connection at all) and open the browser console. Run:

```js
await window.__xenvSmokeTest()
```

This creates, reads back, and deletes a throwaway row in
`lm_setupactivities` in DT New, and reports exactly where it failed if it
does. See `src/services/xenv.js` for what it checks.
