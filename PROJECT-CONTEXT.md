# Leadership Practice — Working Context

> Handoff notes for anyone (human or AI) picking this project up cold.
> Written 30 Aug 2026, against branch `leadership-practice`.
>
> This file records **decisions, hard-won schema facts and open questions** —
> the things that are expensive to rediscover. It is not a substitute for the
> BRD or the prototype specification; it points at them and records how they
> relate.

---

## 1. What this is

**Andalusia Pulse · Leadership Practice** — a Power Apps Code App (Vite + React 18)
covering the governance execution cycle: Reports & Plans → Meetings & Committees →
Meeting Minutes (MOM) → Audit Grid scoring → Decisions → TMS Tasks.

| | |
|---|---|
| Environment | `https://org319b4ea9.crm4.dynamics.com/` |
| Solution | `LeadershipPractice` |
| Branch | `leadership-practice` |
| Dataverse tables | 40 in `.power/schemas/dataverse/` |
| Two modules | `src/modules/leadership/LeadershipApp.jsx` (execution), `src/modules/governance/GovernanceApp.jsx` (setup) |

---

## 2. THE GOVERNING RULE (decided by the product owner)

> **Implement as the prototype specification says. Where the specification is
> silent on how something is handled, take it from the BRD.**

This matters constantly, because the two documents disagree in ~29 places.

**Consequences of this rule that surprise people:**

- **AG-15 and AG-16 stay.** The BRD's catalogue has **13** active questions
  (AG-01…AG-14 minus retired AG-07). The prototype spec and the code have **15**
  (it adds AG-15 invitation lead time and AG-16 MOM write-up period). Every score
  therefore uses a different denominator than the BRD baseline. *This is accepted.*
- **The governance settings stay null.** The BRD confirms a 90% pass threshold, a
  48-hour MOM approval period and a 2-working-day agenda lead time. The spec leaves
  all three unresolved, so the app does too. Nothing is judged pass/fail.
- **`delegatedAttend` stays `'exclude'`** even though the BRD says a delegated
  attendance counts as present.
- **Decisions stay one entity** with a single six-value status, not the BRD's
  three entities (Intake / Request / Decision) with two status models.
- **Auto-scored Audit Grid answers are NOT stored.** The BRD requires retaining the
  score and its computed inputs (FR-MOM-13, NFR-15); the spec stores only manual
  answers and evidence. The spec wins.

**If a Grid is ever produced as accreditation evidence, the numbers will not
reconcile to the BRD.** That is a known, accepted gap — flag it in writing if it
comes up.

---

## 3. Source documents

| Document | Status | Use |
|---|---|---|
| `leadership-practice-prototype-spec.md` | **The specification** | Leads on every conflict |
| `Andalusia_Pulse_Leadership_Practice_BRD_V1.0.pdf` (30 Jul 2026) | Approved business baseline | Fills gaps only |
| `README.md` | Conversion notes | How the HTML prototype became this Vite project |

The BRD **contradicts itself** in three places, and the code picked a side:

1. **Setup Type** — §6 says "Business Meeting / Accreditation Committee"; §7.2 says
   "Business Meeting / Committee". `lm_setuptype` follows §6. **This decides which
   meetings get an Audit Grid at all** and is still open (see §7).
2. **Team of Teams** — a Category in FR-SET-02, a classification under
   Cross-functional in §7.2. Schema follows §7.2.
3. **Report Category** — three values in FR-RPT-07, four in FR-SET-12. Schema has four;
   the spec says three.

---

## 4. What is actually wired to Dataverse

| Area | State |
|---|---|
| Meeting Occurrences — create, edit, mark Held, attendance | ✅ **live** |
| Report Occurrences — create (from Template **and** Custom), file URL | ✅ **live** |
| **Meeting Minutes — full write path** | ✅ **live** (this session) |
| **Report review chain — submit / approve / RMI + history** | ✅ **live** (this session) |
| Authority Matrix + Approval Cycles | ✅ **live, read-only by design** |
| Audit Grid | ⚠️ read-only; scoring UI not built |
| Governance Setup module (templates) | ✅ live |
| Decisions, Tasks, Settings, My Workspace, Committee Scores | ❌ **seeded demo data only** |

**The scoring engine `scoreGrid()` still reads seeded state** (`db.occs`, `db.moms`,
`db.tasks`, `db.decisions`). Moving it onto live data is the single biggest
remaining piece of work.

---

## 5. Uncommitted work in the tree

