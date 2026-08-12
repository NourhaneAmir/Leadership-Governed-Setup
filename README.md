# Andalusia Pulse · Leadership Practice — Code App project

Converted from the single-file `Leadership.html` prototype (React 18 UMD +
Babel-standalone) into a real Vite + React + Tailwind project, ready to
become a Power Apps Code App.

## What changed in the conversion

- **Two modules kept isolated, as they were originally**: the source file
  wrapped `LeadershipApp` and `GovernanceApp` in separate IIFEs so their
  same-named locals (`App`, `Btn`, `Ctx`, `TODAY`, `REGIONS`, `seed`, etc.)
  wouldn't collide. That's now handled automatically by real ES module
  scope -- `src/modules/leadership/LeadershipApp.jsx` and
  `src/modules/governance/GovernanceApp.jsx`.
- **`src/App.jsx`** replaces the original inline `Root()` component that
  switched between the two modules.
- **CSS preserved as-is** in `src/theme.css` -- it's already a complete,
  tuned design system (dark green/gold theme, all component classes). It's
  imported into `src/index.css` alongside Tailwind (`@import "tailwindcss"`),
  so both coexist: existing screens keep working unchanged, and any new
  components you build can use Tailwind utility classes directly.
- **Fonts self-hosted via `@fontsource`** (Outfit, Inter, JetBrains Mono),
  replacing the `fonts.googleapis.com` `<link>` and the `unpkg.com` React/
  Babel `<script>` tags -- Power Platform's Content Security Policy blocks
  those external calls once this runs as a Code App.
- **React pinned to 18.3** to match the Power Apps Code Apps template
  (Vite scaffolded React 19 by default).

Build was verified clean (`npm run build` succeeds, no errors).

## Prerequisites already assumed done
- Node.js, PAC CLI installed, Code Apps feature enabled on your environment.
- `pac auth create` has run and you have a profile for the environment
  below.

## Deploy: your environment, your solution

**Environment:** `https://org319b4ea9.crm4.dynamics.com/`
**Solution:** `LeadershipPractice` (publisher prefix `lp`)

```bash
npm install

# 1) Point at your environment -- do NOT run `pac env create`, it already exists.
pac env list
# find org319b4ea9 in the list and grab its Environment Id, then:
pac env select --environment <environment-id-for-org319b4ea9>

# 2) Initialize as a Code App (writes power.config.json)
pac code init --displayname "Andalusia Pulse - Leadership Practice"

# 3) Test locally as a Code App (opens a Power Apps preview URL, not just localhost)
npm run dev

# 4) Build and push to the environment
npm run build
pac code push
```

`pac code push` deploys the app **into org319b4ea9** -- it does not touch
solutions on its own. Add it to your `LeadershipPractice` solution next, in
the maker portal:

1. Go to **make.powerapps.com**, switch to the org319b4ea9 environment (top
   right environment picker).
2. Open the **LeadershipPractice** solution (publisher prefix `lp`) --
   create it here first if you haven't already: **Solutions -> + New
   solution**, name `LeadershipPractice`, publisher prefix `lp`.
3. Inside it: **Add existing -> Code app** -> select this app (it now
   appears in the environment's app list from the `pac code push` above).
4. When Dataverse tables are wired in (`pac code add-data-source`, see
   below), also add the **Connection Reference** to this same solution --
   that's what lets the connection remap cleanly if this solution is ever
   exported/imported into another environment.

From here on, iterate with `npm run build && pac code push` -- each push
updates the same app in place; you don't need to re-add it to the solution
each time.

## Dataverse connection — Regions and Business Units (wired)

`Regions` and `Business Units` (shown in Governed Lists, and used for the
Region/Business Unit scope cascade throughout every wizard) now read from
real Dataverse tables instead of the hardcoded list, with the hardcoded
list kept as an automatic fallback:

| App concept    | Table            | Columns used                              |
|-----------------|-------------------|--------------------------------------------|
| Region          | `crd04_regions`  | `crd04_regionsid` (id), `crd04_id` (name) |
| Business Unit    | `businessunit`   | `businessunitid` (id), `name`, `cr603_region` (lookup → Region) |

Run these once locally to generate the real service files (this is the
one remaining step -- `src/generated/services/` currently has two small
placeholder files standing in for these, so the app builds and runs today
using the built-in Region/Business Unit list; running the commands below
replaces them with the real, live-data versions):

```bash
pac auth create --name andalusiaEnv          # if not already signed in
pac env select --environment <the id matching org319b4ea9>

pac code add-data-source -a dataverse -t businessunit
pac code add-data-source -a dataverse -t crd04_regions
```

After running these:
1. Delete the two placeholder files: `src/generated/services/BusinessunitsService.js`
   and `src/generated/services/Crd04regionsService.js`.
2. Check the real file names the CLI created under `src/generated/services/`
   (Dataverse's auto-pluralization isn't always predictable for custom
   tables) — if they differ from `BusinessunitsService`/`Crd04regionsService`,
   update the two import lines at the top of `src/services/dataverse.js`
   to match.
3. `npm run dev` (via `pac code run && vite`, per the Power Apps SDK setup)
   and confirm Governed Lists shows your real Region/Business Unit data
   instead of the built-in Kingdom of Saudi Arabia / Egypt list.

Everything else (the fetch calls, the field mapping, the fallback-to-mock
behavior if Dataverse isn't reachable) is already in place in
`src/services/dataverse.js` and `GovernanceApp.jsx` — this is just
swapping two placeholder files for the CLI's real output.

Positions, Teams, Channels, Departments, Functions, Processes, KPIs, and
Setups are still on mock data — same pattern as above once you're ready
for those; just give me the table/column names.

## Not yet done (next steps, not part of this conversion)


- Data is still `localStorage`-backed (`KEY` in each module) exactly as in
  the original prototype -- swapping that for real Dataverse calls via
  `pac code add-data-source` is a separate step, since it touches your
  `lp_` table schema.
- No TypeScript types added -- this is plain `.jsx`, matching the original
  file's loosely-typed style, to avoid a large speculative type-authoring
  pass. Can be added incrementally later if you want stricter typing.