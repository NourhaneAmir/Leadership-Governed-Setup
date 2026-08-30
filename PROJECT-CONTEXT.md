# Leadership Practice — Working Context

> Handoff notes for anyone (human or AI) picking this project up cold.
> Written 30 Aug 2026, updated 02 Sep 2026 against branch `leadership-practice`.
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
| Dataverse tables | 39 registered in `power.config.json`, including Minutes, MOM Notes, Audit Grid instances/answers, Approval Cycles/Steps and Authority Matrix rows |
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
| Governance Setup module (Meeting + Report Template register) | ✅ live |
| **Group-wide (Stage 3/4) Chairman/Co-Chairman/Facilitator (Meeting) and Owner/Submitting Position/Team Channel/Speciality (Report)** | ✅ **live** (this session) |
| Meeting Occurrences — create, edit, **cancel**, **reschedule**, mark Held, **Agenda add/remove/reorder/record-distribution**, attendance | ✅ live (Attendance/Held/Edit from an earlier session; Cancel/Reschedule/Agenda edit **this session**) |
| Report Occurrences — create (Template **and** Custom), file URL, review chain (submit / approve / RMI) + history | ✅ live |
| **Meeting Minutes tab** (nav screen) — reads `lm_meetingminuteses` directly | ✅ **live** (this session — the write path itself, `DvMinutesBody`, was already live from an earlier session; only the top-level list screen was still seeded until now) |
| **Reports & Plans tab** (nav screen) — reads `lm_reportoccurrences` directly | ✅ **live** (this session — same story: the detail page was already live, the list screen wasn't) |
| Authority Matrix + Approval Cycles | ✅ live, read-only by design (`AuthorityMatrixPanel`, embedded in Governance Settings) |
| **Audit Grid — backend functions** (`saveAuditGridAnswer`, `archiveAuditGridAnswer`, `approveAuditGridInstance`, `createAuditGridInstance`) | ⚠️ **written, not called** — the Meeting's own Grid tab is still read-only display; no scoring UI calls these yet |
| Decisions, Tasks, Comments, Governance Settings (persisted values), Committee Scores (nav screen), My Workspace | ❌ **seeded demo data only** |

**The scoring engine `scoreGrid()` still reads seeded state** (`db.occs`, `db.moms`,
`db.tasks`, `db.decisions`). Moving it onto live data is still the single biggest
remaining piece of work, and it can't fully happen until Decisions and Tasks exist
(AG-10…AG-14 read them).

---

## 5. Recent work (this session)

Everything below is currently **uncommitted** in the working tree (last commit is
still `b9b76e3 "meeting minutes"`).

| File | What changed |
|---|---|
| `src/services/dataverse.js` | Added `updateMeetingOccurrenceStatus`, `updateMeetingOccurrenceAttendance`, `updateMeetingOccurrence` (edit), `cancelMeetingOccurrence`, `recordAgendaDistribution`, `createMeetingOccurrenceAgendaItem`, `archiveMeetingOccurrenceAgendaItem`, `updateMeetingOccurrenceAgendaSequence`. Widened `meetingTemplateParentPayload()` / `reportTemplateParentPayload()` and their matching `fetch*TemplateDetail()` selects for the new Stage 3/4 parent-row fields (see §6). Fixed a systemic bug: every `create()`/`update()` call used to assume success whenever nothing *threw*, silently discarding the SDK's own `result.success`/`result.error` — a shared `idOrThrow()` / `assertSuccess()` pair now surfaces Dataverse's real error message instead of a generic "no id was returned." (`fetchMeetingMinutes()` already existed, unused by any screen, until it was wired into `ScreenMinutes` this session — see the LeadershipApp.jsx row.) |
| `src/modules/leadership/LeadershipApp.jsx` | `DvMeetingDetail`: Mark as Held, Edit (`DvEditOccModal`), Cancel (`DvCancelOccModal`), Reschedule (`DvRescheduleOccModal` — creates a new occurrence + cancels the old one, see below), Attendance recording, Agenda add/remove/reorder/record-distribution. `ScreenMinutes` and `ScreenReports` switched from seeded `db.moms`/`db.reports` to live `dvMinutes`/`dvReportOccs`, with the now-redundant seed-only detail routes removed (`ReportDetail`, `RptTable`, `MomDetail`, `MomEditBody` are dead code as of this change, same situation `MeetingDetail` was already in). `NewMeetingModal`/`NewReportModal`: group-wide (Stage 3/4) Chairman/Facilitator/Owner/Submitting Position now fall back to the Setup's own parent-row fields instead of coming back empty. Excel file-reading proof of concept (`readExcelComponents`, via `xlsx` sourced from the SheetJS CDN, not npm — see §8) wired into the Report file field, client-side only, no Dataverse write. |
| `src/modules/governance/GovernanceApp.jsx` | `dataverseMeetingToSetup()` / `dataverseReportToSetup()`: a Stage 3/4 Setup's Chairman/Co-Chairman/Facilitator or Owner/Submitting Position/Team Channel/Speciality now hydrate from the parent row into a synthetic one-entry `units` list (keyed `GROUP_KEY`) when editing, instead of coming back blank. `meetingTemplateParentPayload()`/`reportTemplateParentPayload()` write them back out the same way on save. |
| `power.config.json`, `.power/schemas/...`, generated services/models | Refreshed for the new parent-row fields on `lm_meetingtemplates` and `lm_report_templates` (§6), and re-pulled after the tables in §4 were added. |

### Reschedule, specifically

Built as **create a new occurrence + cancel the old one**, not an in-place date
edit — because `lm_rescheduledfrom` is a lookup *from* a new row *to* the one it
replaced, and there's no `Rescheduled` value on `lm_meetingstatus`. The new
occurrence carries the same Setup, scope, Chair, Facilitator, Agenda (relabelled
source `'Rescheduled'`) and Attendees across; Agenda coverage and Attendance
already recorded stay behind on the original, now-cancelled occurrence.

---

## 6. Schema facts that are expensive to rediscover

### NEW this session: group-wide (Stage 3/4) roles now live on the parent row
`lm_meetingtemplates` gained `lm_meetingchairman`, `lm_meetingcochairman`,
`lm_meetingorganizerfacilitator`. `lm_report_templates` gained `lm_ownerposition`,
`lm_submittingposition`, `lm_teamchannel`, `lm_reportspecialty` — note this is a
**different logical name** than the per-unit tables' `lm_speciality`/
`lm_reportspeciality`, not a typo.

Why: a Stage 3/4 Setup has no per-unit child table at all (see the section below),
so it had nowhere to record who chairs/facilitates/owns it. These four/three
columns exist specifically to cover that one case — they are **not** used when a
Setup has real Business Unit or Region placements, which still use the per-unit
columns exclusively. `lm_report_templates` has no stage field of any kind, so
group-wide-ness is inferred purely from having neither a Business Unit nor a
Region child row.

### Logical names are inconsistent — some singular, some plural
`pac code add-data-source -t <name>` needs the exact logical name:

| Plural | Singular |
|---|---|
| `lm_meetingminutes`, `lm_momnotes` | `lm_auditgridinstance`, `lm_auditgridanswer`, `lm_approvalcycle`, `lm_approvalcyclestep`, `lm_authoritymatrixrow` |

Guessing wrong gives `Failed to get entity definition`. **The CLI also fails
transiently** — a name that fails once often works on retry.

### Chair / Co-Chair / Facilitator are NOT on the Setup — except now, sometimes
They live on the **per-scope child rows** for a Business-Unit- or Region-scoped
Setup:
- `lm_meetingtemplatebusinessunits` — has chairman, co-chairman, facilitator, Teams channel
- `lm_meetingtemplateregions` — same shape
- `lm_meetingtemplatedepartment_functions` — **has NONE of them**, only department + function

...and on the **parent row** for a group-wide (Stage 3/4) Setup — see above. This
is correct and deliberate: the same Committee runs in different BUs with
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

### Every create()/update() must be checked, not just try/caught
The Power Apps SDK's `create()`/`update()` calls **do not throw on a Dataverse
validation failure** — they resolve normally with `{ success: false, error }`.
Code that only wraps the call in try/catch and checks whether an id came back
(the pattern this whole file used before this session) silently reports a
misleading "succeeded but no id was returned" instead of the real reason
(a length cap, a required field, a permission error). Always route through
`idOrThrow()` (create) or `assertSuccess()` (update) in `dataverse.js`.

### Other gaps found by reading the schema
- **No TOR review date** on `lm_meetingtemplates` — only the link. AG-01 can return
  5 or 0, never 3 ("present but past its review date").
- **No `Rescheduled` value** on `lm_meetingstatus`, and `lm_rescheduledfrom` is a
  **lookup to another occurrence** — this is now actually wired (§5), but it means
  a reschedule is always a new row, never an in-place date change.
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
   accreditation ones. *Blocks the Audit Grid scoring UI, even though its backend
   functions and tables already exist.*
2. **Where does the 0–6 authority level live?**
   The only candidate is `hr_level` (an HR grade). Visibility scope and role family
   exist nowhere. *Blocks the entire Decisions module.* Authority Matrix rows and
   Approval Cycle tables are themselves now live and readable — this decision is the
   only thing stopping Decisions from being able to use them.
3. **How do Custom Reports get reviewers?**
   The review chain hangs off `lm_reporttemplatereviewchains` → Template. A Custom
   Report has no Template, so **it can be created but never reviewed**. Needs either
   a per-occurrence reviewer table or a borrowed chain. *Currently shows an explicit
   warning in the UI rather than failing silently.*
4. **Quorum: percentage or minimum head count?** The BRD flags this as unresolved in
   its own dependencies. Schema and code both assume percentage.
5. **One history table or three?** Reports have `lm_reportoccurrencehistories`.
   Meetings, Minutes and Grids have none.
6. **File storage direction (reporting behaviour) — paused on the product owner's
   instruction.** Report files currently save as a short text pointer
   (`lm_fileurl`, ≤100 chars — the CLI shortener route was tried and abandoned:
   the hosted app's CSP blocks calls to any external shortener). What "real"
   storage should mean (SharePoint upload? a longer URL column? something else)
   is intentionally on hold while reporting behaviour is being rethought — don't
   build further on this until asked.

---

## 8. Environment gotchas

- **`npx power-apps run` needs port 3000.** `power.config.json` pins
  `localAppUrl: http://localhost:3000`; Vite defaults to 5173. Fixed via
  `server.port` + `strictPort` in `vite.config.js`. **Side effect:** if 3000 is
  already in use, `npm run dev` now fails hard instead of moving to 3001.
- **`npm run dev` alone gives an app with NO data.** Dataverse calls are caught and
  swallowed, so everything renders empty. Use the Power Apps play URL to test with
  real data.
- **`xlsx` installs from the SheetJS CDN**, not npm. The npm registry's `xlsx`
  package (0.18.x) carries an unpatched prototype-pollution CVE with no fix
  available via npm — the maintainers only publish patched releases (0.19.3+) to
  `cdn.sheetjs.com`. `package.json` points at
  `https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz` for this reason. A
  checkout without network access to that host fails the build with
  `failed to resolve import "xlsx"`. Fix: `npm install`.
- **Lint cannot run on this machine.** An Application Control policy blocks the
  oxlint native binary. No static analysis is running at all. *(A different
  sandbox in this session's history could run `npx oxlint` directly — if that's
  available to you, use it; the note above describes the maker's own machine.)*
- **`pac` calls fail transiently** with `ETIMEDOUT` against
  `*.environment.api.powerplatform.com` (an Azure Private Link host). Retry.
  Telemetry warnings (`OneDS`) are noise and never block anything.
- **Bundle is ~1 MB** in one chunk, over Vite's advisory limit. `xlsx` is the
  obvious dynamic-import candidate.

---

## 9. Remaining features checklist

Organized by what actually unblocks each item — not by how big it feels.

### Ready to build now — table + backend already exist
- [ ] **Audit Grid scoring UI.** `saveAuditGridAnswer`, `archiveAuditGridAnswer`,
      `approveAuditGridInstance`, `createAuditGridInstance` are all written and
      unused. The Meeting's own Grid tab only *displays* `fetchAuditGridInstancesByOccurrence()`
      results today. Blocked in practice by Open Decision §7.1 (which occurrences
      even get a Grid) — worth resolving that first so the UI isn't built against
      the wrong rule.
- [ ] **Move `scoreGrid()` off seeded state**, at least for the auto-scored
      questions that don't depend on Tasks/Decisions (AG-01…AG-09, AG-15, AG-16).
      AG-10…AG-14 can't move until Tasks/Decisions exist.

### Blocked — needs a new Dataverse table
- [ ] **Decisions** — `lm_decisions`, `lm_decisionsteps`, `lm_decisionproposals`,
      `lm_decisionevidence`, `lm_decisionobservers` (5 tables). Also blocked by
      Open Decision §7.2.
- [ ] **Tasks** — `lm_tasks` (1 table), plus its own screen (Tasks are currently
      only a sub-object of MOM/Decision follow-up). Worth deciding what "sync"
      means in production before building real sync logic — the seeded version
      already fakes a sync-failure state.
- [ ] **Comments** — `lm_comments` (1 table). Decide up front: one shared table
      across every screen, or one per feature.
- [ ] **Governance Settings persistence** — `lm_governancesettings` (1 table).
      The real blocker isn't the table, it's getting sign-off on each of the 8
      OD-xx values (§2) — the screen exists specifically to simulate a value
      without pretending it's approved.

### Blocked — needs a decision, not a table
See §7 in full. In priority order by what they unblock: Setup Type (Audit Grid),
authority-level location (Decisions), Custom Report reviewers, quorum definition.

### Paused — by explicit instruction, not by a blocker
- [ ] Real file storage for Report working copies (SharePoint upload or
      equivalent) — see §7.6. Don't pick this up without asking first.

### Smaller, self-contained gaps
- [ ] `fetchSetups()` in `dataverse.js` is a literal stub
      (`return notWiredYet('fetchSetups')`) — confirm nothing still calls it, or
      implement it.
- [ ] Governance Setup's Report Template "destination SharePoint link" field has
      its own "Coming soon" placeholder, separate from the per-occurrence file
      field — same underlying pause as §7.6.
- [ ] Four narrow 100-character columns still need widening (§6) — a five-minute
      fix that unblocks usable Audit Grid evidence/reasons once that UI exists.
- [ ] Dead code from superseded seed-only components can be deleted once nobody
      needs it as a reference: `MeetingDetail`, `ReportDetail`, `RptTable`,
      `MomDetail`, `MomEditBody`.

---

## 10. Reference

Three working documents were produced alongside an earlier version of this file:

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

Two more were produced this session:

- **Feature Readiness** — every feature sorted by ready-now vs. blocked, with the
  exact prerequisite for each blocked item (kept up to date across this session —
  most of its "ready now" list is now in §5's "done" column instead)
  <https://claude.ai/code/artifact/8544c8a9-9875-404b-b562-fe4bb99766db>
- **Occurrence Detection Flow** — Power Automate build guide for detecting which
  Templates are due for an occurrence next week, plus the schema gaps (Twice
  Weekly/Monthly have no second-day field, Custom frequency has no rule field)
  that block full automation
  <https://claude.ai/code/artifact/f6d4a4e8-6138-4f7b-a183-6f50b47ceff8>

### A note on verification

Every schema claim in this file was read from the generated definitions in
`.power/schemas/dataverse/` or from the actual code in `src/services/dataverse.js`,
not from documentation. Where this file and the BRD disagree about what a column
contains, **this file describes what is actually deployed.**