6 files modified, ~688 insertions. Last commit is `9906bd3 Add models and new tables`.

| File | What changed |
|---|---|
| `src/services/dataverse.js` | +235 — Minutes writes, Audit Grid writes, Authority Matrix reads, report review chain, `updateAgendaCovered`, archive-instead-of-delete |
| `src/modules/leadership/LeadershipApp.jsx` | +535 — Minutes editor (`DvMinutesBody`), report review actions + history panel, Authority Matrix panel, working-day helper, non-working-day roll-forward |
| `vite.config.js` | +8 — `server.port: 3000`, `strictPort: true` |
| schemas / models | Re-pulled after two columns were widened |

### Behaviour changed this session

- **Working days, not calendar days.** New `shiftWorkingDays()` — AG-03, AG-15 and
  the report review deadline now skip Fri/Sat. `addDays()` remains for plain
  calendar offsets (task due dates etc.).
- **Non-working dates roll forward instead of being refused.** All three occurrence
  modals. The occurrence moves; the series never does.
- **No hard deletes.** `archiveMomNote()` / `archiveAuditGridAnswer()` set
  `statecode: 1`; all four read paths filter `statecode eq 0`.
- **Fixed a pre-existing crash** in `EditOccModal` (referenced an undefined
  `weekend`, introduced in commit `9ef00c5`).

---

## 6. Schema facts that are expensive to rediscover

### Logical names are inconsistent — some singular, some plural
`pac code add-data-source -t <name>` needs the exact logical name:

| Plural | Singular |
|---|---|
| `lm_meetingminutes`, `lm_momnotes` | `lm_auditgridinstance`, `lm_auditgridanswer`, `lm_approvalcycle`, `lm_approvalcyclestep`, `lm_authoritymatrixrow` |

Guessing wrong gives `Failed to get entity definition`. **The CLI also fails
transiently** — a name that fails once often works on retry.

### Chair / Co-Chair / Facilitator are NOT on the Setup
They live on the **per-scope child rows**:
- `lm_meetingtemplatebusinessunits` — has chairman, co-chairman, facilitator, Teams channel
- `lm_meetingtemplateregions` — same shape
- `lm_meetingtemplatedepartment_functions` — **has NONE of them**, only department + function

This is correct and deliberate: the same Committee runs in different BUs with
different chairs. It also means **one Setup produces one occurrence per scope**.

⚠️ **A department-scoped occurrence has no chair, no facilitator and no attendees**
— `lm_meetingattendeeslists` can only link to a BU row or a Region row, never a
department.

### `lm_meetingtemplates` has NO start time, end time, duration or time zone
The occurrence has all three columns; the Setup has nothing to populate them from.
**Meetings are created with blank times.** This also makes AG-16 unscoreable.

### Attendee type changes meaning between tables
| Table | Code 1 | Code 2 |
|---|---|---|
| `lm_meetingattendeeslists` (Setup) | **Core** | **Supportive** |
| `lm_meetingoccurrenceattendeeses` | **Required** | **Optional** |

Same codes, different labels — copying the raw integer works but reads like a bug.
AG-09 measures **Required** only.

### Columns still capped at Dataverse's default 100 characters
Dataverse **rejects with a 400 rather than truncating**, so all writes are guarded
client-side. Widened so far: `lm_momnotes.lm_notes` → 4000,
`lm_meetingminutes.lm_returnreason` → 2000.

**Still narrow and should be widened:**
- `lm_auditgridanswers.lm_evidence` — every manual score needs an evidence note
- `lm_auditgridinstances.lm_returnreason`
- `lm_auditgridinstances.lm_correctionreason`
- `lm_reportoccurrencehistories.lm_note` — the Request More Information reason

Constants to keep in step: `MOM_NOTE_MAX`, `MOM_REASON_MAX`, `GRID_EVIDENCE_MAX`,
`GRID_REASON_MAX`, `REPORT_NOTE_MAX` in `dataverse.js`.

### Other gaps found by reading the schema
- **No TOR review date** on `lm_meetingtemplates` — only the link. AG-01 can return
  5 or 0, never 3 ("present but past its review date").
- **No `Rescheduled` value** on `lm_meetingstatus`, and `lm_rescheduledfrom` is a
  **lookup to another occurrence** — which cannot record an auto-reschedule at
  creation, because there is no prior row to point at. A *date* column is needed.
- **No recorder position** anywhere. The spec falls back to Facilitator.
- **No `taxonomyState`** on report or meeting occurrences — the no-setup flag is
  written but nothing consumes it and no sync exists.
- **`lm_customname`** exists on report occurrences and is never written.
- **Stray `lm_newcolumn`** on `lm_meetingtemplatedepartment_functions` and
  `lm_reporttemplatereviewchains` — accidental default-named columns, safe to delete.
- **`DATAVERSE_CONFIG.publisherPrefix` is `'lp'`** but every table is `lm_`.

---

## 7. Open decisions — these block work

1. **Is Setup Type "Accreditation Committee" or "Committee"?**
   Decides which occurrences get an Audit Grid. **The code currently disagrees with
   itself** — the seeded path scores every Committee, the Dataverse path scores only
   accreditation ones. *Blocks the Audit Grid.*
2. **Where does the 0–6 authority level live?**
   The only candidate is `hr_level` (an HR grade). Visibility scope and role family
   exist nowhere. *Blocks the entire Decisions module.*
3. **How do Custom Reports get reviewers?**
   The review chain hangs off `lm_reporttemplatereviewchains` → Template. A Custom
   Report has no Template, so **it can be created but never reviewed**. Needs either
   a per-occurrence reviewer table or a borrowed chain. *Currently shows an explicit
   warning in the UI rather than failing silently.*
4. **Quorum: percentage or minimum head count?** The BRD flags this as unresolved in
   its own dependencies. Schema and code both assume percentage.
5. **One history table or three?** Reports have `lm_reportoccurrencehistories`.
   Meetings, Minutes and Grids have none.

---

## 8. Environment gotchas

- **`npx power-apps run` needs port 3000.** `power.config.json` pins
  `localAppUrl: http://localhost:3000`; Vite defaults to 5173. Fixed via
  `server.port` + `strictPort` in `vite.config.js`. **Side effect:** if 3000 is
  already in use, `npm run dev` now fails hard instead of moving to 3001.
- **`npm run dev` alone gives an app with NO data.** Dataverse calls are caught and
  swallowed, so everything renders empty. Use the Power Apps play URL to test with
  real data.
- **`xlsx` installs from the SheetJS CDN**, not npm. A checkout without network
  access to `cdn.sheetjs.com` fails the build with
  `failed to resolve import "xlsx"`. Fix: `npm install`.
- **Lint cannot run on this machine.** An Application Control policy blocks the
  oxlint native binary. No static analysis is running at all.
- **`pac` calls fail transiently** with `ETIMEDOUT` against
  `*.environment.api.powerplatform.com` (an Azure Private Link host). Retry.
  Telemetry warnings (`OneDS`) are noise and never block anything.
- **Bundle is ~1 MB** in one chunk, over Vite's advisory limit. `xlsx` is the
  obvious dynamic-import candidate.

---

## 9. Recommended next steps

1. **Widen the four remaining 100-character columns** (5 minutes, unblocks usable
   Audit Grid evidence and RMI reasons).
2. **Answer open decisions 1 and 2** — they gate the two largest remaining features.
3. **Decisions + Tasks tables.** Nothing else finishes without them: AG-10 → AG-14
   are a third of the Audit Grid score, and today they all return Not Applicable.
4. **Then the Audit Grid scoring UI.** Building it before Decisions and Tasks exist
   means publishing scores at ~50% coverage — and `approveAuditGridInstance()`
   **freezes a score permanently**, so early Grids would be stuck at half coverage.
5. Move `scoreGrid()`, My Workspace and Committee Scores onto live data.

---

## 10. Reference

Three working documents were produced alongside this file:

- **BRD Conformance Ledger** — 29 divergences between the build and the BRD, each
  showing whether the prototype spec pointed the same way
  <https://claude.ai/code/artifact/f5edcacd-187a-4c69-bec5-aacff1a2ae68>
- **Build-Out Checklist** — 63 tickable items across tables, columns, services,
  screens, integrations and decisions
  <https://claude.ai/code/artifact/59f13ef0-773f-438e-b172-c24820fe0e66>
- **Meeting Occurrence Generator** — step-by-step Power Automate build for the
  weekly Thursday flow that creates next week's occurrences, one per BU / Region /
  Department
  <https://claude.ai/code/artifact/6d7fefca-78cf-4172-a967-ce99bab2dbd1>

### A note on verification

Every schema claim in this file was read from the generated definitions in
`.power/schemas/dataverse/`, not from documentation. Where this file and the BRD
disagree about what a column contains, **this file describes what is actually
deployed**.
