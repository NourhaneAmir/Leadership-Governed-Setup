# Leadership Practice — Working Context

> Handoff notes for anyone (human or AI) picking this project up cold.
> Written 30 Aug 2026, updated 01 Sep 2026, updated 02 Sep 2026 (twice),
> updated 04 Sep 2026, updated 05 Sep 2026, updated 06 Sep 2026,
> updated 07 Sep 2026 (twice), updated 08 Sep 2026, updated 12 Sep 2026
> (covering 09-12 Sep), updated 13 Sep 2026, updated 14 Sep 2026,
> updated 16 Sep 2026, updated 17 Sep 2026 (three times), against branch `leadership-practice`.
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
| Dataverse tables | 45 schema files in `.power/schemas/dataverse/`, plus `wlog_decisions`/`lm_reportoccurrencedepartmentfunctions` under `commondataservice` and the two KPI tables — see §6. Includes Minutes, MOM Notes, Audit Grid instances/answers, Approval Cycles/Steps, Authority Matrix rows, `pm_kpiachievments`/`stf_kpiachievmentbreakdowns`, (04 Sep) the four Report/Plan Composition tables, (06 Sep) `lm_reportoccurrencedepartmentfunctions`, (10 Sep) `lm_setupactivity` and (13 Sep) `lm_meetingoccurrencedepartmentfunction` |
| Two modules | `src/modules/leadership/LeadershipApp.jsx` (execution), `src/modules/governance/GovernanceApp.jsx` (setup) |
| **Two Code Apps (16 Sep)** | `apps/governance/` and `apps/leadership/` are each a real Code App root — own `power.config.json`, `index.html`, `vite.config.js`, `dist/`, `.power/` and `src/generated/`. **`src/` did not move**: it stays the shared source tree both apps build from. Build with `npm run build:governance` / `build:leadership`; push from inside the app directory, because `power-apps push` has no `--config` flag and reads `./power.config.json` from the working directory. See §5. |
| **Data comes from one environment (16 Sep)** | `src/services/xenv.js` routes every table through the Dataverse connector at a **named** target org (`DATA_ORG`), not through the per-table generated services, which can only ever reach the environment the app is deployed to. This is what lets an app hosted anywhere read and write DT New. See §6. |
| Shared layer (08 Sep) | `src/shared/format.js` (dates, working calendar, formatting) and `src/shared/ui.jsx` (presentational primitives) — pure, importable by either module. `src/modules/leadership/store.jsx` holds `Ctx`/`use`. A `SCREENS` registry in `LeadershipApp.jsx` is now the single definition of each nav tab. See §5/§9. |
| Domain + first screen files (11 Sep) | `src/modules/leadership/domain.jsx` — the report-composition domain, **26 symbols moved** out of LeadershipApp (KPI/Process/BI catalogues, achievement maths, citation vocabulary, `CiteCard`, `P`, `rptCfg`). `src/modules/leadership/screens/` holds the first three screens in their own files (`BusinessIntelligence.jsx`, `OrgReports.jsx`, `Hierarchy.jsx`), importing only from `domain.jsx`, `store.jsx` and `shared/`. LeadershipApp is down to ~9,765 lines from 10,115. |

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
| `prototype.html` (repo root, added 01 Sep 2026) | The actual static HTML prototype | Not built or served by Vite — a reference file only, for checking visual/copy fidelity against the original |
| `Leadership Practice Extension.html` | A **second**, richer prototype — shared in chat 02 Sep, **not saved to the repo** | Defines the full "Report/Plan Composition" feature: Sections with a Diagnostic Angle, KPI/Breakdown/Process/child-report citations, the Build-a-Report screen, Reports-received review actions, Sharing, Reporting Hierarchy. Source for the plan below — re-request it from the user if it's needed again, it only exists in that chat turn. |
| `C:\Users\Nourhan.AbdElSalam\.claude\plans\gleaming-greeting-zephyr.md` | Approved implementation plan (02 Sep), not part of the repo | Dataverse schema + phased implementation steps for the Report/Plan Composition feature above. Read this before doing any further work on Reports & Plans — see §5/§7.8/§9. ⚠️ **Not readable from the `nourh` Windows user this repo is checked out as** — copy it into the repo or it will keep being worked around. |
| `REPORT-OCCURRENCE-FLOW-PLAN.md` (repo root, added 05 Sep) | Plan only, no code | The weekly Power Automate flow that creates next week's Report Occurrences from approved Setups — frequency rules, field mapping, section/citation copying, duplicate guard, and five open items. Written against the live schema. |

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
| Report Occurrences — create (Template **and** Custom), file URL, review chain (submit / approve / RMI) + history | ⚠️ **built, but disconnected from the nav as of 02 Sep** — `NewReportModal`/`DvReportDetail`/`dvReportOccs` still exist and still work end to end against `lm_reportoccurrences`, but nothing currently opens them (see the row below and §5's 02 Sep entry) |
| **Meeting Minutes tab** (nav screen) — reads `lm_meetingminuteses` directly | ✅ **live** (01 Sep — the write path itself, `DvMinutesBody`, was already live from an earlier session; only the top-level list screen was still seeded until now) |
| **Build a report/plan tab** (Artifact group, `ScreenBuildReport`) | ✅ **live, read + write** (17 Sep) — opens a Draft or Returned, unlocked `lm_reportoccurrences` row; edits its title, Sections and Citations; saves only what changed; submits it for review. ⚠️ Not yet exercised against real Dataverse — see §9. |
| **Reports / Plans tab** (Artifact group, `ScreenOrgReports`) | ✅ **live** (17 Sep) — reads `lm_reportoccurrences`, `lm_reportoccurrencesections` and `lm_reportsectioncitations`. See §5. |
| **Reports & Plans composer** (hidden `rpt` screen, not the visible tab above) | 🔴 **reverted from live to seeded, on purpose, 02 Sep** — was reading `lm_reportoccurrences` directly as of 01 Sep; rebuilt this session as the citation-based composer from `prototype.html` (sections that cite live KPIs/tactics/PM entries/issues/tasks/other reports), which has no Dataverse equivalent yet, so it now runs on seeded `db.reports`/`db.paragraphs`/`db.templates` instead. This was an explicit product-owner instruction, not a regression found by accident — see §5. |
| Authority Matrix + Approval Cycles | ✅ live, read-only by design (`AuthorityMatrixPanel`, embedded in Governance Settings) |
| **Audit Grid scoring** — Meeting Occurrence's own Grid tab | ✅ **live** (this session) — `liveScoreGrid()` computes all 16 questions from the live occurrence/Minutes/Template; full Facilitator→Chair lifecycle (score, evidence, submit, approve+publish, return, open a correction version) writes through the backend functions that were already built |
| **My Workspace (nav screen)** | ✅ **live** — reads its Work Queue, Upcoming panel and This Month stats directly off the full `dvMeetingOccs`/`dvReportOccs` arrays via `dvWorkItems()`. Two silent-data-loss bugs fixed here 01 Sep — see §5: an overdue Meeting with partial attendance recording used to vanish from Work Queue, and a blank/unrecognized status code used to vanish a row from every screen at once. Its Decisions filter tab still shows 0 because Decisions (below) only just went live. |
| **Decisions register** | 🟡 **partially live** (this session) — `wlog_decisions` read + minimal create wired as its own list on the Decisions tab, alongside (not replacing) the existing seeded Decision workflow. Not yet linked to the Meeting Agenda Item or Report that raised it — deferred by explicit instruction, see §5/§6/§7. |
| **Committee Scores (nav screen)** | ✅ **live** (01 Sep) — `ScreenGrid` now reads `fetchAuditGridInstances()` joined against `dvMeetingOccs`, instead of seeded `db.grids`. See §5 for the join details and the Approved-only Coverage/Score rule. |
| **Setup Activity trail** — the Activity tab on a Report/Meeting Setup | ✅ **live** (10 Sep) — `lm_setupactivity` is written on create, edit, publish, approve and expire, and the tab reads the real rows back for any Setup that has a `_dataverseId`. A Setup that has never been saved still shows the seeded sample trail. |
| **Artifact group** — Business intelligence, Reporting hierarchy | 🟡 **mixed** (11 Sep) — both run on the app's own data rather than the prototype's parallel seed model, but that data is itself seeded: BI reports from `BI_REPORTS`, hierarchy edges derived from seeded `RPT:` paragraph citations. (Reports / Plans and Build a report/plan, in the same group, are live since 17 Sep — rows above.) The Power BI report itself **cannot be embedded** — see §8. |
| **How every table is reached** | 🟡 **changed 16 Sep** — all 42 tables now go through `dvTable()` in `src/services/xenv.js`, which calls the Dataverse connector against `DATA_ORG` (currently DT New). The generated per-table services are no longer imported anywhere. Behaviour is identical while an app is hosted in DT New; the point is that it stays identical when it is not. Creates supply their own primary key since 17 Sep, so a new row's id no longer depends on the response — see §6. |
| Tasks, Comments, Governance Settings (persisted values) | ❌ **seeded demo data only** |
| **Meeting Setup "Completion Periods"** (MOM Write-up / MOM Approval / Audit Grid Completion-Submission, each an hours field) | ✅ **live** (15 Sep) — three plain columns on `lm_meetingtemplates` (`lm_momwriteuphours`, `lm_momapprovalhours`, `lm_gridsubmithours`), written/read alongside `quorum`/`torLink` in `dataverse.js` and `GovernanceApp.jsx`. **Persistence only — not yet consumed.** AG-16/AG-05 scoring still reads the global `DEFAULT_SETTINGS` values (§9), not this per-Setup one; the UI says so. |
| **`lm_meetingoccurrencelinkedreports`** | 🔴 **registered, not wired to any screen** (15 Sep) — table + generated models exist (`lm_reportname`, lookups to `lm_meetingoccurrences`, `lm_reportoccurrences`, `lm_report_templates`); no app code reads or writes it yet. |

**`scoreGrid()` (seeded) and `liveScoreGrid()` (live) are two separate functions**,
not one shared implementation — the live version reads a Dataverse occurrence/
Minutes/Template shape that doesn't line up with the seeded `db`, so it re-derives
the same 16 questions independently rather than adapting live data into the
seeded function's expected shape. Two of its rows are deliberately simplified
(AG-01 checks only TOR presence, not a review date; AG-06 counts only Discussion
Notes, not Task/Decision outputs) and five always read Not Applicable — **AG-10
through AG-14 still can't move onto live data until Decisions and Tasks exist.**

---

## 5. Recent work

`dec7171 "Add audit scoring"` and `98f1012 "Add a rescheduale option..."`, on
top of `b9b76e3 "meeting minutes"`, were committed in an earlier pass.
`6fdde05 "Add cadence-aware Meeting dates and base wlog_decisions wiring"`
covers the section right below. `fe84b2b "Add the new prototype"` covers the
one after it, bundled together with `prototype.html` — the original static
HTML prototype, now checked into the repo root (see §3).

### This session: cadence-aware New Meeting date, and a live bug fix found along the way

`naturalRecurrenceDate(frequency, dayOfMonth, monthInQuarter, fromDate)` (new,
`LeadershipApp.jsx`, just above `NewMeetingModal`) computes the soonest real
calendar date a Setup's own cadence lands on — e.g. a Monthly Setup on day 1
next lands on the 1st of the soonest qualifying month. Wired into
`NewMeetingModal`'s existing "Setup detail loaded" effect so `f.date` defaults
to that computed date instead of a generic `today+5`. The existing
`bookedDate`/`moved` logic in that same form (already built by a parallel
session before this pass) picks the result up automatically — if the natural
date lands on a weekend or holiday, the form shows the "will be booked on…"
note and books the next working day on save. No new UI needed for that half.

`MEETING_MONTH_IN_QUARTER` (new export, `dataverse.js`) is the read-side
decode for `lm_monthofthequarter` — only the write-side key existed before.

**Semesterly/Annually reading of `monthInQuarter` is an assumption, not a
confirmed rule.** `lm_monthofthequarter` only has three values ("1st/2nd/3rd
month"), which is exact for Quarterly (a real 3-month quarter). For
Semesterly (6 months) and Annually (12 months) there is no equivalent field
in the schema, so "1st/2nd/3rd month of a quarter" is generalized here to
"1st/2nd/3rd slice of the period" (month 1/3/5 of a semester, month 1/5/9 of
a year). Flag this if it ever needs to match a real HR calendar precisely.

**Bug found and fixed along the way:** `DvRescheduleOccModal` called
`isWeekend()`, which a parallel session's edit had deleted from the file
while replacing most weekend-handling with the unified `isNonWorking()` +
auto-roll-forward approach above. Reschedule was never updated to match — it
deliberately still hard-blocks a weekend pick outright (a holiday there is
only a soft warning), so it needed its own `isWeekend()`, not the auto-roll
one. This would have thrown a `ReferenceError` the moment anyone opened
Reschedule on a live occurrence. Restored.

**Verified, no change needed:** My Workspace already read fully from
`dvMeetingOccs`/`dvReportOccs` (see §4) — asked, checked, confirmed, nothing
to fix.

### This session: `wlog_decisions` registered and wired at a base level

Per an explicit ask to add a Decisions table linked to the Decisions tab and
to Reports/Templates. What actually happened, and why it stopped short of
the full ask:

- Registered `wlog_decisions` (see §6 for the exact command — it is **not**
  the same invocation as every other table here) and inspected its real
  columns before writing any app code.
- **Found it has no lookup to any table in this app** — only to an unrelated
  employee time-log table (`wlog_worklogs`, also inspected, confirmed
  irrelevant, not kept registered). Reported this rather than guessing a
  link. The user's call: link it later (from the Report section / Meeting
  Agenda item), set up the base only for now.
- Also decided (same round): keep the existing seeded Decision workflow
  (Direct/Authority-Check types, Approval Cycle, Proposals, exec owner,
  outputs) as-is, and add `wlog_decisions` as a separate live list alongside
  it, not a replacement.
- Built accordingly: `fetchWorkLogDecisions()` / `createWorkLogDecision()` in
  `dataverse.js`, a `dvDecisions` array threaded through `refreshOccurrences()`
  same as `dvMeetingOccs`/`dvMinutes`, and a "Live Decisions (wlog_decisions)"
  card + `WorkLogDecisionModal` on `ScreenDecisions` (`LeadershipApp.jsx`).
  Status/Review Status/Escalation Result are read via the connector's
  `_xxx_label` sibling fields, not a hand-maintained numeric map — see §6 for
  why. No status is set on create; Dataverse's own option-set default applies.

**Near-miss during registration, worth knowing about:** `pac code
delete-data-source`, used to back out an exploratory registration, does a
full regeneration of `src/generated/` and silently renamed/deleted the
model/service files for a large number of **already-registered, unrelated**
tables — even though `power.config.json` itself came back clean. Caught via
`git status` before anything was committed; restored with `git checkout --
src/generated/ .power/schemas/appschemas/dataSourcesInfo.ts`. See §6 for the
safe way to back out a registration instead.

| File | What changed |
|---|---|
| `src/services/dataverse.js` | Added `updateMeetingOccurrenceStatus`, `updateMeetingOccurrenceAttendance`, `updateMeetingOccurrence` (edit), `cancelMeetingOccurrence`, `recordAgendaDistribution`, `createMeetingOccurrenceAgendaItem`, `archiveMeetingOccurrenceAgendaItem`, `updateMeetingOccurrenceAgendaSequence`. Widened `meetingTemplateParentPayload()` / `reportTemplateParentPayload()` and their matching `fetch*TemplateDetail()` selects for the Stage 3/4 parent-row fields (see §6). Fixed a systemic bug: every `create()`/`update()` call used to assume success whenever nothing *threw*, silently discarding the SDK's own `result.success`/`result.error` — a shared `idOrThrow()` / `assertSuccess()` pair now surfaces Dataverse's real error message instead of a generic "no id was returned." (`fetchMeetingMinutes()` already existed, unused by any screen, until it was wired into `ScreenMinutes`.) The Audit Grid backend (`saveAuditGridAnswer`, `archiveAuditGridAnswer`, `approveAuditGridInstance`, `createAuditGridInstance`, `updateAuditGridState`) was already fully built before this pass — none of it needed changing, only calling. |
| `src/modules/leadership/LeadershipApp.jsx` | `DvMeetingDetail`: Mark as Held, Edit (`DvEditOccModal`), Cancel (`DvCancelOccModal`), Reschedule (`DvRescheduleOccModal` — creates a new occurrence + cancels the old one, see below), Attendance recording, Agenda add/remove/reorder/record-distribution, and now full **Audit Grid scoring** (`DvGridBody`/`DvGridQuestion`/`DvGridCorrectionModal`, driven by a new `liveScoreGrid()`/`liveAttendance()` pair — see §4). `ScreenMinutes` and `ScreenReports` switched from seeded `db.moms`/`db.reports` to live `dvMinutes`/`dvReportOccs`, with the now-redundant seed-only detail routes removed (`ReportDetail`, `RptTable`, `MomDetail`, `MomEditBody` are dead code as of this change, same situation `MeetingDetail` was already in). `NewMeetingModal`/`NewReportModal`: group-wide (Stage 3/4) Chairman/Facilitator/Owner/Submitting Position now fall back to the Setup's own parent-row fields instead of coming back empty. Excel file-reading proof of concept (`readExcelComponents`, via `xlsx` sourced from the SheetJS CDN, not npm — see §8) wired into the Report file field, client-side only, no Dataverse write. |
| `src/modules/governance/GovernanceApp.jsx` | `dataverseMeetingToSetup()` / `dataverseReportToSetup()`: a Stage 3/4 Setup's Chairman/Co-Chairman/Facilitator or Owner/Submitting Position/Team Channel/Speciality now hydrate from the parent row into a synthetic one-entry `units` list (keyed `GROUP_KEY`) when editing, instead of coming back blank. `meetingTemplateParentPayload()`/`reportTemplateParentPayload()` write them back out the same way on save. Verified (no change needed): Supportive Function Representation already saves and reads back correctly end to end, and the Setup Register's Usage tab already reads live from `lm_meetingoccurrences`/`lm_reportoccurrences`. |
| `power.config.json`, `.power/schemas/...`, generated services/models | Refreshed for the new parent-row fields on `lm_meetingtemplates` and `lm_report_templates` (§6), and re-pulled after the tables in §4 were added. |

### Reschedule, specifically

Built as **create a new occurrence + cancel the old one**, not an in-place date
edit — because `lm_rescheduledfrom` is a lookup *from* a new row *to* the one it
replaced, and there's no `Rescheduled` value on `lm_meetingstatus`. The new
occurrence carries the same Setup, scope, Chair, Facilitator, Agenda (relabelled
source `'Rescheduled'`) and Attendees across; Agenda coverage and Attendance
already recorded stay behind on the original, now-cancelled occurrence.

### Audit Grid scoring, specifically

`liveScoreGrid()` is a **separate function from the seeded `scoreGrid()`**, not a
shared one adapted for live data — the live occurrence/Minutes/Template shape
doesn't line up cleanly with the seeded `db`, so re-deriving the same 16
questions independently was more reliable than forcing an adapter. Same
thresholds and bands throughout. Two rows are simplified because the data to do
better doesn't exist live yet (AG-01: TOR presence only, not a review date;
AG-06: counts only Discussion Notes, not Task/Decision outputs) — both say so in
their own "Computed from" trace text. AG-10 through AG-14 always read Not
Applicable. A "Clear" action was added for AG-02 (archives the Answer row,
`archiveAuditGridAnswer()`) since the backend already supported it and the UI
had no way to unset a manual score once picked. A full test scenario with a
worked-out expected score (91.4%, 7 of 15 coverage, from a specific fixture) is
in the Reference list, §10.

### This session (01 Sep): two silent-data-loss bugs fixed, Committee Scores gone live

**Bug 1 — Work Queue silently dropped overdue Meetings with partial
attendance.** `dvWorkItems()`'s "Mark the Meeting as Held, or cancel it"
prompt only fired when *every* Attendee was still unrecorded
(`unrecorded===o.attendees.length`). The moment even one Attendee had a
presence set while the Meeting itself was never marked Held, the condition
went false and the Meeting vanished from Work Queue entirely — no prompt,
no visibility. Fixed by decoupling it from attendance state: any Meeting
still `Scheduled` past its date now fires the prompt regardless of how much
attendance recording has happened.

**Bug 2 — a much bigger one, found while chasing the first: `status: null`
silently vanishes a row from every screen that reads it.** Proven directly
from a live screenshot: the Meetings tab showed 44 rows in the table but its
Not-yet-held/Held-record-open/Held-and-closed/Cancelled tabs summed to only
3. `MEETING_OCC_STATUS[o.lm_meetingstatus] || null` defaulted to `null` for
any row whose `lm_meetingstatus` was blank or unrecognized — and **every**
screen that reads Meeting/Report status (Work Queue, the Meetings tab, the
Calendar) branches on an exact `'Scheduled'`/`'Held'`/`'Cancelled'` string
match with no `null` case, so those rows disappeared everywhere at once,
not just from one screen. Fixed in all four status-decoding spots in
`dataverse.js` (`fetchMeetingOccurrences()`, `fetchReportOccurrences()`,
and their `*ByTemplate()` counterparts): default to `'Scheduled'` /
`'Draft'` instead of `null` — the state every occurrence/report starts in
when this app itself creates one. **Open question for whoever owns that
data:** 41 of 44 live Meeting Occurrences had no recognized status, which
strongly suggests they came from somewhere other than this app's own New
Meeting form (which always writes `Scheduled` explicitly) — most likely a
bulk-created batch (e.g. the Meeting Occurrence Generator flow, §10, if
it's live and isn't setting `lm_meetingstatus` on the rows it creates).
This fix is a safety net in the app, not a substitute for fixing that at
the source.

### This session (02 Sep): Reports & Plans rebuilt as a citation-based composer — **reverted from live Dataverse back to seeded, on purpose**

**This directly reverses the previous entry in this file** ("Reports & Plans
tab ... same story: the detail page was already live"). Read this before
touching `ScreenReports`/`ReportDetail` again.

**Why:** the product owner wants the tab to match `prototype.html`'s fuller
design — a Report authored as sections that each cite a live record (a KPI
with target/actual and an embedded Power BI preview, a Strategy tactic/POC/
project, a Planning & Monitoring entry, an issue from another system, a
task, another paragraph, or a whole child Report) instead of an uploaded
working-copy file — plus three more views (Section templates, Paragraph
pool, Reporting hierarchy). Explicit instruction: build this on **seeded
mock data first**, wire it to Dataverse later, because no tables exist yet
for sections/citations/templates. Full turn-by-turn requirements-gathering
for this is in the chat transcript, not repeated here.

**What actually changed in `LeadershipApp.jsx`:**
- `ScreenReports` and `ReportDetail` — previously listed as **dead code** in
  §9's "Smaller, self-contained gaps" (superseded by the live
  `dvReportOccs`-based screen) — are **revived and rewritten** to the
  citation-composer model, ported near line-for-line from `prototype.html`'s
  `LeadershipApp` IIFE (`ScreenReports`/`ReportDetail` around its line
  4529–4802). `RptTable` similarly revived/updated (still not called from
  anywhere, same as it wasn't in the prototype — kept for parity/reuse).
- New components, all in the same file, inserted right after
  `ReportDetail`: `BIEmbed`, `CiteCard`, `CitePicker`, `SectionRow`,
  `ReportComposer`, `KpiCascade`, `citeLabel`, `TemplateSectionEditor`,
  `TemplatesTab`, `PoolTab`, `reportChildIds`/`reportParentIds`,
  `HierarchyTab`, `ReportWizard` (+ its `WizSteps`/`shiftPeriod`/
  `WIZ_STEPS`/`WIZ_DEPTS`/`TPL_STYLE` helpers).
- New mock catalogues (all seeded consts, not Dataverse-backed):
  `DIAG`/`DiagChip`, `PROC_REG`, `BI_REPORTS`, `KPI_CAT` (+ `achFor`/
  `achPct`/`achCls`/`findKpi`/`bdDims`), `STRAT`, `PM_ENTRIES`, `ISSUES`,
  `SECTION_TPL_SEED`, `CITE_KINDS` (+ `citeKind`/`citeId`/`citeCls`) — all
  inserted right after the existing `RPT_SETUPS`. Each `RPT_SETUPS` entry
  gained a `tpl:` field pointing at its matching `SECTION_TPL_SEED` id
  (`rs1→TPL-QLT`, `rs2→TPL-NUR`, `rs4→TPL-BME`, `rs3→TPL-EXE`) — separate
  from the pre-existing `template:` field (a cosmetic working-copy filename,
  unrelated, left alone).
- `seed()` gained `paragraphs:[...]` (12 seeded sections, content ported
  verbatim from `prototype.html`) and `templates:
  JSON.parse(JSON.stringify(SECTION_TPL_SEED))`. The 8 existing seeded
  `db.reports` rows (`sub1`…`sub8`) had `file`/`url`/`ver`-as-upload-count
  replaced with `blocks:[...]` (an ordered array of paragraph ids) — same
  ids/people/statuses/periods as before, so every other place that reads
  `db.reports` (canSeeReport, reportDue, the meeting-input linker) needed no
  changes.
- New `A.*` action functions for the composer (`addTemplate`,
  `editTemplate`, `deleteTemplate`, `addTplSection`/`editTplSection`/
  `moveTplSection`/`removeTplSection`, `addTplItem`/`removeTplItem`,
  `applyTemplate`, `addSection`/`reuseSection`/`removeSection`/
  `moveSection`, `editPara`/`citePara`/`uncitePara`,
  `createReportFromWizard`) — all additive, existing `submitReport`/
  `reviewApprove`/`reviewRMI` untouched since they never referenced `file`.
- `ScreenWorkspace`'s "+ New Report" button used to open the live
  `NewReportModal` directly; now navigates to the Reports & Plans tab
  instead (`go('rpt')`), since a report created via `NewReportModal` would
  land in `dvReportOccs` and never show up on the now-seeded Register.

**What did NOT change:** `NewReportModal`, `DvReportDetail`, `dvReportOccs`
and every Dataverse call behind them are all still in the file, untested-
but-presumably-still-correct, simply **no longer reachable from any nav
path**. They are the natural starting point once real tables exist for the
section/citation content model — see the new Open Decision §7.8.

**Pre-existing bug fixed along the way, unrelated to the port itself:**
`ScreenReports` was already mid-edit and broken before this session started
(`git status` showed it uncommitted) — a JSX tag mismatch (4 `<>` vs 3
`</>`) that meant **the file didn't compile at all**. The rewrite above
replaced the whole function, incidentally fixing this.

**Second bug, found only after deploying to the live Power Apps player:**
the app hydrates its whole `db` from `localStorage` on load
(`localStorage.getItem(KEY)`, `KEY='andalusia_lp_v06'` at the time) and only
calls `seed()` if nothing is cached. A browser that had ever loaded the
*old* schema (no `paragraphs`/`templates`, `blocks` missing) kept that old
save, so on reload the app skipped `seed()`, loaded the stale shape, and
something reading `db.paragraphs.length` hit `undefined` — an **uncaught
render error with no error boundary, which blanks the entire app**, not
just the Reports tab (confirmed via a live screenshot: sidebar and top bar
gone too). Fixed by bumping `KEY` to `'andalusia_lp_v07'` — same pattern
already used for prior schema changes, forces a fresh `seed()` for anyone
with an old save cached. **Generalizes the same lesson already in §6** about
never letting a stale/unexpected shape silently propagate instead of
resetting to a known-good state — this time via a `localStorage` cache
rather than a Dataverse null default.

**Committee Scores tab (`ScreenGrid`) rewired to Dataverse.** Was 100%
seeded (`db.grids`/`db.occs`/`MTG_SETUPS`) despite the Audit Grid itself
being fully live per-occurrence (§4) — a real gap, not a stale doc note.
Now reads `fetchAuditGridInstances()` (already existed in `dataverse.js`,
never called by any screen until now) joined against `dvMeetingOccs`.
Simplification worth knowing: a live Grid Instance is only ever created for
an Accreditation Committee occurrence (`createAuditGridInstance()` is only
reachable from the `accred`-gated path in `DvMeetingDetail`/`DvGridBody`),
so unlike the seeded version there's no separate Committee-vs-Business-
Meeting filter to apply — every row already is one. Coverage/Score only
render once a Grid is `Approved`, matching when Dataverse actually
populates `lm_coverage`/`lm_score`; everything else shows "Pending Review"
rather than a stale or fabricated number. The question-catalogue card at
the bottom is untouched — it's the static, Taxonomy-owned list, not
per-org data.

**Also surfaced, not yet acted on:** re-reading the Authority Matrix /
Approval Cycle backend while answering a question about the Decisions tab
found it's considerably more ready than §7.2 implied — `lm_authoritymatrixrows`
(Type/Max Value/Required Level/Cycle), `lm_approvalcycles` +
`lm_approvalcyclesteps` (ordered routing), the 5-value `DECISION_TYPE` enum,
and `authorityCheckLive()` itself are all already built and live. See the
revised §7.2 below — the real remaining gap is narrower than it reads today.

### This session (02 Sep, continued): Report/Plan Composition — full plan approved, no application code yet

**Directly answers Open Decision §7.8** (below) — the "content model" gap
the seeded composer entry above left open. A second, richer prototype
(`Leadership Practice Extension.html`, chat-only, see §3) was walked
through in detail, and a full implementation plan was produced and
approved: `C:\Users\Nourhan.AbdElSalam\.claude\plans\gleaming-greeting-zephyr.md`.
**Read that file before doing anything else on Reports & Plans** — this
entry is a summary, not a substitute.

**Scope, as decided with the user:**
- Sections carry a Diagnostic Angle (Untyped/Descriptive/Diagnostic/
  Predictive/Prescriptive) and, at the Template level, links to multiple
  KPIs, KPI Breakdowns, Processes, or a child Report Template.
- At execution (Build a Report), the same Sections cite ten possible kinds:
  KPI, Breakdown, Process, POC, Project, Strategy, BI Report, Paragraph
  (another report's section), Issue, Task, or a whole child Report.
  **Only KPI and Breakdown resolve live figures** — everything else
  (POC/Project/Strategy/BI Report/Issue/Task) is a **text-only label**, by
  explicit instruction, since none of those have a live table in this app.
- **Task and Escalation tables: deferred.** Both would otherwise back two
  of the "Reports received" review actions (assign-a-task, escalate); for
  now both save as the same text-only citation treatment as POC/Project/
  etc. `PROJECT-CONTEXT.md` §9 already separately tracks a Tasks table as
  blocked for the unrelated MOM/Decision follow-up feature — this decision
  doesn't resolve that one, it just avoids building a second, different
  Tasks table for this feature in the meantime.
- **Sequencing: nothing gets built until every table in the plan's Part 1
  exists.** Explicit instruction — including the one step (wiring the
  orphaned `DvReportDetail` into navigation) that has no schema dependency
  at all.

**Two tables in the plan turned out to already exist** — registered and
inspected rather than assumed:
- `pm_kpiachievments` (real logical name, plural) — the periodic KPI
  actuals row: `_pm_kpi_value`, `_pm_businessunit_value`, `stf_department`/
  `stf_function` (as **text**, not lookups), `pm_month`/`pm_year`,
  `pm_target`/`pm_actual`, plus a `pm_breakdown` text column of unclear
  purpose (see §6).
- `stf_kpiachievmentbreakdowns` — richer than the plan first assumed: a
  real `stf_breakdowntype` choice column (not free text), **seven**
  separate optional member lookups (specialty/physician/account/
  sub-account/department/employee/platform — one active per row per the
  usual convention), a `stf_name` text column that may be a ready-made
  display label, and a `_stf_total_value` lookup back to the parent
  `pm_kpiachievments` row (there is no direct KPI lookup on this table).
  Full column notes in §6 and in the plan file's Part 1 §B.

**Open technical unknowns, not product decisions** (full detail in the
plan file's "Open items"): which table `_pm_kpi_value` actually points at;
whether `stf_name` alone is enough to display a breakdown without resolving
which of the seven member lookups applies; how `pm_breakdown` (text, on
the achievement row itself) relates to the separate breakdown table; and
whether Dataverse's record-sharing (`GrantAccess`) is reachable from this
SDK at all, needed for the plan's Sharing step.

**This directly overlaps with the seeded composer built earlier the same
day** (previous entry above) — that work is effectively a working UI
reference implementation of much of what this plan's Part 2 calls for
(`ReportComposer`, `SectionRow`, `CitePicker`, `TemplateSectionEditor`,
`HierarchyTab`, etc., all already written against seeded data in
`LeadershipApp.jsx`). Once the plan's tables exist, porting those
components to read/write the real tables is likely far less work than
building the UI from scratch — check that code before writing new
components for any of the plan's Part 2 steps.

### This session (04 Sep): Report/Plan Composition schema registered, and Template Sections built in Governance Setup

**Uncommitted at time of writing.** Last commit is `f5b1c39`.

**Six tables registered or refreshed** — the plan's Part 1 schema is now
substantially present:

| Table | What |
|---|---|
| `lm_reporttemplatecontentchecklists` | **updated** — gained `lm_diagnosticangle` (1=Untyped … 5=Prescriptive) |
| `lm_reportoccurrences` | **updated** — gained `lm_function` |
| `lm_reporttemplatesectionitems` | **new** — Template-side citations: `lm_itemtype` (1=KPI, 2=Breakdown, 3=Process, 4=Child Template), `lm_KPI`, `lm_Process`, `lm_ChildReportTemplate`, `lm_breakdowndimension` (7 values), `lm_SectionChecklistItem`, required `lm_sectionitemname` |
| `lm_reportoccurrencesections` | **new** — execution-side sections: `lm_heading` (850), **`lm_body` 4000**, `lm_sequence`, `lm_diagnosticangle`, `lm_source` (Migrated/Added), `lm_reportoccurrence`, `lm_sourcesectionchecklistitem` |
| `lm_reportsectioncitations` | **new** — occurrence-side citations, **11 kinds** (`lm_kind`: KPI, Breakdown, Process, POC, Project, Strategy, BI Report, Paragraph, Issue, Task, Child Report). Live lookups only for `lm_kpi`, `lm_process`, `lm_citedsection`, `lm_citedreportoccurrence` — the rest are text-only, as decided |
| `lm_reportoccurrenceshare` | **new** — the Sharing model. Columns not yet inspected |
| `wlog_decisions` | **refreshed** — see the §6 note below; it gained a link column that a `wlog_`-prefix diff misses |

**Governance Setup: the Expected Content Checklist is now a Section editor.**
Built to the `Leadership Practice Extension.html` reference, for **both create
and edit** (the same `Wizard` renders both). Each Section carries a heading, a
Diagnostic Angle, and any number of cited KPIs / KPI breakdowns / Processes /
child report-plans. Multi-select falls out of the schema — each citation is its
own `lm_reporttemplatesectionitems` row, so no junction concept was needed.

Product-owner decisions taken during the build, all three the recommended option:
- **All 7 breakdown dimensions are offered for any KPI**, not filtered to the
  ones that KPI actually holds data for — the KPI↔breakdown join is still
  unconfirmed (§6), so filtering would mean guessing at it.
- **Template-wide Related KPIs / Related Processes stay untouched** and coexist
  with section-level citations. They answer different questions (what the report
  is about vs. what this section pulls in).
- **A child report/plan excludes the template being edited**, so a template
  cannot cite itself and recurse when used.

Then a second pass added **scope filters** (Business Unit / Department, cascading,
with Function for child reports only — see §6) and **per-kind colour on the
chips** (KPI blue, Breakdown purple, Process green, Child report amber), applied
inline rather than in `theme.css` because that stylesheet is shared with the
execution module.

| File | What changed |
|---|---|
| `src/services/dataverse.js` | New exports `SECTION_ANGLE`/`_KEY`, `SECTION_ITEM_TYPE`/`_KEY`, `SECTION_BREAKDOWN_DIM`/`_KEY`, and `createSectionItems()`. Wired into all three paths: the create loop now **awaits the checklist row for its id** before binding items to it; `fetchReportTemplateChildIds()` gathers section items per checklist row so `updateReportTemplateToDataverse()` can delete them; the delete pass removes **section items before their parent checklist rows**; `fetchReportTemplateDetail()` reads the angle and attaches each row's items. |
| `src/modules/governance/GovernanceApp.jsx` | New `SectionEditor` / `SectionRowEditor` / `PickList` / `ScopeFilter`, plus `SECTION_ANGLES`, `SECTION_ITEM_KINDS`, `SECTION_BREAKDOWN_DIMS`, `SEC_ITEM_STYLE`, `SEC_ITEM_LABEL`, `DV_SECTION_ANGLE`. The checklist `Field` swapped from a plain `RowEditor` to `SectionEditor`. `reportTemplatePayload()` and `dataverseReportToSetup()` extended to map sections both ways. |
| `src/modules/governance/governance-modern.css` | One rule to make the Review Chain position picker fill its row — see §6. |

**Bug fixed: the Review Chain picker never stretched.** `theme.css` has
`.chain-row select{flex:1}`, but `PosSel` renders a **`<button>`**, not a
`<select>`, so that rule never matched. `.pos-sel-btn` was already `width:100%`,
which made it look like it should stretch — but 100% of a box that has shrunk to
its content is still narrow, because the sizing has to be on the parent.
Fixed with `.gov-root .chain-row .pos-sel{ flex:1 1 240px; min-width:0 }` —
the basis keeps it responsive (it wraps below ~240px instead of crushing the
reviews/approves tags), and `min-width:0` lets a long position name ellipsize
rather than forcing the row wider than its container.

**Not verified against live Dataverse.** Everything builds and renders with no
runtime errors, but the section round-trip (save a template with several
citations, reopen, confirm they come back with the right angle) still needs a
pass through the Power Apps play URL.

### This session (05 Sep): round-trip audit of the Report Template, four gaps closed, cadence completed

**Uncommitted.** Last commit is still `f5b1c39`.

**Schema refreshed three times as columns were added:**

| Table | Change |
|---|---|
| `lm_report_templates` | **`lm_stage`** (1–4, same order as `STAGES`); `lm_destinationsharepointlink` **100 → 1000**; then **`lm_seconddayoftheweek`** (1–5), **`lm_seconddayofthemonth`** (int), **`lm_monthofthesemester`** (1–6) |
| `lm_reporttemplatereviewchains` | gained **`lm_meetingtemplate`** — a Meeting Template lookup; nothing reads or writes it yet |
| `wlog_decisions` | gained **`_lm_citedreportsection_value`** — see §6, it is an `lm_` column on a `wlog_` table |

**Stage 3/4 Review Chains were being silently discarded.** The unit loop in
`createReportTemplateChildren()` hit an `else { warn; continue; }` for any unit
that was neither Business-Unit nor Region scoped — which is *every* group-wide
Setup — and the comment claimed the chain had "nowhere to go". That was wrong:
`lm_reporttemplatereviewchains` carries a direct `lm_reporttemplate` lookup
alongside the two per-unit ones, and the write loop already bound it. Removing
the `continue` was only a third of the fix — the read path and the delete pass
both keyed on a BU/Region row that does not exist for these Setups, so without
matching queries the rows would have saved, never come back, and **duplicated on
every edit**. All three now handle the group-wide case, plus the form hydrate,
which was hard-coding `reviewChain:[]`.

**A round-trip audit** (form → payload → write → read → hydrate) found four
fields that never survived an edit. Three are fixed:

- **Destination is now derived, not typed.** The Delivery selector and the
  Site / Library / Folder pickers are **gone**. `destinationOf(s)` walks the units
  and takes the first Channel that resolves to a SharePoint path — the rule the
  old auto-fill already used — and is called both when displaying and when
  saving, so the stored value cannot drift from its Channel. Previously it was a
  free-text field that auto-fill only *sometimes* overwrote, and `site`/`library`/
  `folder` were never sent at all: a File-destination Template saved with no
  destination and then **failed its own validation on reopen**.
- **Stage now round-trips** via `lm_stage`, with the old "infer from whether BU or
  Region rows exist" kept only as a fallback for older rows. That inference could
  not tell Stage 3 from Stage 4, so a Stage 4 Template came back as Stage 3 —
  and since the stage feeds the name prefix, **saving it again renamed it**.
- **A name clash with a SAVED Template is now caught.** `nameRules()` only ever
  checked `db.setups` — this session's Setups — so a clash with anything already
  in Dataverse went unnoticed. New `savedTemplateNamed()` checks the live
  register and says what to do about it: *open that Template and add your
  Business Unit or Region to it* rather than creating a second one.
- **Still open: `qualifier` is never saved.** The name is recomputed from
  `derivedName()` on every save and includes the qualifier, so a Template named
  "… (Clinical)" reopens with an empty qualifier and **re-saves without it** —
  potentially renaming itself into a collision with the very Template the
  qualifier existed to distinguish it from.

**Cadence completed for the twice-per-period frequencies.** Twice Weekly now
takes two days of the week (the second dropdown excludes the first), Twice
Monthly two days of the month, and Semesterly its own 1–6 month list. `MIQ_FREQ`
shrank to `['Quarterly']` — Semesterly and Annually were previously being
described with a *three*-month quarter field. Validation requires the second day
and rejects two identical days. **Annual is deliberately not wired** — see §6.

**Also this session:** at least one Section with a heading is now required to
publish (an untitled Section used to pass validation and then be dropped
silently by the payload's `.filter(c=>c.text)`) — **stale as of 22 Sep: the
"at least one Section" half of this was deliberately dropped, see §5's 22 Sep
"Content Checklist ... optional" entry. The untitled-Section half (a Section
with no heading still blocks) is unchanged.** The Setup Register defaults to
newest first on the `Updated` column it already displays; and the child
report/plan picker was fixed — it read local Setups, whose Dataverse id lives on
`_dataverseId` not `dvId`, so it wrote a *session* id like `su-8` as a lookup and
Dataverse rejected the row.

**Produced, not built:** `REPORT-OCCURRENCE-FLOW-PLAN.md` (see §3) — the weekly
Report Occurrence generator, planned in full against the live schema.

### This session (06 Sep): `lm_reportoccurrencedepartmentfunctions` registered — multi-department Report Occurrences

Per an explicit ask: a Report Occurrence's `lm_department`/`lm_function` (04 Sep,
§6) only ever hold **one** line, but a Report Template can name several
(`lm_reporttemplatedepartmentfunctions`). This new child table lets an
occurrence carry all of them, not just the first.

**Registration needed two guesses before it worked — see §6 for the full
story.** The logical name given for the ask (`lm_reportoccurrencedepartmentfunction`,
singular) 404'd against the legacy `shared_commondataservice` connector, the same
one used for `wlog_decisions`. The **plural** form
(`lm_reportoccurrencedepartmentfunctions`) worked on the first try. An
intermediate attempt via `shared_commondataserviceforapps` "succeeded" but
produced the same empty, untyped connector entry (`dataSets: {}`) already
documented as a dead end for `wlog_decisions` — backed out via the documented
hand-edit procedure (git checkout the three touched files, delete the two new
generated files) before retrying with the working connector.

**Real columns, inspected after registration, not assumed:**
`_lm_linkeddepartment_value` → `cr603_chklst_departmentses` (nav property
`lm_Linkeddepartment`), `_lm_linkedfunction_value` → `hr_functions` (nav
property `lm_LinkedFunction`), `_lm_reportoccurrence_value` →
`lm_reportoccurrences` (nav property `lm_Reportoccurrence`), plus `lm_name`
(850 chars) and the standard audit/state columns. **No sequence/step column**
— row order is not preserved, only membership. **Lookup names do not match
the template-side table**: `lm_reporttemplatedepartmentfunctions` uses
`lm_Department`/`lm_Function`; this table uses
`lm_Linkeddepartment`/`lm_LinkedFunction` for the equivalent two
relationships — copying values across requires renaming the field, not a
straight copy.

**Registered the same way as `wlog_decisions`** — `"dataSourceType":
"Connector"` in `dataSourcesInfo.ts`, sitting in `power.config.json` under
`connectionReferences` (reusing the same `39b0e662674844b79a870b4e5a7485c9`
legacy connection id), not `databaseReferences.default.cds`. Functionally
identical `create`/`update`/`get`/`getAll` shape
(`Lm_reportoccurrencedepartmentfunctionsService`).

**Not yet wired into any app code** — this session only registered the table
and updated `REPORT-OCCURRENCE-FLOW-PLAN.md` (§3) to write one child row per
template Department/Function line, in a new Loop DF alongside the existing
Loop D (sections). `lm_reportoccurrences.lm_department`/`lm_function` are left
as they were — still populated from the first line only, now redundant with
this table for anything that reads the full list. No screen in either module
reads or writes this table yet.

**Superseded the next day, 07 Sep — see below.** The Loop DF design this
entry describes was reversed within 24 hours: an occurrence now carries
exactly one department, not several, so this table has no job left in the
flow. Left as-is here since it's the accurate history of what was built and
why; the current state is in the two entries below.

### This session (07 Sep): Governance Setup — six small, independent UX fixes

None of these touch the Leadership execution module — every fix stayed
inside `GovernanceApp.jsx` / `governance-modern.css`, per standing
instruction for this stretch of work.

1. **A Setup's derived name now falls back to Frequency + a stage word
   instead of just the classification noun once 3+ departments/functions are
   in scope.** `subjectOf()` already dropped the subject at that point (three
   or more reads as "too broad to name"); `derivedName()` used to fall back
   to `[StagePrefix, Noun]` only (e.g. plain "Operational Meeting"), losing
   every distinguishing detail. New `FALLBACK_STAGE_WORD =
   ['BU','Region','Group','Top Management']` — deliberately a **separate**
   array from `STAGE_PREFIX`, used **only** in this one fallback branch, so
   1–2 department Setups keep naming exactly as before. Example: a Weekly,
   Stage 1, Operational Meeting with 3 departments now reads "Weekly BU
   Operational Meeting" instead of "Operational Meeting".
2. **Attendees are no longer mandatory on a Meeting/Committee Setup's
   per-unit editor.** The `unitRules()` check requiring at least one Core
   attendee per unit was removed, and the `req` marker dropped from the
   Attendees `Field`. Chairman and Organizer/Facilitator are still required —
   only the attendee list itself is now optional. Report Templates were
   never affected; they never had this rule.
3. **Daily no longer asks for (or requires) a Day of week.** `DOW_FREQ` was
   `['Daily','Twice Weekly','Weekly']`; `'Daily'` is now removed. Matches
   `REPORT-OCCURRENCE-FLOW-PLAN.md` §5 rule 1, which treats Daily as "every
   working day" and never reads `lm_dayoftheweek` for it — the form was
   requiring data nothing downstream ever consumed.
4. **The register's "Updated" column, and the top-bar date pill, now show
   the real current date instead of a frozen seed constant.** `TODAY =
   '2026-07-29'` was being used as the "now" stamp on every lifecycle action
   (`create`/`saveDraft`/`publish`/`approve`/`expire`/`duplicateFrom`) *and*
   directly in the top-bar date span — so any locally-saved-then-edited
   Setup showed "29 Jul 2026" forever, while a Setup freshly opened from
   Dataverse correctly showed its real `modifiedon` (already handled
   correctly in `dataverseReportToSetup()`/`dataverseMeetingToSetup()`,
   untouched). New `nowStamp()` (`new Date().toISOString().slice(0,10)`,
   same `YYYY-MM-DD` shape as `TODAY`) replaces `TODAY` at all six lifecycle
   sites and in the top-bar span. `TODAY` itself is untouched and still used
   for unrelated seeded-data purposes — only the "this represents *now*"
   usages were wrong.
5. **Setup Register pagination.** New `REG_PAGE_SIZE = 20`. Local Setups
   (`db.setups`) and not-yet-opened Dataverse rows render as two different
   row shapes and were already deliberately kept in that order (local
   first) — pagination slices **one combined array** of both
   (`pageItems`), then filters back into `pageLocal`/`pageDv` so the two
   existing render blocks needed no changes, only their source arrays
   swapped. A page can straddle the boundary between the two groups. Any
   filter or search change resets to page 1. The pager itself only renders
   when there are more than 20 results.
6. **Register row separators looked broken, but `border-collapse` was
   already correct — the date column was wrapping onto two lines.** A row's
   shared bottom border sits at the row's full height, and `table.data td`
   is `vertical-align:top` (`theme.css`), so a short single-line cell (the
   Status pill, Ver, Open/Duplicate) in a row whose Updated cell wrapped
   into "18 Aug" / "2026" floated at the top with dead space beneath it,
   before the separator — reading as "the lines aren't lining up" rather
   than what it actually was. Fixed with `.reg-td-date{ white-space:nowrap }`
   in `governance-modern.css`, applied to both Updated-column `<td>`s.

### This session (07 Sep, continued): New Report/Meeting no longer creates a Draft just by being opened

**The bug:** clicking "New Report Template Setup" or "New Committee /
Meeting Setup" immediately pushed a blank record into `db.setups` — and
therefore into `sessionStorage` and the register — before the user typed
anything. `A.create()` did the push directly; the register's `rec =
db.setups.find(...)` lookup needed the row to already exist there for the
wizard to have anything to open, so there was no way to defer it under the
old shape.

**Fixed to match an explicit three-rule spec:** no data → nothing saved; data
entered but not yet Saved as Draft → local storage only (session, not
Dataverse); Saved as Draft → Dataverse too (already how `saveDraft` worked).

- `A.create()` now stores the blank record in a new `pendingNew` state
  (**not** `db.setups`) and opens the wizard on it. `rec` falls back to
  `pendingNew` when `openId` isn't found in `db.setups` yet.
- New `A.promoteDraft(next)` pushes a record into `db.setups` (creating the
  `Draft` audit-log entry) or updates it in place if already there.
- `Wizard`'s `set()` (the one function every field's `onChange` already goes
  through) now calls `A.promoteDraft()` on every change, **but only** for a
  record that didn't exist in `db.setups` when the wizard first mounted
  (`isNewRef`, a `useRef` snapshot taken once — `Wizard` remounts fresh via
  `key={rec.id}` per record, so this is a clean one-time check per editing
  session). Editing an **existing** Setup is completely unaffected — that
  path already only persisted on Save Draft/Publish, never on every
  keystroke, and still does.
- `A.saveDraft()`/`A.publish()` hardened for the one edge case this opens
  up: a user who clicks Save Draft/Publish with **zero** prior field
  changes (record never promoted, so `n.setups.findIndex()` returns `-1`).
  Previously this would have crashed dereferencing an `undefined` `prev`
  inside the audit-diff logic — both now `push()` a fresh row with a plain
  "Created" log entry instead of diffing against nothing.
- `close()` clears `pendingNew` but does **not** remove an already-promoted
  record from `db.setups` — closing after typing something and never
  clicking Save Draft correctly leaves it as a local-only Draft, per the
  spec's second rule.

### This session (07 Sep, continued again): Report Occurrence Generator rebuilt twice more

Both changes are to `REPORT-OCCURRENCE-FLOW-PLAN.md` and its companion
artifact only — **no application code**, this flow is still just a plan, see
§3.

**Rebuild 1 — the department model reversed, one day after it was built.**
The 06 Sep design (above) gave one occurrence several departments via the
new child table. The actual requirement turned out to be the opposite: each
department fills in its **own** report, independently, so it needs its own
occurrence. New design: **Loop CD**, a department/function loop nested
*inside* the existing unit loop — occurrences now number
`Units × DeptFnLines`, not `Units`. A Weekly Template with 2 BUs and 3
department lines creates **6** occurrences on the day it fires, not 2.
Consequences, all in the plan document:
- `lm_Department`/`lm_Function` on the occurrence go back to "this
  iteration's line" (their original, always-correct shape) instead of "the
  first line only".
- The duplicate guard needs a department clause too, or the exact same bug
  the unit clause already guards against reappears one axis over — the
  first department's occurrence looks like it satisfies the check for every
  other department on the same unit and date, and they all silently get
  skipped.
- `lm_name` must include the department — three occurrences per unit per
  date would otherwise be visually identical in the register.
- `lm_reportoccurrencedepartmentfunctions` (registered 06 Sep) has **no job
  left** — flagged as unused-but-not-deleted (Open item 6 in the plan; never
  call `delete-data-source` casually, see §6 below).

**Rebuild 2 — Child Report citations no longer guess an occurrence.** Once
occurrences fan out per department, a child Template can have several
occurrences for the same due date, so the flow's old "find the one
occurrence with this template + this date, Row count 1" auto-match for a
Child Report citation (`lm_reportsectioncitations`, `lm_kind = 11`) is no
longer reliably a single match — it would just grab whichever row Dataverse
happened to return first. Per an explicit decision, the fix does **not**
try to be smarter about picking one:
- `lm_reportsectioncitations` gained **`lm_ChildReportTemplate`** (a lookup,
  assumed target `lm_report_templates`) — set directly from the citation
  item's own `_lm_childreporttemplate_value`, no lookup needed.
- **`lm_CitedReportOccurrence` is never set by the flow at all now, on any
  Type 4 citation, even when there's only one unambiguous candidate** — this
  was an explicit choice (always defer to a person) over the alternative
  (auto-fill when unambiguous, ask when not). The person filling in the
  parent report picks the exact occurrence later, from that Template's own
  list of occurrences.
- This incidentally **removes the ordering problem** the previous version of
  the plan had to work around (parent generated before its child in the
  same run) — since nothing here reaches across to another occurrence
  anymore, generation order stops mattering.
- **`lm_ChildReportTemplate`'s exact logical name and target are unverified
  against live Dataverse.** The user added the column and confirmed its
  table (`lm_reportsectioncitations`) but not its exact logical name; two
  separate attempts this session to refresh that table's cached schema (the
  legacy connector 404'd, the modern connector produced the same empty
  generic stub already documented as a dead end) confirmed **there is
  currently no way to refresh an existing native table's schema in this CLI
  version** — worth remembering next time a column needs confirming on an
  already-registered table, not just a brand-new one. ⚠️ **Corrected 17 Sep
  (later)** — there is a way; see "`pac modelbuilder build` reads an
  already-registered table's real choice values" further down in this
  section. This note's own conclusion was wrong, just not for the columns it
  was checking that day (a lookup's target table, not a choice column's
  values — modelbuilder answers the second, not the first). The plan assumes
  `lm_ChildReportTemplate`, matching the existing column of that exact name
  on `lm_reporttemplatesectionitems` — flagged as Open item 7 in the plan,
  not yet closed.

---

### This session (08 Sep): Review Chain columns wired, Governance Settings rebuilt, and the first cut of the module split

Five separate pieces of work, all built and green. Nothing is committed.

**1. `lm_reporttemplatereviewchains` — the two new per-unit lookups wired.**
Refreshed the table, found `lm_ReportTemplatePerBusinessUnit` and
`lm_ReportTemplatePerRegion`, and moved saving onto them. Six touchpoints: 2 writes,
2 per-unit reads (delete path + hydrate path), 2 group-wide reads. Full detail in §6
— including the group-wide query that had to start null-checking all four lookups,
which would otherwise have deleted every per-unit chain on edit.

**2. Governance Setup — four UI fixes.**
- The filter bar wrapped between a label and its dropdown (STATUS ended up on its
  own line). Each label now travels with its control in a `.fltr-f` box, so it
  reflows correctly at every width, not just the one in the screenshot.
- The section-item picker's KPI Breakdown had **no search at all** — a bare
  `<select>`. It now uses the same searchable `PickList` as the other kinds, with a
  chip showing the chosen KPI. `PickList` itself became a real search field
  (`type="search"`, named placeholder, match count).
- **Duplicate React keys fixed.** KPI names are not unique in the live data (three
  `Test 24-6` rows exist), and the option list was keyed by name, so those rows
  shared identity. Now keyed by name + index.
- The picker's search box inherited the panel's beige ground and read as a caption;
  it is now white, matching the option rows beneath it.

**3. Attendees, and every Position picker, as member rows.**
Ported the People & Roles layout from `leadership-practice.html`. `AttendeeList`
(new, `GovernanceApp.jsx`) replaces the generic `RowEditor` for attendees: avatar,
Position, Core/Supportive as pill toggles, remove. The avatar then moved **inside
`PosSel`**, so all six Position pickers in Setup get it — Chairman, Co-Chairman,
Facilitator, Attendees, Submitting/Owner Position, Review Chain steps and Agenda
owners — rather than the attendee list alone. Initials come from the person holding
the Position, falling back to the Position name. Colour encodes the attendee TYPE
(gold Core, green Supportive), not decoration.

**4. Governance Settings (execution module) rebuilt.**
- Relaid out to match the prototype's Governance Settings tab: gold lede, the
  settings table carrying name/AG/help/OD in one cell, label-value blocks instead of
  nested tables, one full-width column.
- Added `set` to the `full` screen list — the screen was capped at 1380px with a
  quarter of the window empty. `.main.full` already existed; the screen just was
  not opted in.
- **New timing section** at the top: three elapsed-time cards (MOM write-up, MOM
  approval, Audit Grid submission), each naming both ends of its window, with a
  free-hours input rather than the table's 24/48/72 presets.
- **New setting `gridSubmitHours`** with an `OD_NOTES` entry. It has no OD (no open
  item covers the Grid submission window) and ⚠️ **nothing reads it yet** — the
  Audit Grid lifecycle has no submission timer wired to it. No `KEY` bump needed: an
  older localStorage save has no such key, and `undefined` reads as unset.
- The **Values awaiting a business decision** table became cards in the same
  language. No number chip on those — they are not a sequence, so the slot carries
  the AG question the value drives instead.
- ⚠️ **Known duplication:** `momWriteupHours` and `momApprovalHours` now appear
  twice on the screen, as timing cards 01/02 and again in the values grid. They read
  and write the same setting so they cannot disagree, but it is visible. Flagged to
  the product owner; removing the two rows from the grid is a two-line change.

**5. The module split — foundation only (see §9).**
Agreed approach: foundation first, screens one at a time. Done and green:
`src/shared/format.js` (dates, the working calendar, formatting — pure, importable
by either module), `src/shared/ui.jsx` (the presentational primitives),
`src/modules/leadership/store.jsx` (`Ctx` + `use`), and a **screen registry**
inside `LeadershipApp.jsx`. `LeadershipApp.jsx` went 10,115 → ~9,980 lines.

The registry is the part that matters: a tab used to be defined in **four** places
(`NAV`, `NAV_HINT`, the router's screen map, the hardcoded full-width list) and is
now one `SCREENS` entry with all four derived from it. Found `NAV_HINT` was dead —
defined, never read; the hints were kept on the registry entries as the natural home
for them, but nothing renders them.

⚠️ **Screens cannot move to their own files yet.** They still reach into
`LeadershipApp.jsx` for domain and seed values — Settings, the smallest at ~350
lines, needs `OD_NOTES`, `AG_ACTIVE`, `AG_TEMPLATE_VERSION`, `TOPIC_NATURES`,
`TOPIC_CATEGORIES`, `MTG_SETUPS`, `scoreGrid`, `gridTotals` and `occName`. Next
foundation pieces are `domain.js` then `seed.js`; then screens smallest-first:
Settings → Grid → Meetings → Workspace → Calendar → Decisions → Reports → Minutes.
Stopped before `domain.js` deliberately — it is the first extraction that touches
live scoring rather than pure helpers, and deserves its own pass.

**6. Meeting Occurrence Generator plan rebuilt** (§10, same URL). Rewritten to the
Report flow's structure with a 12-step build guide, and **one occurrence per unit,
not per department** — 2 BUs covering 10 departments give 2 occurrences, with
`lm_Department` left empty. Three schema findings drove it, all in §6: the Meeting
option-set codes are 124330000-based where the Report ones are 1-based; the
roll-forward rule **reverses** (meetings move off a weekend, reports keep the date,
so the duplicate guard must query the booked date); and five of nine frequencies
cannot fire. No companion `.md` was written — the artifact is the only copy.

---

### 09-12 Sep: responsiveness, the Meeting cadence columns, the Setup Activity trail, a version-bump bug, incremental child saves, the Artifact group — and two infrastructure incidents

Long stretch. Everything below is built and green, and **committed** — in
`019d7b6` ("Add the report part") and `4d4b9c5` ("Edit the UI"), both pushed to
`origin/leadership-practice`.

**1. Whole-app responsiveness (09 Sep).** Breakpoints at 1024 / 860 / 760 / 560 on
top of the existing ones, plus a `(hover:none) and (pointer:coarse)` block that
grows controls only — table rows are deliberately left dense. Four real bugs
found, all in §8 or below:
- ⚠️ **The minifier was emitting `@media (width<=760px)`**, modern range syntax
  Safari did not support until 16.4. An iPad on iPadOS 15/16.0 would have
  ignored **every** responsive rule, old and new. Fixed by pinning
  `build.cssTarget:'chrome61'` in `vite.config.js` — syntax only, no rule
  changes. Verified in the built bundle before and after.
- **The Leadership sidebar never actually went horizontal.** The ≤760 block
  turns `.side` into a strip, but `.lp-side` sets `flex-direction:column` at
  equal specificity and later in the file, so column won — the nav rendered as
  a full-width vertical stack pushing the app below the fold. It is now filled
  pills, matching what the Governance module already did correctly.
- **Tables squeezed instead of scrolling.** `table.data` is `width:100%`, so it
  shrank rather than overflowing and the `overflow-x:auto` never engaged;
  combined with an `overflow-wrap:anywhere` I had added, titles broke one
  letter per line. Fixed with a `min-width:580px` floor below 760px and
  `break-word` instead of `anywhere`.
- The same `anywhere` rule existed in the Governance Lists viewer at a
  specificity the theme rule could not reach; turned off at that breakpoint.

**2. `lm_meetingtemplates` — three cadence columns added and wired (09 Sep).**
`lm_seconddayoftheweek`, `lm_seconddayofthemonth`, `lm_monthofthesemesterseme`.
Round-trip wired through `dataverse.js` (two new key maps, the write, both
JSDoc blocks, the read select, two exported decodes) and `GovernanceApp.jsx`
(payload + hydrate). **The form was already collecting these** — `CadenceFields`
is shared by both wizards — so they were being dropped silently on save; this
fixed a loss rather than adding a field. Seven of nine frequencies now fire.
See §6 for the numbering trap, which is worse than the Report side's.

⚠️ **Annual still cannot be generated.** There is no month-of-year column on
`lm_meetingtemplates`; `lm_month` exists on `lm_report_templates` only. Rather
than collect a value with nowhere to go, `CadenceFields` takes a `noMonth` prop
from the Meeting wizard and shows a note in place of the Month dropdown.

**3. Meeting Occurrence flow plan rebuilt twice (09 Sep).** §10, same URL.
First to the Report flow's structure with a per-unit rule; then again once the
three columns landed. ⚠️ **The weekend rule reversed on the product owner's
instruction**: a Meeting due on a weekend day is now **created on that day**
and rescheduled later by its owner, exactly like a Report. The `BookedDate`
roll-forward step is gone and the duplicate guard queries the due date. The
plan is 11 steps, and says so explicitly in case anyone built from the earlier
version.

**4. `lm_setupactivity` registered and wired (10 Sep).** The table I specified
was created exactly as spec'd, caps included. `dataverse.js` gained
`logSetupActivity` / `logSetupActivityBatch` / `fetchSetupActivity`; the
Activity tab on Setup Detail now reads live rows and replaces the seeded ones
when the Setup has a `_dataverseId`. Detail in §6.

**5. ⚠️ The version number never increased — found and fixed (10 Sep).**
I first reported this as working after reading `publish` in isolation. It was
not. `A.edit()` flips an approved Setup to Under Review **the moment the editor
opens**, so by the time `publish` asked "is this Setup approved?" the answer was
always no. The version rose 0→1 on first publish and then never again; the bump
branch was unreachable. Fixed with a module-level `REVISING` map recording the
version an edit started from, consumed by `publish` through a shared
`nextVersionFor()` — which the Publish preview modal now also uses, since it
had its own copy of the same broken logic and was under-promising identically.
Kept off the Setup object deliberately: the edit form rebuilds its state and
writes the whole object back, so a marker stored on the record could be lost.

**6. Child rows are reconciled, not deleted and recreated (10 Sep).** On the
product owner's instruction: adding one Business Unit or Attendee must not
rewrite the others. A shared `reconcileRows()` diffs by a stable key — the BU
or Region lookup for units, the Position within its unit for attendees, the
step number within its unit for review chain steps. Rows on both sides are
kept and only patched when a field actually differs, so an unrelated edit no
longer bumps every row's `modifiedon`. Flat template-level lists (agenda,
lines, KPIs, Processes, checklist, section items) still delete-and-recreate —
nothing references their ids and they have no stable natural key.

⚠️ Two consequences worth knowing: attendee **type** is not diffed (the create
path hardcodes Core), and a **cleared lookup still will not clear**, because
Dataverse does not clear a lookup through a plain PATCH value. Previously the
row was deleted and rebuilt, which cleared it as a side effect — so this change
makes that limitation more visible, not new.

**7. Governance Settings merged into one list (10 Sep).** The three timing
cards and the eight "Values awaiting a business decision" rows became **nine
cards, each setting appearing exactly once** — MOM write-up and MOM approval
had been in both sections with two different controls for the same value. One
card component renders whichever parts a setting has: the from→to strip for
the three elapsed periods, the open question and effect for all, then a free
numeric input or choice pills. `TimingCard`, `ValueCard`, `TIMING_PERIODS`,
`NUM`, `CHOICE` and `.ph-sec` were all removed rather than left orphaned.

**8. Ad Hoc pickers list approved Setups only, with search (10 Sep).** Both
modals had been offering every Setup — Draft, Under Review and Expired — while
the Meeting one's own label said "Approved Setup". `setupIsApproved` decides it
the same way the rest of the app does, so a blank or unrecognised status still
reads as approved (rows predating the status column are genuinely in use).

**9. Search on the Meetings and Reports registers (10 Sep)** — matching every
column the table shows, including the date in raw and displayed form, terms
AND-ed rather than treated as a phrase. It composes with the tab and type
filters; Reset filters clears it.

⚠️ **This shipped a crash — React error #310** — because both `useState` calls
landed *after* the screens' early returns, so opening any meeting or report
rendered fewer hooks. Fixed by hoisting the state and replacing the `useMemo`
with a plain filter (a hook in that position would reintroduce it). See §8:
there is no lint on this machine, so a scan script is the only guard.

**10. Setup Register row separators aligned (10 Sep).** `.reg-actions` had
`display:flex` on a `<td>`, which takes a cell out of the table's row-height
sharing — its `border-bottom` painted at its own content height, so the line
under Open/Duplicate sat above the rest of the row wherever a name wrapped.

**11. Console noise removed (11 Sep).** 22 of 27 `console.log` calls gone: all
17 `[dataverse] fetchX() returned N row(s)` (which also dumped the whole array
every load) and 5 routine success confirmations. **Kept deliberately:** every
`console.warn`, because user-facing toasts say "Check the console for details",
and the four `[Excel]` logs, which are the file-reader proof of concept's only
output.

**12. New `Artifact` nav group, three screens (11 Sep).** Ported from the
"Read" group of `Leadership Practice Extension.html`: **Business intelligence**
(find the BI report behind a measure), **Reports / Plans** and **Reporting
hierarchy**. Built on this app's own data rather than importing the
prototype's parallel seed model — BI reports from `BI_REPORTS`, reports from
`db.reports`, and hierarchy children **derived from real `RPT:` paragraph
citations**. Reports / Plans was rebuilt once to the prototype's actual shape:
a rail of reports beside one open report shown as a stack of paragraphs, each
carrying its author, process, diagnostic angle and citations, with both of the
prototype's concept notes.

⚠️ **I invented CSS class names again** here (`.vis`, `.vis-h`, `.t-name` are
prototype-only) and caught it before shipping. Second occurrence this month —
see §8.

**13. The first screens moved into their own files (11 Sep).** The domain had
to move first: the three screens reached into `KPI_CAT`, `PROC_REG`,
`CiteCard`, `rptCfg` and a dozen more, and importing those back from
`LeadershipApp.jsx` would have created a circular import that ESM tolerates
only because the bindings are read at render time. So `domain.jsx` was created
by **moving** 26 symbols, with LeadershipApp importing them back. See §1 and §9.

⚠️ **The move shipped broken and I reported it as clean** (found 12 Sep, from a
`BIEmbed is not defined` crash in the deployed app). `CiteCard` moved, but nine
of the things it reaches for did not: `BIEmbed`, `ST`, `PME`, `ISS`, `rptName`
stayed in LeadershipApp.jsx, and `Bar`, `TODAY`, `fmtDS`, `fmtP` were never
imported from `shared/`. In an ES module each of those is a free identifier —
**a ReferenceError at render, and not a build error**, so `npm run build` stayed
green the whole time. Fixed by moving the Strategy / Planning-&-Monitoring /
Issues catalogues and their accessors, `rptName` and `BIEmbed` into
`domain.jsx` as well (36 exported symbols now), and adding the four `shared/`
imports. §8 has the scan script that would have caught it.

**14. Power BI embedding — settled, negatively (11 Sep).** See §8. Worth
reading before anyone tries again: the answer is not more URL tweaking, a
library, or a login step.

**18. The Meeting flow's first live run failed, and the guide was the cause
(13 Sep).** Dataverse returned `400 / 0x80060888 — Bad Request - Error in query
syntax` from a List rows action. Three separate defects in the flow guide could
each produce it, all now fixed in the artifact (§10):

- **Two OData strings were printed across several lines** for readability — the
  step 5 `Select columns` and the step 10 duplicate guard. Pasted with the line
  breaks intact, Dataverse rejects them. Both are now single lines with a
  standing warning at the top of the build section.
- **The weekend-rule box named the wrong Compose.** It said "there is no
  `DueDate` step" when it meant `BookedDate`, the roll-forward Compose deleted on
  09 Sep. Anyone following it literally deletes `DueDate` — which steps 7 to 12
  all read — leaving every later expression null and the guard filter ending in a
  bare `eq`.
- **The Region branch left a literal `…` placeholder** where
  `_lm_region_value eq @{outputs('UnitId')}` belongs.

⚠️ Also corrected in the same pass, and this one was silently wrong rather than
loud: the guard used `lm_date eq`. `lm_date` is typed **DateTime**, so `eq`
against a bare `yyyy-MM-dd` compares midnight to a date, matches nothing, and the
guard passes on every run — re-creating the same meetings weekly without ever
erroring. It now uses the half-open range `ge` / `lt`.

**Occurrence names now carry the unit** — on the product owner's instruction. The
name ends with the Business Unit, or the Region, or for a group-wide meeting the
stage (`Group Functional` / `Top Management`). Until now one Setup firing on one
date produced several occurrences that were indistinguishable in every list in
the app. Neither name costs a lookup — see §6.

**Stage 3/4 meetings are generated at all, for the first time.** This was open
item #4 on the flow plan: a group-wide Setup has no unit rows, so both unit lists
come back empty, the unit loop never runs, and nothing was created — silently.
The decision taken, which the naming request forced: **one occurrence, both
lookups null**, chair and facilitator from the Setup's parent row, named by its
stage. It is step 12 of the guide. ⚠️ It carries **no attendees** —
`lm_meetingattendeeslists` can only hang off a per-unit row, so there is nothing
for an attendee to point at. Giving these meetings a roster needs a Setup-level
lookup on that table.

**19. `lm_meetingoccurrencedepartmentfunction` registered, and the departments
finally have somewhere to go (13 Sep).** Registered with
`pac code add-data-source -a dataverse -t lm_meetingoccurrencedepartmentfunction`
— entity set `lm_meetingoccurrencedepartmentfunctions`. Columns: `lm_name`
(**required**, 850), `lm_Department`, `lm_Function`, `lm_MeetingOccurrence`, plus
read-only `lm_departmentname` / `lm_functionname` / `lm_meetingoccurrencename`.

This settles a question the Meeting flow plan had been answering with "nowhere".
`lm_meetingoccurrences` has a single `lm_Department` lookup, which can hold one
department but not ten, so the plan said to leave it empty and keep the
Department/Function lines on the Setup. Now they are copied onto the occurrence
as **child rows** — ten departments means one occurrence and ten rows.

⚠️ **This does not reintroduce the fan-out, and the distinction matters.** The
rule is unchanged: **one occurrence per unit**, never one per department. Two BUs
covering ten departments still produce **two** occurrences, each now carrying ten
Department/Function rows. The child rows *describe* who is in the room; they do
not multiply the meeting. The Report side has the same table shape
(`lm_reportoccurrencedepartmentfunctions`) for the opposite reason — there each
department really does file its own report, so there it drives a fan-out.

The flow guide gained **Loop F**, a third sibling of D and E, plus a `DeptLines`
List rows in step 6 (the lines hang off the Setup, not a unit, so they are listed
once and reused by every branch — including the group-wide one).

⚠️ Two traps recorded while writing it: the **Function lookup binds to
`hr_functions`**, not an `lm_` table — I wrote `/lm_functions(...)` first and
caught it by checking `power.config.json` — and a line may carry a Department, a
Function, or both, so each lookup needs its own non-empty Condition while
`lm_name` (required) has to be built from whichever names are present.

⚠️ **The app does not read these rows yet.** Meeting Detail still shows the single
`lm_Department` lookup, which this flow deliberately leaves empty — so a
generated meeting currently displays no department at all. Same state as
`lm_reportoccurrencedepartmentfunctions`, registered 06 Sep and also never wired.
See §9.

**17. Reporting hierarchy rebuilt to the prototype's layout (12 Sep).** It was
an indented list; it is now the prototype's centred top-down org chart -- the
`.org-tree` ul/li rule where each connector is a pair of `::before`/`::after`
borders, so the tree reflows with its boxes and needs no measuring pass. With
it came the three-field filter (name / type / department), click-to-focus that
dims everything outside the focused report's ancestors and descendants, and the
detail modal listing the report's sections and the BI reports it ultimately
rests on. A child is still derived from real citations -- a `RPT:` reference, or
a `PAR:` reference resolved to its owning report -- never declared.

Two deliberate departures from the prototype: a repeated node (the same report
reached by two paths) renders as a dashed "already shown higher up" marker
rather than being dropped silently, because hiding it makes the tree read as
smaller than it is; and the prototype's `--gold-dark` is `#A5845B`, which is
this theme's `--teal` to the digit, so the palette ports across unchanged
despite the token names disagreeing.

**16. Side-rail key/value rows stack instead of squeezing (12 Sep).** A rail is
a fixed 300px grid column. Both row components in it laid the label beside the
value, which left the value roughly 66px: a meeting name wrapped one word per
line and `Scheduled` broke as `Schedule` / `d`. Both now put the label above
the value -- the shape `.lp-produced-row` in the same rail already used. For
`.wa-mo-r` this is a `txt` modifier applied to the 32 rows whose value is text,
identified by the inline `fontFamily:'inherit'` each of them already carried to
undo the class's monospace; the 21 rows holding a count, id or version keep the
side-by-side shape, which suits them. The 32 inline style objects are gone.

**15. Two infrastructure incidents (12 Sep)** — the `pac` push timeout and
OneDrive destroying two source files. Both in §8; the second one cost a
recovery and is the strongest argument yet for moving the repo out of OneDrive.

### This session (14 Sep): Governance Settings screen removed from the execution module

Per an explicit ask, with the scope deliberately narrowed after a clarifying
question: remove the nav tab and the screen's own editing UI, but **leave
`DEFAULT_SETTINGS`/`OD_NOTES` and every place that reads them untouched**, so
AG-05/AG-16 Audit Grid scoring keeps working exactly as before — the nine
values just become fixed at whatever they last held, with no UI left to
change them.

**Removed as one contiguous block** (`LeadershipApp.jsx`, the whole
"8 · GOVERNANCE SETTINGS" section): `AuthorityMatrixPanel`, `GOV_SETTINGS`,
`UNIT_WORD`, `GovSettingCard`, `ScreenSettings` — none had a caller outside
that section. Also removed: the `set` entry in the `SCREENS` registry (which
alone drove the nav item, the router, and the wide-screen list, per the
registry's own design — see §5's 08 Sep entry), the now-unused `Settings2`
icon import, the `A.setSetting` action (its only callers were inside the
deleted `GovSettingCard`), and the "Governance Settings" row in the My
Workspace "Where things live" shortcut table (with its subtitle corrected
from "Six places" to "Five").

⚠️ **This also removed the live Authority Matrix / Approval Cycles read-only
viewer**, since `AuthorityMatrixPanel` was embedded only on this screen (per
§4's own description: "embedded in Governance Settings") and had no other
caller. That is more than pure "settings editing," flagged to the user before
proceeding; the call was to go ahead. If Authority Matrix visibility turns
out to still be wanted somewhere, it needs a new home — the component itself
is gone, not just its placement.

One dangling reference was caught and fixed, not just the obvious ones:
`ScreenMeetings`' attendance panel had a note reading "…unresolved — change
the treatment in Governance Settings," pointing at a screen that no longer
exists. Reworded to drop the dead pointer; the OD-20 reference itself stays,
since `OD`/`OD_NOTES` are untouched.

**Verified clean, not just build-clean** — per §8's own warning that a
removed symbol is a runtime `ReferenceError`, not a build failure, in an ES
module: grepped the whole `src/` tree for every removed symbol name after the
build passed. The only hits left are in `LeadershipApp-Nourhane.jsx`, the
stray untracked OneDrive-conflict copy already flagged as dead in §9 — no
reference survives in the file that actually ships.

### This session (15 Sep): sidebar reorg, new table registered, Completion
### Periods wired end to end, Calendar/Workspace restyled to match the
### prototype, git repository repaired and pushed

Six distinct pieces of work, in the order they happened. `64af9cc` on
`leadership-practice` carries the first three; everything after Completion
Periods is uncommitted as of this entry.

**1. `lm_meetingoccurrencelinkedreports` registered.** New table (see §4);
plural entity set (`lm_meetingoccurrencelinkedreportses`) worked on the first
try where the singular form 404'd — same "guess singular then plural"
convention as every other table here. Registered and inspected only; nothing
in the app reads it yet.

**2. Sidebar reorganised.** `SCREENS` in `LeadershipApp.jsx` regrouped into
**Start here** (My Workspace, Calendar), **Meetings** (Meeting & Committees,
Meeting Minutes, Committee Score), **Governance** (Decisions, on its own), and
**Artifact** (Reports/Plan, Business intelligence, Reporting hierarchy) — per
an explicit ask to match the sidebar shape in `Leadership Practice
Extension.html`. The old "Reports & Plans" (Execution) composer entry was
removed from the visible nav, but **not deleted** — 14+ call sites still do
`go('rpt', id)` and the destination screen (`ScreenOrgReports`) cannot accept
an externally-supplied selection, so it stays registered with a new
`hidden:true` flag. `SCREENS` remains the single source of truth for routing
(`SCREEN_BY_ID`, built from the full array); a new `VISIBLE_SCREENS` filter
(drops `hidden` entries) feeds `NAV`, which is what the sidebar actually
renders. **Retrofitting `OrgReports.jsx` to accept a selection so the hidden
entry can be retired properly is still open — not done, only made possible.**

**3. Power BI viewer button relabelled.** Per a repeated ask to "connect
Power BI" — already fully solved and shipped (§8: iframe embedding is
CSP-blocked, `window.open` is the only working path, and `BusinessIntelligence.jsx`
already did exactly that). The only real gap was the button's own wording;
renamed "Open report viewer" → **"Open full report ↗"** in the three places
it appears (the button itself and two explanatory notes naming it).

**4. Completion Periods wired to Dataverse.** The Meeting Setup wizard's
"Completion Periods" card (MOM Write-up / MOM Approval / Audit Grid
Completion-Submission, three "Enter hours" fields) already existed as
UI-only. Given the exact column names by the user (`pac` cannot refresh an
already-registered table's schema — confirmed dead end again on this table
too, both connectors, see §6), wired end to end: `dataverse.js`
(`meetingTemplateParentPayload()`, `fetchMeetingTemplateDetail()` select,
JSDoc) and `GovernanceApp.jsx` (`dataverseMeetingToSetup()` hydrate,
`buildMeetingTemplatePayload()`, the publish-confirmation diff, the `TRACKED`
audit-log array). The card's "UI only, for now" disclaimer was removed and
replaced with an accurate one: values persist now, but AG-16/AG-05 scoring
still reads the global Governance Settings defaults until that's wired
separately (§9) — deliberately left open, since whether a per-Setup value
should *override* or *replace* the global default is still an unanswered
design question.

**5. Calendar and My Workspace restyled to match `leadership-practice
(2).html`**, screen by screen, per several separate asks comparing screenshots
against that file. Calendar: today's cell is now a soft gold tint with a
circular gold-gradient day-number badge (was a teal inset ring); the
Month/Week/List toggle's active pill is gold-filled (new `.seg-gold`
modifier, scoped to this screen); Meeting/Report event colours across the
grid, filter chips, legend and list/week tags switched from blue/dark-grey to
**green (Meetings) / gold (Reports)** — `CAL_KINDS`, `calTagColour`,
`CAL_DOT`, and a new `CAL_CHIP_STYLE` lookup replaced a fragile
`` `var(--${colour}-bg)` `` string-interpolation that only worked for
variable names following one naming pattern; the "This Week's Meetings" /
"Upcoming Deadlines" rail switched from filled date tiles to flat ones (new
`.wa-date.plain` modifier) with the day number itself carrying colour
(green if today / gold for a Report deadline / purple for a MOM deadline).
"This Week's Meetings" was also changed to filter from **today**, not from
Sunday — it no longer shows a day already past earlier in the same week.
My Workspace: each stat card's top accent bar now matches its own semantic
colour (new `--stat-accent` CSS variable on the shared `Stat` component,
falling back to the gold gradient when no colour is set — this reaches every
other screen's stat row too, not just Workspace, since they share the same
component) instead of a fixed gold bar on all four; Work Queue rows gained a
left priority-colour bar (new `.wq-priority` classes, red/amber/green); the
Work Queue's Area tag now gives **every area its own colour**
(`AREA_C`: Report=gold, Meeting=green, Minutes=blue, Audit Grid=purple,
Decision=amber, Task=grey — Report/Meeting deliberately match the Calendar's
new gold/green split) instead of Meeting and Minutes sharing one colour by
accident; the Upcoming card's date tiles went flat (same `.wa-date.plain`)
with a gold time pill; the This Month list gained row dividers (new
`.wa-mo-r.divider` modifier — **not** applied to the base `.wa-mo-r` class,
which is reused across a few dozen record-detail rails elsewhere and was
deliberately left alone). The Work Queue icon changed from a 📋 emoji to a
real `ClipboardCheck` icon (lucide-react, already a project dependency) to
match the reference's icon treatment; other unrelated 📋 usages elsewhere in
the file were left as emoji. Several purely-decorative `<Note k="info">`
call-outs were removed at the user's request across both Calendar and the
Meeting Setup wizard (Completion Periods disclaimer, "No clock time, no venue
here," "A Stage 3 or Stage 4 Setup covers the whole group," "No Department at
Stage 4," "Every Setup here repeats on a cadence," and the Calendar's
"N occurrences read from…" banner) — genuine warnings (`dvError`) were kept.

⚠️ **Deliberately not replicated from the reference file**, since both would
be new features, not styling: the reference's "Executive Calendar —
Multi-Committee Overlay" checkbox panel (no committee-overlay concept exists
in this app's data model), and its "Decisions" / "MOM Due" calendar filter
chips (the Calendar's own data feed only ever produces Meeting/Report items —
MOM Due was deliberately removed from it before this session, per the
comment already in the code; re-adding it means sourcing Decision deadlines
and MOM due-dates into the calendar feed, which nobody has asked for).

**6. Git repository repaired** — see §8 for the incident. Once fixed, the
work backing items 1–3 above was committed as `64af9cc "Register
lm_meetingoccurrencelinkedreports, sidebar reorg, BI viewer label"` and
pushed to `origin/leadership-practice`.

---

### This session (16 Sep): split into two Code Apps, then unpinned from their environment

**1. The repo now builds two separate Code Apps.** Asked for so Governance
Setup and Leadership Execution can be uploaded and used independently. The
modules turned out to have **zero cross-imports** — `src/App.jsx` was a ten-line
switcher and the only thing joining them — so this was a build-and-deploy job,
not an untangling one.

Only `dataverse.js` actually imported `src/generated`; the two app modules
merely mentioned the word in prose. So **nothing in `src/` had to move**: 19k
lines of module code, every screen file, `domain.jsx` and `shared/` kept their
import paths. Each app got a thin root instead. The 157 renames in that commit
are `.power/` and `src/generated/` relocating into `apps/governance/`.

Three edits were needed: `dataverse.js`'s 42 imports moved to a `@generated`
alias (each app's `vite.config.js` points it at that app's own SDK copy); both
sidebars' "Modules" switch button now renders only when an `onSwitch` handler
is passed, so it is absent in the split apps; and the root `App.jsx`,
`main.jsx`, `index.html` and `vite.config.js` were deleted.

Verified by grepping the built bundles, not assumed: "Reporting hierarchy",
"Work Queue" and "Committee Score" appear **0 times** in the governance bundle,
"Expected Content Checklist" 0 times in the execution one. The split shows in
the size — 817 kB combined became **426 kB** and **615 kB** (the latter carries
`xlsx`).

⚠️ One self-inflicted bug worth the warning: an explanatory comment I wrote in
`dataverse.js` contained `apps/*/vite.config.js`, and the `*/` **closed the
block comment early**. The build caught it, but it is an easy one to repeat
when documenting paths inside a comment.

**2. Cross-environment Dataverse — the app no longer has to live where its data
lives.** The real requirement behind the split: host the apps in a different
environment while reading and writing **DT New**. This is not possible with the
generated per-table services, and §6 now records the whole mechanism. What
matters at this level:

- The method came from a Digital Transformation developer reference
  ("Writing to Dataverse Tables in a Different Environment from a Power Apps
  Code App") plus its cheat sheet.
- `src/services/xenv.js` wraps the connector's `*WithOrganization` operations
  in the **same five-method shape** the per-table services expose, so
  `dataverse.js`'s 42 services became `dvTable('<entity set>')` and **all ~132
  call sites are unchanged** — 75 `getAll`, 29 `create`, 26 `update`, 2 `get`,
  plus two delete helpers that pass a service around as a value.
- The entity set names were read out of each generated service's own
  `dataSourceName` constant rather than hand-typed. The imports sit in **five
  groups** next to the code that uses them, so each was replaced in place.

⚠️ **Still unproven at the time of writing: whether `create` returns the new
row's id.** See §6 — this is the one thing that could force a rethink, and
`window.__xenvSmokeTest()` exists to answer it.

**3. Deployment state.** The Execution app was pushed to DT New and carries
appId `0f077a0a-fd52-4e57-900c-b7607ea30505`. Governance keeps the original
`7caa2fb2…`. A **trial** Governance app was pushed to the *Amr Space*
environment (`ce6c79ed…`, appId `e78a0887…`) to test cross-environment data —
its config drops the 45 `databaseReferences` entirely, since nothing reads them
once everything goes through the connector, and in Amr Space they would name
tables that do not exist.

⚠️ That trial went out bound to the wrong connection — see the 17 Sep entry
below; it is superseded, not fixed.

~~The originally requested environment, "Code App Development", is not reachable
from this account.~~ **Wrong — corrected 17 Sep, see below.** It was reachable all
along; it is only missing from the environment *lists*, and selecting it by ID
searches those lists.

### This session (16-17 Sep): both apps deployed to Code App Development, reading DT New

**1. Both apps are live in Code App Development, with DT New as their data.**
This is the arrangement the cross-environment work was for.

| App | Hosted in | appId | Data |
|---|---|---|---|
| Governance Setup | Code App Development (`cd78a59b…`) | `4912152c-b5c8-4beb-bb74-c9f43550405b` | DT New |
| Leadership Execution | Code App Development (`cd78a59b…`) | `83db0ef8-4c62-4eef-84ac-dadab326b704` | DT New |

Each is bound to the `shared_commondataserviceforapps` connection **that belongs
to Code App Development** (`c83ec8ccf8a74ee1b8be81f4dfcb3ecf`), declares **no
`databaseReferences` at all**, and was verified before pushing to (a) look up the
data source name its bundle expects, `commondataserviceforapps`, and (b) carry
`https://org319b4ea9.crm4.dynamics.com` as its only data target. Both were built
from the current source, so Governance includes the floating-dropdown fix below.

⚠️ **Nothing has been confirmed from the running apps yet** — screens reading DT
New data, or `window.__xenvSmokeTest()` returning an id. Until the smoke test says
`ID RETURNED`, treat any record created from these deployments as needing a
check in DT New itself (§6).

**2. Code App Development was reachable all along.** The 16 Sep entry above said
it was not, and guessed at a different tenant, a missing role or a mistyped id.
None of those were true. The account is **Admin** there and exists as a Dataverse
user in it, and the id given was correct. What actually happens:

- `pac env list` **and** `pac admin list` both omit it — the admin list omits it
  even while listing the account's other Developer environments beside it.
- `pac env select --environment <ID>` resolves the id **by searching those same
  lists**, so it fails with "No Dataverse organization was found".
- `pac env select --environment https://org998df960.crm4.dynamics.com/` connects
  **directly** and succeeds; `pac org who` then reports the expected
  environment id.

Most likely a recently created environment that the listing services have not
picked up; that could not be proven from here. **Use the URL, never the id, for
this environment** until it appears in `pac env list`. See §8.

**3. Leadership Execution also went to Amr Space, correctly this time.** Once a
`shared_commondataserviceforapps` connection existed in Amr Space
(`9787e3c968c04f9ca5768a785e64bf0b`), the Execution app was pushed there bound to
it — appId `936f78d8-c3b2-4bb4-b8c0-450e71553a07`. The earlier Governance trial
in Amr Space (`e78a0887…`) is still bound to a **DT New** connection and was never
re-pushed. With both apps now in Code App Development, **both Amr Space copies are
redundant** and can be deleted.

**4. Governance Setup's dropdown lists now overlay the page.** The Position
picker and the searchable multi-select (Related KPIs / Processes) drew their list
`position:absolute; z-index:20` inside the field. A later panel with its own
stacking context painted over it, and any ancestor with `overflow` set clipped it
— including the phone rule that puts `overflow-x:auto` on every card, which no
z-index can beat. A new shared `FloatingList` renders the list through a portal
into `<body>`, `position:fixed` from the field's on-screen rectangle, re-placed on
any scroll (captured) or resize. It opens upward when there is more room above,
is at least 280px wide and at most 360px tall (was 220px), stays inside the
viewport, and sits at `z-index:150` — above modals (100), below toasts (200).
Because the list is no longer inside the field in the DOM, each picker's
outside-click check now tests the list's own ref too. The portal wrapper carries
`gov-root`, which only defines CSS variables, so the scoped `.gov-root .combo-*`
styles still apply. The register's "⋯" `RowMenu` still uses the old pattern and
would need the same change if it is ever clipped.

**5. The auth profile changed underneath this session.** The named `andalusiaEnv`
profile was replaced by a single unnamed profile of type **OperatingSystem**
(Windows sign-in) — not by anything run here. It works; a device-code sign-in
started as a fallback expired unused and created nothing. That fresh profile
still listed the same 12 environments, which is how token staleness was ruled out
as the reason Code App Development was missing.

### This session (17 Sep, continued): approvals that did not save, two save races, and Reports / Plans on live data

**1. "Approving a report doesn't save to the database" — three defects together.**
- **The Setup never got its Dataverse id.** Through the connector,
  `CreateRecordWithOrganization` is typed `void`, so `idOrThrow()` had nothing to
  read, and a published Setup never received `_dataverseId`.
- **Approve skipped silently without one.** `approve` wrote only
  `if (rec._dataverseId)`, with no `else` and no message. Local **expire** had the
  same gap and also refreshed the register on failure without reporting it.
- **Approve never re-read the register**, so even a successful write kept showing
  "Under Review".

Fixed: `dvTable(entitySet, pkField)` now **generates the primary key GUID in the
app and sends it with the row** (Dataverse accepts a client-supplied key on
create), for the **28 tables `dataverse.js` creates rows in**. Each key was read
from that table's generated `create()` signature. The id is therefore known
whatever the response carries; `_idSource` records which it was. Approve and
Expire now say when they cannot save, and refresh the register when they can.
`smokeTestCreate()` now **reads the row back under that id**, because "an id came
back" proves nothing once the app supplies it.

**2. Save/approve timing — fixed, and tested outside the app.** Saving a Setup to
Dataverse runs in the background, and its id arrives only after the parent row
**and every child row** are written. Found and fixed:
- **Approving before a new Setup's create finished** wrote nothing.
- **Approving while an edit's update was in flight** let the update write "Under
  Review" back over the approval.
- **Save as Draft, then Publish, in quick succession** created a *second*
  template: Publish saw no id yet. That left an orphan Draft, and Approve updated
  only the copy.
- **`flushActivity()` drained the activity queue before checking it had an id**,
  so an early approve silently threw away the queued trail, publish entries
  included.

A module-level `PENDING_DV_WRITE` map tracks every template write per **local**
Setup id, chaining writes for the same Setup (`trackWrite`, `settledDataverseId`).
One shared `writeStatusToDataverse()` makes Approve and Expire wait for every
pending write, then write against the id it produced. `writeTemplateToDataverse()`
waits for an in-flight create before choosing between create and update. An
`afterWait` flag stops a failed create's retry from waiting on itself, which
would otherwise deadlock.

Verified by running the **real** registry and create-vs-update code from the
file in Node against a fake Dataverse with 200–300ms delays:

| Sequence | Result |
|---|---|
| Publish, approve 50ms later | approve waits, status lands on the new row |
| Save Draft → Publish → Approve, 60ms apart | **one** row; Publish updates it; approval last |
| Draft create **fails** → Publish → Approve | Publish creates cleanly, no hang; approval lands |
| Edit an approved Setup, approve 20ms later | approval lands **after** the edit |

⚠️ Not yet confirmed against real Dataverse latency from a running app.

**3. The Report Occurrence flow's citation step failed with `BadRequest`.**
Every empty lookup still sent a bind path with nothing inside the brackets
(`/lm_processes()`, `/lm_report_templates()`), which Dataverse rejects. The
fix is one Compose per lookup, returning `null` when the id is empty, so the
field is left out of the request:
`if(empty(<id>), null, concat('/<entity set>(', <id>, ')'))`. If a connector
version rejects `null` in a lookup, `''` is the fallback.

⚠️ **The flow plan named six things wrongly**, and each fails even with a valid
id. Found three at first; a later run failed with `ODataUnrecognizedPathException
… segment 'lm_reportoccurrencesections'`, and checking **every** bind path and id
field in the plan against `power.config.json` and the schemas found the rest:

| Where | Plan said | Correct |
|---|---|---|
| Citation → `lm_KPI` | `/lm_kpis(…)` | **`/strategy_kpises(…)`** |
| Citation → `lm_Process` | `/lm_processes(…)` | **`/strategy_processes(…)`** |
| Citation → `lm_CitedSection` | `/lm_reportoccurrencesections(…)` | **`/lm_reportoccurrencesectionses(…)`** |
| New section's id, read from `NewSec` | `body/lm_reportoccurrencesectionid` | **`body/lm_reportoccurrencesectionsid`** |
| Occurrence → `lm_CreatorPosition` | `/positions(…)` | **`/cr603_organizationstructures(…)`** |
| Occurrence, Region branch → `lm_Region` | `/lm_regions(…)` | **`/crd04_regionses(…)`** |

Everything else in the plan was confirmed correct: `businessunits`,
`cr603_chklst_departmentses`, `hr_functions`, `lm_report_templates`,
`lm_reportoccurrences`, `lm_reporttemplatecontentchecklists`, `lm_reportoccurrenceid`.

The first two are confirmed by the app's own working writes (`dataverse.js`
binds `strategy_kpises` / `strategy_processes`), the third by `power.config.json`.
**`REPORT-OCCURRENCE-FLOW-PLAN.md` is corrected** — all six, with a note at the top
listing them and the empty-lookup Compose pattern. **Its artifact is not** — see §9.
The run that surfaced this also had **Cited Section empty**. That was first put
down to the section step not being named `NewSec`; **that was wrong**. The cause
is the id field above: the plan read `lm_reportoccurrencesectionid`, which does
not exist, so the value was always empty whatever the step was called. Silencing
it with a Compose would have saved citations attached to no section.

**4. All 42 adapter table names checked against real entity sets.** A generated
service's `dataSourceName` is the entity set name, and 41 of 42 appear in
`power.config.json`'s `entitySetName`. The 42nd, `wlog_decisions`, is registered
through the legacy connector and genuinely is its entity set.

**5. The visible Reports / Plans tab reads live data.** `ScreenOrgReports`
(`screens/OrgReports.jsx`) previously read seeded `db.reports`/`db.paragraphs`.
It now reads `dvReportOccs` from context, and on opening the tab calls a new
`fetchReportOccurrenceContent()`, which reads all Sections and all Citations
together. Details:
- **Grouping.** Sections are grouped by `_lm_reportoccurrence_value`. Citations
  are grouped by `_lm_citedsection_value`, following the flow's convention that
  it holds the **parent** section (the table has no other link; see §6).
- **Names.** Display names come from **formatted-value annotations**
  (`_lm_kpi_value@OData.Community.Display.V1.FormattedValue` and so on), which
  the adapter already requests on every list read. No catalogue is needed and
  no second query.
- **Lookups.** Name lookups and the signed-in user's Position ids reach the
  screen through a new context value, `dvLookup` (`bu`, `region`, `pos`, `dept`,
  `rptTpl`, `myPositionIds`). A screen in its own file can't import
  `LeadershipApp`'s module-level tables without a circular import.
- **Tabs** are **All / Received / Issued by you**. "Issued by you" means the Creator
  Position is one the user holds, matched by name as the sidebar does. All is
  the default, because a report whose Creator Position isn't linked to anyone
  would otherwise show only under Received.
- **Child reports.** A citation with a cited report occurrence gets an "Open
  cited report" button.
- `lm_ChildReportTemplate` is **not** selected. Its logical name is unconfirmed,
  and one unknown column in `$select` fails the whole read.

Still on seeded data: **Reporting hierarchy**, and the hidden `rpt` composer that
other screens link into.

**6. Deploys.** Both apps were rebuilt and re-pushed to Code App Development after
each change above. Governance's push then failed **13 times in a row** on
`generateResourceStorage`, while Leadership succeeded between those attempts.
The two staging folders were identical in size, file count and config, so the
problem was service-side and specific to that app. A background loop retrying
once a minute got it through a few minutes later. See §8.

### This session (17 Sep, continued again): Build a report/plan, on live data

Ported from the Build screen of `Leadership Practice Extension.html` into the
Leadership app as `src/modules/leadership/screens/BuildReport.jsx`, nav entry
`build` in the **Artifact** group (above Reports / Plans).

**One deliberate difference from the prototype.** The prototype builds a report
from nothing. Here the weekly generator already creates each occurrence, so the
screen **opens an existing one that is still editable** — status **Draft or
Returned** and not `lm_locked` — picked from a selector at the top, or opened
with **Edit this report** from Reports / Plans (same rule).

**Same shape as the prototype otherwise:**
- **Edit / Preview tabs.**
- **Scope.** The report's Business Unit, period and creator are read-only. A
  **Department** filter narrows the KPI and Process picker and is not saved.
- **Title**, written to `lm_name`.
- **Insert the template's sections as starting rows.** Offered **only while the
  report has no sections**, so it cannot duplicate. It uses
  `fetchReportTemplateDetail()` and brings each template section's KPI /
  Breakdown / Process items across as citations.
- **Sections**: heading, the five diagnostic angles, text (4000, with a counter
  near the limit), move up / down, remove.
- **Citations** in two groups:
  - linked to real records: **KPI**, **Breakdown** (KPI + dimension),
    **Process**, **Child Report** (another occurrence);
  - saved as a named label only: **POC, Project, Strategy, BI Report, Issue,
    Task** — the 02 Sep text-only decision.
- **Save draft**, and **Submit for review**. Submit saves unsaved changes first,
  then calls the existing `submitReportOccurrence()` (status In Review, review
  step 0, a history row). If the save failed, it does not submit.

**Data layer (`dataverse.js`):**
- **`fetchReportOccurrenceForEdit(id)`** returns one report's Sections in order,
  with their Citations, in raw form. Citations are read in chunks of 15 section
  ids, because a long OR filter makes a URL the service rejects.
- **`saveReportOccurrenceContent(id, {name, before, after})`** writes only what
  changed, matching rows by id. No id means new; missing from `after` means
  removed. Existing citations are only ever **added or removed**, never edited.
- **Write order is deliberate:** a removed section's citations are deleted
  **before** the section, and a new section is created **before** the citations
  that bind to it. One failed row is recorded and the rest carries on; the screen
  then reloads, so what it shows is what actually saved.

**Styles.** No prototype-only CSS was used: `.rta`, `.cmtbox`, `.acts`, `.fgrid`
and `.chip` don't exist in this app. The section stack reuses the seeded
composer's real `.sec` / `.dg-seg` / `.cpick` / `.cite` rules. New CSS is only
`.bld-grid`, `.bld-fld`, `.bld-foot` and `.bld-prev`. `BuildReport.jsx` was added
to `scripts/undef-scan.py`'s file list.

**Verified by running the real `saveReportOccurrenceContent` in Node against
recording mock tables** — 16 checks, all passing. One save covering rename,
reorder, edit, add and remove produced exactly the expected writes, in the
integrity-safe order above:
- the kept citation was neither deleted nor recreated;
- every bind used the corrected entity sets;
- no empty `/<set>()` bind was sent;
- a new section was `lm_source` **2** (Added) and bound to its occurrence;
- an unchanged report wrote nothing;
- text over 4000 was reported, not sent.

**Not included, on purpose:**
- **Paragraph citations.** `lm_citedsection` already holds the citation's own
  parent, so there is no column left for a cited section.
- **A template's child-*template* items** come across as labels. There is no
  occurrence to link until someone picks one.
- **The prototype's Audience / Also-share-with fields.** `lm_reportoccurrenceshare`'s
  columns were never inspected, so they would have saved nothing.

**Deploys.** Both apps rebuilt and pushed to Code App Development, each on the
first attempt: Governance `4912152c…`, Leadership `83db0ef8…`.

### This session (17 Sep, later): both Code App Development apps re-registered from scratch — the originals are now orphaned, not updated

**Root cause, worth remembering:** the two staging folders backing the 16-17 Sep
deployment above (`C:\tmp\cad-gov`, `C:\tmp\cad-exec`) were lost — deleted at
some point outside this repo, since they were never inside it on purpose (§9
had already flagged this exact risk). `power-apps push` reads which app to
update from a local `power.config.json` that only `init` writes; there is
**no CLI flag on `push` or `init` to target an existing app id**, and no
"reconnect to an existing code app" command at all in this CLI version. The
maker portal was checked for a download/export option on the existing apps
first — none was found. Per explicit instruction, two **new** app
registrations were created instead, rather than guessing at reconstructing
the lost `power.config.json` by hand: its `connectionReferences` keys are
not arbitrary, they map to real Dataverse connection-reference records
created server-side by the original `add-data-source` call, and a hand-typed
wrong entry risks leaving a *live* app pointed at a broken data connection.

**New apps, same environment, distinct display names** (the platform
rejects a duplicate display name outright — `ApplicationDisplayNameIsInUse`,
naming the existing app's id in its own error — first attempt used the
original names unchanged and hit this):

| App | Old (now orphaned) | New | Staging folder |
|---|---|---|---|
| Governance Setup | `4912152c-b5c8-4beb-bb74-c9f43550405b` | `786c1b14-bf09-4dd7-a0a2-5730e87744fe` ("...Setup (2)") | `C:\tmp\cad-gov-new` |
| Leadership Execution | `83db0ef8-4c62-4eef-84ac-dadab326b704` | `d61c6237-fec1-45c7-80e0-a9c63dd1e662` ("...Execution (2)") | `C:\tmp\cad-exec-new` |

Same recipe as §8's "Deploying an app to an environment other than DT New,"
run against the current source (which now includes everything through this
session's Meeting Documents tab and the Completion Periods wiring): rebuilt
from the repo root, `pac auth create --deviceCode`/`power-apps login
--device-code` (the cached `pac` token had been revoked — password reset —
and `power-apps`'s separate cache had also gone stale), `power-apps init` +
`add-data-source -a shared_commondataserviceforapps -c
c83ec8ccf8a74ee1b8be81f4dfcb3ecf` (the same Code App Development connection
as before, confirmed still live via `pac connection list`) in each fresh
folder, `dist/` copied in, `power-apps push`. Both pushed successfully on
the **first** attempt — no `generateResourceStorage` timeout this time.

> ### ⛔ SUPERSEDED 20 Sep — read §5's "Deployment, settled" entry instead
>
> This entry is kept for its root-cause analysis, which is still correct and
> still worth reading. **Its conclusion is not.** `C:\tmp\cad-gov` and
> `C:\tmp\cad-exec` exist again and are the folders every deploy since 18 Sep
> has used. The apps this session pushes to are the ORIGINALS —
> `4912152c…` and `83db0ef8…` — not the `(2)` duplicates below. It is the
> `786c1b14…` / `d61c6237…` pair that is now unused.

⚠️ **The three old apps (`4912152c…`, `83db0ef8…`, and the unrelated
`2ffd8322…` "Andalusia Pulse" seen in the same `list-codeapps` output) are
now stale duplicates sitting in Code App Development, not deleted** — this
CLI has no delete-app command, so removing them is a maker-portal action,
still not done. **These two staging folders are, once again, the only
record of the new appIds outside this file** (same exact risk §9 already
flagged for the ones just lost) — back them up somewhere durable, or the
next push repeats this whole entry with two more orphans.

⚠️ **Nothing has been confirmed from the newly running apps either** — same
open item as the 16-17 Sep entry above, now doubled: neither pair has had a
screen checked against real DT New data or `window.__xenvSmokeTest()` run.

### This session (17 Sep, later still): Report Category/Type choice lists corrected, Report Template naming reworked, Meeting Setup wording

**1. `lm_reportcategory`/`lm_reporttype` were both fully replaced in
Dataverse, not extended** — the app's own `REPORT_CATEGORY_KEY`/
`REPORT_TYPE_KEY` were stale (still the old 4-value/3-value lists) and
silently wrote/read the wrong codes. Settled by discovering `pac
modelbuilder build` (§6, new entry), which is the first route this project
has found that actually returns an already-registered table's live choice
values. Real values (Dataverse's own labels): **Report Category** 1=Executive,
2=Core, 3=ADHOC; **Report Type** 1=Plan, 2=Dashboard, 3=Report Conclusion —
**this app displays code 3 as plain "Report"** (later the same session, on
explicit instruction; §6/§9 for where that rename touched). Updated in both
`dataverse.js` (`REPORT_CATEGORY_KEY`/`REPORT_TYPE_KEY` for writes,
`REPORT_CATEGORY`/`REPORT_TYPE` for reads) and `GovernanceApp.jsx`
(`REPORT_CATEGORIES`, `REPORT_TYPES`, `REPORT_TYPE_HELP`,
`REPORT_TYPE_TAG_COLOR`, `DV_REPORT_CATEGORY`, `DV_REPORT_TYPE`), plus the
two seeded demo Report Template Setups (`su-7`, `su-8`) that still carried
the old label strings and would otherwise have shown as unmatched.
`REPORT_TYPE_HELP`'s copy for Dashboard/Report is a best-effort description,
not confirmed business meaning — exact intended semantics weren't given,
only the labels and codes.

**2. Ad Hoc Report Category has no cadence.** When Report Category is ADHOC
(matched normalised — case/space/hyphen-insensitive, since the exact
Dataverse spelling wasn't separately confirmed beyond the enum name), the
Report Template wizard's Cadence step shows a plain note instead of
`CadenceFields`, and `validateReport()` skips `cadenceRules()` entirely — no
Frequency, Day, or Month is required or written for that Setup.

**3. Report Template naming reworked to an underscore token convention**,
per a naming-reference document: `{Region-or-BusinessUnit}_{Department}_
{ReportCategory}_{Frequency}`, e.g. `EGY_Quality_Core_Quarterly`, replacing
the old space-joined English phrase (`derivedName()`'s Report Template
branch in `GovernanceApp.jsx`). Two decisions taken with the user rather
than guessed: no new "Report Name" field was added — `{ReportName}` maps
onto the existing Report Category field instead; `{Region}` is the Setup's
own Region when Region-scoped or its Business Unit when BU-scoped, dropped
entirely (same as `{Department}`) when the Setup spans more than one and
there's no single token to name it after. Meeting naming is untouched.

**4. Two small Meeting Setup wizard fixes**, on explicit ask: step 3 renamed
from "Cadence" to **"Frequency"** (step label, in-step heading, and the
review-step summary title all updated — Report Template's own "Cadence and
review" step is untouched, this was Meeting-only); a new Meeting Setup's
**Quorum Threshold now defaults to 90%**, still a plain editable number
input, not a fixed/locked value.

**5. Setup Activity gap found and fixed while checking the wiring was
correct**, per an explicit ask to verify: `TRACKED` (the field list driving
`lm_setupactivity` audit-log writes on save) was missing `reportCategory`
entirely, so editing a Report Template's Category left no audit trail even
though the separate publish-preview diff already showed it correctly. Fixed
by adding `['reportCategory','Report Category']` to `TRACKED`. Confirmed,
not just fixed: `logIt`/`TRACKED`/`logSetupActivityBatch` is one shared
reducer path already firing identically for Report Template and Meeting
create/edit/publish/approve/expire — no Meeting-specific gap existed.

**6. Re-verified end to end, on a repeat ask — no further gap found.** Traced
every lifecycle action (`create`→`promoteDraft`, `saveDraft`, `publish`,
`approve`, `expire`, `expireDataverse`) for both kinds, plus the actual write
(`logSetupActivity` in `dataverse.js`, which correctly binds
`lm_ReportTemplate@odata.bind` vs `lm_MeetingTemplate@odata.bind` on `kind`)
and the timing (every `flushActivity` call site fires only once the parent
row's real Dataverse id is known). Nothing beyond item 5's fix needed
changing.

**7. Child report/plan citation picker (Governance Setup's
`SectionRowEditor`) gained a Stage filter.** Previously always offered a
bare Business Unit filter for this one citation kind, regardless of what
Stage a candidate Template actually ran at. Now: choosing **Stage 1** shows
a Business Unit filter and narrows candidates to Stage-1 (BU-scoped)
Templates; **Stage 2** shows a Region filter instead, narrowed to Stage-2
(Region-scoped) Templates; **Stage 3/4** narrows to group-wide Templates
(no Business Unit or Region at all) with no sub-filter, since those stages
carry neither. Uses `t.businessUnitIds`/`t.regionIds`, both already present
on `DV_REPORTS.current` register rows (already used elsewhere for the same
BU-vs-Region distinction) — no new fetch needed. The KPI/Process pickers'
own `ScopeFilter` (Business Unit → Department cascade) is untouched.

**8. A live/fallback KPI-list gap found from a screenshot, not a bug
report.** The Expected Content Checklist's "Add KPI" picker was showing
`KPI-QLT-001 Sepsis bundle compliance` and three other names — traced to the
exact built-in seed array in `GovernanceApp.jsx` (`let
KPIS=['KPI-QLT-001 Sepsis bundle compliance', ...]`), not live
`strategy_kpises` data. `fetchKpis()` itself is correctly wired (confirmed
against the real schema pulled earlier this session) and does replace
`KPIS` once it resolves — the seed only shows when that fetch never
succeeds, most likely because this was opened via plain `npm run dev`
(§8: no Dataverse connection at all in that mode) rather than the deployed
Power Apps play URL. Rather than leave that ambiguous again, added a new
module-level `KPIS_LIVE` flag (set `true` only inside the
`fetchKpis().then` success branch) and a visible amber warning in the
picker whenever it's still `false`, naming the likely cause.

**9. "Report Conclusion" (Report Type code 3) now displays as plain
"Report,"** on explicit instruction — the underlying code (3) and
Dataverse's own label are unchanged; only this app's display string
changed, in `REPORT_TYPES`, `REPORT_TYPE_HELP`, `REPORT_TYPE_TAG_COLOR`,
`DV_REPORT_TYPE` (`GovernanceApp.jsx`) and `REPORT_TYPE_KEY`/`REPORT_TYPE`
(`dataverse.js`), plus the `su-7` seeded demo Setup.

**10. Both apps rebuilt and pushed to Code App Development twice more this
session** (after item 5's fix, and again after items 7–9), each time to the
same two 17-Sep-registered apps (`786c1b14…` Governance, `d61c6237…`
Leadership) — no new registrations, no orphans added.

**11. `lm_fileattachement` — a new column found on BOTH `lm_report_templates`
and `lm_reporttemplatecontentchecklists`, wired end to end.** Found via a
full `pac modelbuilder build -enf "lm_report_template;lm_reporttemplatecontentchecklist"`
sweep (§6) run because the user asked to "update the report template table
and the report template content checklist table" with no further specifics
— rather than ask what changed, the whole current property list was pulled
and diffed against what `dataverse.js` already reads/writes. Everything else
on both tables was already accounted for; this one column, on both tables,
was not. Plain text, Dataverse's own label "File Attachement" (its spelling,
not a typo introduced here), max length 2000 (confirmed via a legacy-connector
schema pull, reverted immediately after reading it — see §6's modelbuilder
entry for why that revert matters). Wired as a plain link/URL field, same
convention as `torLink`/`lm_destinationsharepointlink` elsewhere in this
schema — never actual file upload:
- `dataverse.js`: added to `reportTemplateParentPayload()`'s write, the
  checklist row create, `fetchReportTemplateDetail()`'s parent and checklist
  selects (the checklist row's raw fields already flow through via `...c`,
  so no extra read-side mapping was needed there), and both JSDoc blocks.
- `GovernanceApp.jsx`: new `fileAttachment` field on `BLANK_REPORT` (parent)
  and on each new checklist Section; a plain text input in the wizard's
  "Destination and content" step (parent-level) and in `SectionRowEditor`'s
  header (per-Section); hydrated both ways in `dataverseReportToSetup()`/the
  wizard's outgoing payload builder; added to `TRACKED` and to the
  publish-confirmation diff summary.

**12. An Author could edit an already-Approved Setup — the role model never
actually checked the Setup's own status.** `ROLES.author.write` and
`ROLES.admin.write` were both `true` unconditionally; the single Edit button
(`ScreenDetail`, one control point — confirmed no other path into edit mode
exists, `ScreenRegister` only ever calls `open()`, never `A.edit()`
directly) gated on that flag alone. Per explicit instruction: an Author may
now only edit a Draft or an Under Review Setup; an Administrator can still
edit an Active/Approved one, and doing so still flips it back to Under
Review exactly as before (`A.edit()`'s own status flip was already correct
— this only changes who is allowed to click the button that reaches it).
New `canEdit = w && status!=='Expired' && (status!=='Active / Approved' ||
canApprove)` in `ScreenDetail`, plus a `Note` explaining why the button is
missing when an Author views an approved one (Expired already had its own
note; Under Review already had one).

**13. `lm_ActorUser` (a real `systemusers` lookup on `lm_setupactivity`) was
never actually being bound, for any action, ever** — found while checking
"activities are recorded correctly with the user." The write side
(`logSetupActivity` in `dataverse.js`) already had the right code,
`if(entry.actorUserId) row['lm_ActorUser@odata.bind']=...` — but nothing
ever set `actorUserId` on the entry object being queued. Every activity row
ever written carries the actor's name as free text in `lm_actor` (via
`actorName()`, correct and unaffected), but never linked the row to an
actual Dataverse user record. Fixed at both entry points — the shared
`logIt()` queue (used for every create/edit/publish/approve entry) and the
one direct `logSetupActivity()` call in `expireDataverse` — both now pass
`actorUserId: currentUser?.systemUserId || undefined`. Only takes effect
when the signed-in account is actually linked to a Dataverse user (see the
top-bar's own "Linked to Dataverse user…" tooltip) — an unlinked session
still logs the name-only text as before, same as it always has.

**14. Investigated real file upload for `lm_fileattachement` (item 11 above)
— confirmed not achievable through this app's current tooling, nothing
built.** Per an explicit ask for a real "upload a file" control saving its
storage path, not just a pasted link. Full account in §6's new "SharePoint
file upload" entry; the short version: a `shared_sharepointonline` data
source (`documents`, targeting the `SMO-AndalusialeadershipPractice` site's
document library — genuinely the right destination, its own columns
reference Process/KPI/Period/Document Status) was already registered in an
earlier session and never used. Regenerating its SDK to inspect it found
every field that could carry a file's name, path or content
(`{Name}`/`{Path}`/`{FullPath}`/`{Link}`) is **read-only** — the generated
service can update metadata on a file that already exists there, never
create one with content. `pac code add-data-source` only ever generates
table-style CRUD for a connector; SharePoint's real "Create file" is a
separate, dedicated connector action this CLI has no path to expose for a
Code App (`add-dataverse-api`/`find-dataverse-api` are Dataverse-only).
**Decision, given that: kept as a plain path/text field, no upload control
built.** `lm_fileattachement` stays exactly as item 11 left it — a text
input on both the Report Template and each Content Checklist Section.

**15. `and_microsoftgroupmembers` registered and wired into the Meeting
Setup wizard, right after Attendees.** Discovered via `pac modelbuilder
build -enf and_microsoftgroupmember` (the exact name given worked first
try): a flat table, one row per (group, member) pair — `and_groupname` and
`and_member` are both **plain text**, no lookups, no separate "groups"
table, so the same group name repeats once per member. `fetchMicrosoftGroupMembers()`
(`dataverse.js`) returns every row as-is; `GovernanceApp.jsx` derives the
deduplicated group list itself (`MICROSOFT_GROUPS`), per explicit
instruction not to offer the same group more than once. New
`GroupMembersLookup` component — a Group picker + a read-only member list —
sits inside each unit card, right after `AttendeeList`, **only in the
Meeting branch** (Report Templates have no Attendees section to follow).
**Deliberately not a Setup field**: picking a group writes nothing to the
Setup and adds nobody to Attendees — it only answers "who is in this
group" for whoever is filling Attendees in to check against, matching what
was actually asked (display, not import). Own local `useState` per unit
card, since `UnitSetup` renders unit cards inline via `.map()` — a hook
can't live directly in that loop, but a child component instantiated
inside it can hold its own.

**16. The KPI-picker live-data warning (item 8) turned out to be firing in
the deployed Code App Development app itself, not local `npm run dev` as
first suspected** — a materially different, and more concerning, finding.
Both Code App Development apps (`786c1b14…` Governance, `d61c6237…`
Leadership) were rebuilt and re-pushed from current source to rule out a
stale deployment as the cause. **`xenv.js`'s cross-environment wiring was
re-confirmed correct**: `DATA_ORG` is hardcoded to DT New's URL
(`https://org319b4ea9.crm4.dynamics.com`), and every table read/write —
`strategy_kpises` included — routes through it regardless of which
environment hosts the app. So the code is not the suspect.

**Leading theory, still unconfirmed: a Dataverse permissions gap, not a
wiring bug.** This is the exact risk §9's own checklist already named and
never verified either way — "Grant Create/Write on the `lm_` tables in DT
New to anyone who will use a remotely-hosted app... the failure looks like
a bug rather than a denial." A working `shared_commondataserviceforapps`
connection to Code App Development is not the same thing as the
*signed-in user* having a Dataverse security role granting Read/Write on
DT New's tables — and this is genuinely the **first real signal** that gap
might be biting, not just a theoretical item on a list. The user was
pointed at the existing `window.__xenvSmokeTest()` diagnostic (already
built into `xenv.js`, documented there) to get a definitive verdict plus
the real underlying error — **not yet run, result still pending.**

**17. Found and fixed the actual reason item 16's real error was invisible
— it was Process too, not just KPI, and both were being swallowed before
they ever reached a `catch` block.** The user reported the KPI warning
still showing after the item-16 rebuild+push, and that Processes were
"still not working" either — with no error banner for Process at all,
because none existed. Reading `fetchKpis()`/`fetchProcesses()` in
`dataverse.js` found the real bug: every `fetch*` function in that file
resolves a failed `getAll()` with `res?.data ?? []` instead of checking
`res.success` first. A denied/failed read comes back indistinguishable
from "the table is genuinely empty" — no exception, so the `try/catch`
around each fetch in `GovernanceApp.jsx`'s loader `useEffect` never fires,
and not even `console.warn` ever ran. This is why item 16's theory could
never be confirmed from the app itself: the real Dataverse error text was
being thrown away three layers before it could reach a banner or the
console.

Fixed narrowly (only the two tables actually reported broken, not all 15+
`fetch*` functions — no evidence the others are affected, and widening the
change risks new breakage for no confirmed benefit): added `rowsOrThrow()`
next to the existing `idOrThrow()`/`assertSuccess()` helpers in
`dataverse.js` — same pattern, but for reads — and switched `fetchKpis()`
and `fetchProcesses()` to it. A failed read now throws with Dataverse's own
error message. `GovernanceApp.jsx` now catches that, stores it in new
module-level `KPI_FETCH_ERROR`/`PROCESS_FETCH_ERROR` (alongside the
existing `KPIS_LIVE`, plus a new matching `PROCESSES_LIVE`), and both the
KPI picker banner and a newly-added Process picker banner (there was none
before) print the real error text inline instead of a generic "maybe this
is npm run dev" guess. Both apps rebuilt and re-pushed to Code App
Development (`786c1b14…` Governance, `d61c6237…` Leadership) with this fix.

**Next step is now trivial and unambiguous**: open the picker in the
deployed app and read whatever the banner says. If it's a 403/permission
message, item 16's theory is confirmed and the fix is a Dataverse security
role grant on `strategy_kpises`/`strategy_processes` in DT New (see §9). If
it's something else (bad column, wrong entity set), the message will say
so directly. `window.__xenvSmokeTest()` is no longer the only way to get a
real error out of this app — it was only ever needed because the fetch
helpers below it were swallowing errors too.

⚠️ **If any other picker/list in the app ever shows an unexplained empty or
stale-looking result with nothing in the console, suspect this same
`res?.data ?? []` pattern first** — every other `fetch*` in `dataverse.js`
still has it; only the two above were converted, and only because they were
the ones actually reported broken.

---

### 19-20 Sep: live tables behind four more screens, and the deployment settled

Twenty-two commits, `f446662`..`b0b5104`. Grouped by what they touched rather
than in order.

**Meeting Setup — attendees, Category, Classification.**
`lm_meetingattendeeslists` gained `lm_isgroup` and `lm_microsoftgroup`, a
lookup to `and_microsoftgroupmember` (relationship
`lm_meetingattendeeslist_MicrosoftGroup_and_microsoftgroupmember`). An
Attendee can now BE a Microsoft Group: the card offers "+ Add Microsoft Group"
and the group's members are listed beneath it, read live rather than copied.
`and_microsoftgroupmembers` is flat — one row per (group, member) pair, no row
that IS the group — so each group nominates its lowest-id membership row as
the representative the lookup binds to.

Two defects fixed in the same write, because the payload they travelled in was
being reshaped anyway: **Core/Supportive was discarded on save** (every row
written as Core), and **dropped again on read**, so reopening a Setup
downgraded its Supportive attendees. `attendeePositionIds: string[]` became
`attendees: {positionId|groupRowId, groupName?, type}[]`.

`lm_meetingcategory` (set `lm_meetingcategories`) arrived with exactly the
schema §7's proposal called for, and 73 rows were bulk-uploaded from
`lm_meetingcategory-bulk-upload.xlsx` (checked into the repo root, generated
from taxonomy §05). `lm_meetingtemplate` gained `lm_Category` and
`lm_Category_Name` — **both are written**: a Setup renamed in the Taxonomy app
would otherwise restate every historical Setup and drift out of step with
occurrences already generated. **Stage moved from wizard step 2 to step 1**,
because the cascade needs it before Classification and it sat one step after.

Type / Classification is now narrowed by Stage, and the allowed set is
**derived from the uploaded Category rows** rather than held as a second list,
so the two cannot disagree. Team of Teams is deliberately exempt — see §7.

`lm_meetingclassification` 124330001 was relabelled *Performance Monitoring
Meeting* → *Monitoring Meeting*. The CODE did not change, so nothing stored
moved; 11 spellings across four files did.

**Report Setup.** `lm_report_template.lm_SubmissionTiming` (global option set
`lm_submissiontiming`: 1 within same Month, 2 After Month) was wired — field,
conditional rule, save AND read-back.

**Build a report/plan.** POC, Strategy, BI Report and Task stopped being free
text. Six tables, none needing registration (see §8): `stf_strategypocs`,
`stf_executioncategories`, `crd04_specialtieses`, `strategy_strategies`,
`lm_bireportdashboards`, `hx_taskses`. POC carries five filters; Task can also
raise one into `hx_tasks`. `lm_reportsectioncitations` then gained `lm_POC`,
`lm_Strategy`, `lm_BIReport` and `lm_Task`, so those citations are now real
links rather than names — wired in the write and BOTH reads.

A cited KPI shows Baseline / Actual / Target from `pm_kpiachievments`, and the
BI dashboard behind it, framed.

**Reporting hierarchy — now live, after three attempts at the wrong problem.**
Rebuilt on `lm_reportoccurrences` + `lm_reportsectioncitations`, edges from
Child Report citations. It stayed flat, and the reason took three passes to
find; the finding is in §6.

**Business intelligence.** `lm_bireportdashboard` gained `lm_dashboardlink` and
`lm_kpi` (→ `strategy_kpis`), so the screen reads the table and the KPI filter
that could not be built now can be.

**Communication & execution — a whole new screen**, the one §9 recorded as
entirely missing. Inbox and Sent run on `lm_reportoccurrenceshare` (registered
long ago, never read by any screen) rather than the prototype's seeded COMMS
array; Tasks runs on `hx_tasks`.

**Three crashes of one shape, and the guard that ends them.** `ach is not
defined` (a component boundary), a 400 on `_wlog_decisionstatus_label` (no such
column — see §6), and `domain.jsx`'s `BIEmbed` calling `useState` that the file
never imported. Neither the build nor `undef-scan.py` can see these: the build
because an out-of-scope identifier is a RUNTIME error, the scan because it
works at file level and the identifier exists elsewhere in the file. **oxlint's
`no-undef` sees all three and was already installed, merely switched off.**
It is now `"error"` in `.oxlintrc.json`, with `env: {browser, es2024}` declared
alongside — without that the one real finding drowns in ~300 window/console
hits. `src/` is clean under it; `npm run lint` fails on the next one.

### 20 Sep: it renders — the double-encoding was real, the peel was too strict

**Resolved.** The tolerant peel fixed it, which settles the open question from
the two entries below: the content **is** delivered double base64-encoded.
The first peel failed only because `atob()` rejected a WRAPPER around the
inner payload — a BOM, surrounding quotes, a `data:` prefix or the base64url
alphabet, all of which `cleanBase64Text()` now strips. So theory 2 was right
and its implementation was too strict; the theory was discarded a round too
early on the strength of its own failed attempt.

⚠️ Which wrapper specifically was present was NOT identified. If this needs
narrowing later, `decodeFile()` logs on every successful peel.

⚠️ **The upload question is still open** and unchanged: whether Dataverse
STORES base64 text (in which case every file is wrong for anything reading it
outside this app) or the transport re-encodes on the way out. Downloading the
file from the maker portal still settles it.

**Then the grid was unreadable** — every heading wrapped one character per
line.

⚠️ **A `<table>` shrinks to fit its container**, and with
`word-break:break-word` it will reduce a column to a SINGLE CHARACTER to
manage it. 25 columns in a 900px modal rendered each heading as a vertical
stack of letters. `width:max-content` plus horizontal scroll is the fix —
**do not reintroduce `width:100%`** on `.fv-grid`.

Cells are now clipped with an ellipsis rather than wrapped, so every row is
one line high and the grid stays scannable; the full value rides on `title=`.

The first row is promoted to a sticky `<thead>` when `looksLikeHeader()`
says so — at least two non-empty cells, all non-numeric strings. **Detected,
not assumed**: a sheet that starts straight into data would otherwise lose
its first row into a header. Body rows keep the SHEET's own numbering (they
start at 2 when a header was lifted out), so what is on screen still matches
the file.

Numbers are right-aligned with tabular figures, including numeric strings,
since Excel stores plenty of numbers as text.

The modal widens to `min(1400px, 96vw)` but only when it contains a preview,
via `.gov-root .modal.wide:has(.fv-root)`. Where `:has()` is unsupported the
modal simply stays 900px.

### 20 Sep: stop guessing at the payload — make it identify itself

The peel did not fix it. That is now **two** theories inferred rather than
observed, both wrong:

1. "The stored file is corrupt" — wrong, and it sent me to inspect Dataverse.
2. "It is double base64-encoded" — also wrong; peeling produced nothing that
   carried a ZIP signature.

⚠️ **The lesson is the method, not the payload.** Each theory was built from
an indirect symptom (a lenient parser not throwing; text appearing in a
cell). Neither cost less than simply printing the first bytes would have.
`describeBytes()` now reports length, the first 12 bytes as hex, and the
first 96 as printable text, and that goes **into the on-screen error**, not
only the console — the person who can reproduce it is reading the panel,
not devtools.

The signature check also moved OUT of the sheet branch and now runs for every
extension with a known signature, so a PDF or an image fails the same honest
way rather than rendering as a broken frame.

The peel was additionally made tolerant of wrappers that would defeat
`atob()` regardless of whether the content is double-encoded: a BOM,
surrounding JSON quotes, a `data:` prefix, and the base64url alphabet
(`-_` for `+/`).

⚠️ **Still unresolved**, and the open question from the previous entry stands
unchanged: whether the upload stores base64 text, or the transport re-encodes.
The next screenshot of the error panel names the payload and settles it.

### 20 Sep: the real cause — the file content arrives DOUBLE base64-encoded

The preview rendered one cell holding a long base64 string. That is the whole
diagnosis: `XLSX.read()` never received a workbook. It received ASCII base64
TEXT and fell back to parsing it as CSV.

⚠️ **This also corrects the entry above.** That entry reasoned "the Download
button only appears once SheetJS has parsed the workbook, therefore the bytes
were a valid .xlsx". **The premise is false: SheetJS does not fail on text.**
It treats anything it cannot identify as CSV and succeeds. So a decoding bug
presented as a rendering bug, and the blob-URL fix, while correct in itself
(it was a genuine second defect), was not the cause of the corrupt download.
**Never treat "the parser did not throw" as evidence that the input was
valid** — especially not with a lenient parser.

**What actually happens:** the connector returns base64 of content that is
ITSELF base64, so one decode yields base64 text rather than the file.

`decodeFile()` in `FilePreview.jsx` peels one layer, but only when all three
hold: the extension says what the leading bytes must be, they do not match,
and after decoding again they do. So an unrecognised file is passed through
untouched and a .txt or .csv — which have no signature — is never
second-guessed, even when its content happens to be valid base64.

Signatures used: ZIP `50 4B 03 04` (xlsx/xlsm/docx/pptx), OLE2
`D0 CF 11 E0` (xls), `%PDF`, PNG, GIF, JPG, BMP.

**The sheet branch now REFUSES to render** when the bytes do not carry the
signature the extension promises, instead of handing them to SheetJS. Silent
garbage is worse than an error, and it is precisely what hid this.

**Verified in Node against the REAL source** (`node scripts/test-decodefile.mjs`,
which extracts the helpers out of `FilePreview.jsx` rather than restating
them): correctly-encoded xlsx and pdf pass through untouched; double-encoded
xlsx and pdf are peeled back to their signatures; and the four that must NOT
be peeled are not — a .txt whose content is valid base64, a .csv of
base64-looking words, a genuinely corrupt .xlsx, and base64 of a non-zip.

⚠️ **STILL OPEN — where the extra layer comes from.** Two candidates, not yet
distinguished:

1. **The UPLOAD stores base64 text as the file content.** `uploadFileColumn()`
   sends base64 and the gateway may store that string verbatim rather than
   decoding it. If so **the files in Dataverse are genuinely wrong** —
   anything reading them outside this app (the maker portal, a Flow, a user
   downloading from a model-driven form) gets base64 text — and the peel is
   only a read-side workaround.
2. **The transport double-encodes on the way out**, in which case storage is
   fine and the peel is the correct permanent fix.

⚠️ The §5 upload entry's claim that the base64 body was "CONFIRMED against
live Dataverse" only ever confirmed that the CALL SUCCEEDED and a filename
appeared — **it never verified the stored bytes**. Treat it as unproven.

**How to settle it:** open the record in the maker portal / a model-driven
form and download the file from Dataverse's own UI. Base64 text means (1) and
the upload must be fixed; a working spreadsheet means (2).

`pac org fetch` cannot help here: it crashes in its text-grid renderer on
`fileattachment` whatever columns are requested, and there is no `--json`.

### 20 Sep: "Excel cannot open the file" — a revoked blob URL, not a bad file

Downloading the Section citation's file produced an .xlsx Excel rejected as
"the file format or file extension is not valid". **The stored file was never
at fault, and neither was the upload.**

**How that was established without guessing:** the Download button only
renders when `FilePreview` is in its `ready` state, and for a spreadsheet that
state is reached *only after* `XLSX.read()` has parsed the workbook. A button
being on screen to press therefore proves the bytes were a valid .xlsx. The
fault had to be between those bytes and the file on disk.

⚠️ **`URL.revokeObjectURL` must not run on the tick after `a.click()`.**
`click()` only STARTS the download; the browser then reads the blob
asynchronously. The original code revoked in `setTimeout(..., 0)`, which races
that read and writes a truncated or empty file. The symptom looks exactly like
a corrupt upload, which is the trap — it sends you to inspect Dataverse when
the bug is three lines of local code.

The URL is now cached for repeat clicks and released by the effect cleanup,
**on a 30 s delay**, because closing the panel immediately after clicking
Download would otherwise revoke it mid-transfer. Preview URLs
(`urlRef`) still go immediately — nothing reads them once the `<iframe>` or
`<img>` unmounts. The two lifetimes are opposite, which is why they are two
refs.

⚠️ **A Section citation's `lm_sectionitemname` is NOT the file's name.** It is
the citation's LABEL and is stored prefixed: `File: lm_MeetingCategory
(...).xlsx`. Using it as the download name produced
`File_lm_MeetingCategory (...).xlsx`, because a browser rewrites the illegal
`:` when it saves. The real name is the File column's own
`lm_attachementfile_name`, now carried through as `fileStoredName` — the same
projection the Template already used, and kept out of the `$select` for the
same reason.

**Also learned about the CLI here:** `pac org fetch` crashed with a *stack
overflow inside `bolt.system.GridOutput.ToTextGrid()`* on the `fileattachment`
table. That is the CLI's own text-grid RENDERER failing on the result, not the
query — which corrects the older note in this file that "non-aggregate fetches
crash against some orgs". The query is fine; the printer is not. There is no
`--json` flag on `pac org fetch`, so the way round it is to request fewer or
shorter columns.

### 20 Sep: "came back empty" — two defects in the first download

Live symptom on a Section's File citation:
`lm_reporttemplatesectionitemses.lm_attachementfile came back empty`.

**The entity set was NOT the problem** (checked first, because the
double-pluralised name invites suspicion). `power.config.json` confirms
`logicalName lm_reporttemplatesectionitems` ->
`entitySetName lm_reporttemplatesectionitemses`, and the upload writes through
the same name. The message was mine, and the call had SUCCEEDED.

⚠️ **Defect 1 — the retry could never fire.** The `bytes=0-` fallback ran only
when the call FAILED. But a gateway that requires the Range header does not
fail: it answers **200 with an empty body**. So the retry written for exactly
this case was unreachable. **An empty result must retry, not just an errored
one.** Now both do, over a `[undefined, 'bytes=0-']` ladder.

⚠️ **Defect 2 — the error destroyed its own evidence.** The normaliser
returned `''` for any object shape it did not recognise, so an unhandled
envelope and a genuinely empty file produced the identical message. There was
no way to tell which had happened. `toBase64()` now also accepts `{value}`,
`{body}`, `{fileContent}`, `{documentBody}`, `Blob`, `ArrayBuffer` and typed
arrays (recursing, so a nested envelope resolves), and on failure the thrown
error **names what actually arrived** via `describePayload()` —
`Object{a, b}`, `ArrayBuffer(11 bytes)`, `string(length 3)` — plus every
Range attempted and how each one failed.

**General rule this is an instance of:** a normaliser that silently returns
"nothing" for an unrecognised input turns a shape bug into an indistinguishable
data bug. Either handle the shape or report it; never collapse the two.

⚠️ **`String.fromCharCode.apply` overflows the call stack** somewhere around
a hundred kB of arguments, so bytes are converted to base64 in 0x8000 chunks.
A 3 MB payload is in the test below; the naive one-shot form crashes on it.

**Verified in Node against the REAL source** (the test extracts the helper
text out of `xenv.js` rather than restating it, so it cannot pass against a
drifted copy): all 11 carrying shapes yield the file, the 4 empty/unknown
shapes yield `''` so the caller reports, and 3 MB converts without
overflowing. Run it with
`node scripts/test-tobase64.mjs`.

⚠️ Still **unconfirmed which of the two defects was the live cause** — the fix
covers both, and if it recurs the new error names the payload shape and the
Range attempts, which settles it in one click.

### 20 Sep: the Review panel on both Details tabs, restyled

Same source as the register restyle -- the `setup-detail` Summary tab in
**`leadership-practice (2).html`**. The side-by-side grid of summary blocks
becomes ONE full-width column: a gold uppercase group heading over a stack of
full-width label/value rows.

**This was almost entirely CSS, because `SumBlock` already emitted the right
structure** -- an `<h4>` heading over `.sum-row` children, each a label span
and a value `<b>`. Only the layout was wrong, so nothing about how the two
summaries are composed had to change.

**It lands on exactly the two tabs that were asked for.** `.sum-grid` has
precisely two users, `MeetingSummary` and `ReportSummary` -- which are the
Meeting Details tab and the Report Details tab (and, the same components
being reused, the wizard's final Review step). Checked before changing it
rather than assumed.

Why full width matters here and is not only decoration: the old grid cell was
`minmax(280px, 1fr)`, so a long value -- a resolved scope like
`Andalusia Health > KSA > Andalusia Jeddah > Quality > Accreditation`, or a
Teams link -- wrapped into a narrow column and became hard to read. The value
is now capped at 62% of a full-width row, which lets it wrap sensibly while
leaving its label intact.

⚠️ **Two `.gov-root .sum-grid` rules existed after the first pass**, the old
`repeat(auto-fit,minmax(280px,1fr))` at the top of the file and the new
single-column one at the bottom. Equal specificity, so only SOURCE ORDER
decided the layout, and any reordering of that stylesheet would have silently
restored the grid. The superseded rule was deleted. Caught by reading the
BUILT stylesheet -- the same check that caught the `.combo-*` collision, and
the reason to keep doing it.

A value that is plainly a URL (`/^https?:\/\//`) now renders mono, gold and
`word-break:break-all`, as the design shows the Teams link. ⚠️ The test is
guarded on `typeof v === 'string'`: a SumBlock value may be a React node --
the Template file row passes one, with its View button -- and a regex against
that throws. The link uses `--teal-d` rather than `--teal`, because at 11.5px
the lighter gold sits near 3:1 on this background, under the readable
threshold for small text.

`.sum-row:last-child` gets its rule back. theme.css removes it, which was
right when a block was a standalone card; in a stacked column it is the line
that closes a group off from the next group's heading.

### 20 Sep, later still: Setup Register restyled to the approved design

Source of truth is **`leadership-practice (2).html`** in the repo root (the
`#gov-setups` panel), supplied as a screenshot. Applied: a 3px accent bar
across the top of each stat card, the design's lift-on-hover, label-less
filters resting on "All ...", a chevron on each select, and the register
table's roomier row rhythm.

**The mockup has FEWER controls than the shipped app, and those were KEPT.**
This is the one judgement call in the change, and it is deliberate -- "apply
the UI style" is not an instruction to delete working features:

| In the app | In the mockup | Decision |
|---|---|---|
| **Expired** stat card (5 cards) | absent (4 cards) | kept, given a grey bar |
| **Status** filter | absent | kept -- the most-used filter on this screen |
| **Stage** column | absent | kept |
| row **actions** (Open / Duplicate / Expire) | absent | kept |
| "Under Review" | "Under Revision" | kept **Under Review** -- it is a real `LIFECYCLE` value, used by the Status filter and the status pills; renaming only the card would desynchronise the label from the data |

⚠️ **The trap in label-less filters: pin `value="All"`.** Every filter tests
`fKind !== 'All'` and friends. The design replaces the option's TEXT with
"All Kinds" / "All Setup Types" / "All Categories" / "All Stages". Changing
the text *without* writing `<option value="All">` changes the option's VALUE
too (it defaults to its text), so every filter would read as permanently
engaged and the register would show nothing. All five are pinned.

⚠️ **Removing a visible `<label>` removes the accessible name.** A bare
`<select>` is announced as "combo box" and nothing else. Each control now
carries an `aria-label`; the resting "All ..." text is a visual affordance,
not an accessible name.

**`Stat`'s `c` prop changed meaning:** it used to colour the DIGIT
(`style={{color:'var(--'+c+')'}}`); it now names an accent class (`sc-green`,
`sc-gold`, `sc-amber`, `sc-alert`, `sc-grey`) and the number is always ink.
`Stat` is used **only** on this screen (5 call sites), so nothing else moved.

⚠️ **All of this is scoped `.gov-root` in `governance-modern.css`, NOT
`theme.css`.** `.stat`, `.stats`, `.fltr` and `table.data` all exist in BOTH
apps; an unscoped rule in the shared sheet would have restyled Leadership too.
**Verified after building both**: Leadership's built stylesheet contains zero
`stat.sc-*` rules. This is the `.combo-*` collision lesson applied in advance
rather than debugged afterwards.

⚠️ **Do not write `[class*="sc-"]`.** The first version of the accent rule
used that substring form; it also matches any class merely CONTAINING `sc-`
-- `desc-`, and Leadership's own `.sc-pick` star rating -- which is a stray
3px bar waiting to happen. The five classes are listed explicitly.

The accent bar is `::before`, not `border-top`: a border would square off the
card's rounded top corners.

### 20 Sep, later: attached files can be READ, not just replaced

Files could be uploaded and replaced but never opened. The only way to learn
what a Template actually asks for was to have been the person who uploaded it.
`src/shared/FilePreview.jsx` now shows a stored file read-only, wired into the
Details tab in two places (the Template's own file, and any Section's File
citation).

**The connector has a download operation, and nobody had used it.**
`GetEntityFileImageFieldContentWithOrganization` sits right beside the upload
in the generated `MicrosoftDataverseService` -- same connector, same
cross-environment shape, so a preview reads whatever `DATA_ORG` points at.
Wrapped as `downloadFileColumn()` in `xenv.js`, symmetric with
`uploadFileColumn()`.

⚠️ **`Range` is the first positional argument and the generated signature
types it as a required `string`** -- but it is an HTTP Range header, and
OMITTING it is what asks for the whole file. It is passed `undefined` (which
`JSON.stringify` drops) with a single retry at `'bytes=0-'`, because a wrong
guess fails with a transport error that says nothing about the cause.

**The response has three known shapes**, all normalised in
`fileContentToBase64()`: a bare base64 string, a `data:` URI, and the Power
Platform `{$content-type, $content}` binary envelope.

**What can and cannot be shown:**

| Type | How | Status |
|---|---|---|
| `.xlsx .xlsm .xlsb .xls .csv` | SheetJS -> `sheet_to_json` -> React table | ✅ the live case |
| `.pdf` | blob URL in an `<iframe>` | ⚠️ untested -- no PDF exists yet, and `frame-src` in the host CSP is unverified |
| images | blob URL in `<img>` | untested |
| `.txt .md .json .xml .log` | `TextDecoder` -> `<pre>` | untested |
| `.docx .pptx` | **cannot** | honest "cannot be shown", Download offered |

⚠️ **Office documents have no browser renderer available here.** The Office
Online viewer (`view.officeapps.live.com/op/embed.aspx?src=`) needs a
PUBLICLY reachable URL; a `blob:` URL is local to the tab and the Dataverse
URL needs auth. Do not try to resurrect this -- the button reads "Download"
rather than "View" for those types, via the exported `canPreview()`.

**SheetJS is loaded with a dynamic `import()`**, and the build confirms the
split: `xlsx-*.js` is its own 492 kB chunk, so the main bundle did not grow.
Bundling it statically would make every page load pay for a screen most
people never open.

⚠️ **The grid is built from `sheet_to_json` + React elements, deliberately
NOT `sheet_to_html` + `dangerouslySetInnerHTML`.** That would mean injecting
markup derived from an uploaded file into the governance app; React escapes
every cell for free and there is no reason to take that on for a grid of
values.

**A latent data-integrity bug, fixed on the way.** Section items hydrate with
`id:uid('si')` -- the editor needs a key it can mint for new rows -- so the
item's Dataverse id was **discarded**, and a File citation knew a file existed
(`hasFile`) with no way to address it. It is now carried as `dvId`. But
`duplicateFrom()` spread checklist rows with `{...c}`, sharing the `items`
array *by reference*, so a duplicate would have pointed at the ORIGINAL's file
and shown it as its own. Items are now re-mapped with `dvId:null,
hasFile:false` -- which is also the truth, since `createSectionItems()` only
uploads a file picked in the current session and duplicating never copies
file content.

**Live file inventory (20 Sep)** -- only two files exist in DT New, both
`.xlsx`, which is why the spreadsheet path is the one that matters:

| Row | File |
|---|---|
| `lm_report_template` `test_Bio Medical_Core_Monthly` | `Untitled spreadsheet (1).xlsx` |
| one `lm_reporttemplatesectionitems` row | `lm_MeetingCategory (1789744418443) (1).xlsx` |
| `lm_reportoccurrence` | none -- no occurrence has a file yet |

⚠️ FetchXML entity names for these: `lm_report_template` (singular) but
`lm_reporttemplatesectionitems` (already plural-ish); `lm_reporttemplate`
`sectionitem` singular does NOT exist. The Template's primary name column is
`lm_newcolumn`. FetchXML **does** return `lm_attachementfile_name`, unlike
modelbuilder (see the previous entry).

The `.fv-` CSS prefix was checked unused across `src/` before being chosen and
verified in the BUILT stylesheet afterwards -- all 18 classes present, the
only scoped selectors the two intended ones. See the `.combo-*` collision for
why that check is not optional.

### 20 Sep: the attached template file, named, on the Details tab

The Details tab never mentioned the Template's own file, and the wizard only
said "a template file is already attached" without saying which. Both now name
it.

**A Dataverse File column returns its filename as `<column>_name`.**
`lm_report_templates.lm_attachementfile` is a File column (`Nullable<Guid>`);
selecting it also yields `lm_attachementfile_name` — confirmed against a live
row, which came back as `Untitled spreadsheet (1).xlsx`.

⚠️ **It is NOT in the `$select`, deliberately.** `pac modelbuilder` emits only
`lm_attachementfile` as an attribute, so `_name` is a runtime-projected
property rather than a declared column — and selecting an undeclared property
is exactly what 400'd the whole Decisions read (`_wlog_decisionstatus_label`,
§6). The file column is already selected and the name rides along with it, so
it is read opportunistically and degrades to `''` if that ever changes.

⚠️ **Two columns on `lm_report_template` differ by one transposition and mean
different things:**

| Column | Type | Holds |
|---|---|---|
| `lm_attachementfile` | File (Guid) | the uploaded file itself |
| `lm_fileattachement` | Text | a plain text/URL pointer, max 2000 |

Both are selected and both are read. `lm_reportoccurrence` carries the same
`lm_attachementfile` plus a separate `lm_filename`, and its section items have
their own `lm_attachementfile` too.

The stored name is kept under `templateFileStoredName`, not `templateFileName`.
The latter means "picked this session, uploads on save" and the wizard prints
"Will upload on save: …" from it — filling it from the stored name would have
claimed a pending upload that is not pending.

### 20 Sep, later: environment groundwork, and four UI fixes

`053d0e6`, `d7d9510`, `424666e`, `06e0967` and the file-picker commit.

**Groundwork for open decision 9** (`053d0e6`). `DATA_ORG` was one constant in
the shared `src/`, so changing it moved BOTH apps — the exact thing the IT move
must not do. Each app's `vite.config.js` now defines `__DATA_ORG__`, and
`xenv.js` reads it with DT New as the fallback. Behaviour is unchanged today;
verified the define is substituted at build time (the identifier is absent from
the bundle, the URL is inlined). `__DATA_ORG__` is declared `readonly` in
`.oxlintrc.json`, or `no-undef` flags it.

**`preflight()`, the tool that replaces yesterday's 45 CLI calls.**

    await window.__xenvPreflight()
    await window.__xenvPreflight({ org: 'https://org2f45e702.crm4.dynamics.com' })

Reads one row from every registered table and reports OK / EMPTY / DENIED /
ABSENT, with `out.blocked` as the list to hand an administrator. **The org
override is the point**: the adapter takes the organization per call, so IT can
be checked from the app running today — no rebuild, no deploy — and it tests
the APP's connection and user rather than whoever is signed in to the CLI.
The table list is not hardcoded: `dvTable()` registers every entity set it is
asked for, so the sweep cannot drift from what the app uses.

⚠️ `window.__xenvSmokeTest` had been documented in `xenv.js` for weeks and was
**never attached to `window`** — it had never been runnable as described. Both
helpers are attached now, plus `window.__xenvOrg()`.

**Destination moved to Submission per unit** (`d7d9510`). It sat on
"Destination and content" as a red error until a Channel was chosen — an alarm
raised on a step where nothing could be done about it. It now sits under the
Channel that fills it, on each unit card, read-only: dashed placeholder before,
the resolved SharePoint path after. `destinationOf()` still derives it at
display and at save, so there is still no second copy to drift. The rule moved
with it — reported against the first unit rather than the step that only
displayed the result, because `u-<key>` is what `unitIssueCount()` counts to
mark a unit card.

**Both file pickers styled like "+ Add section".** A bare
`<input type="file">` cannot be restyled (its button is a shadow-DOM part), so
the input is visually hidden inside a `<label>` carrying the look — clipped,
not `display:none`, which would drop it out of the tab order. ⚠️ The label
NESTS the input and does **not** also carry `htmlFor`: a label that both wraps
its control and points at it can fire the click twice, opening the file dialog
two deep. The focus ring uses `:focus-within`; a sibling combinator cannot
reach the button, because the input sits after it in the markup.

**⚠️ A CSS collision that specificity did not prevent** (`424666e`). The
searchable-dropdown work put its styles in `theme.css` as bare `.combo-*`, and
Governance already had `.gov-root .combo-opt` — which the Position picker's
options also carry. `.gov-root .combo-opt` beats a bare `.combo-opt` **only for
the properties it sets**, and it does not set `flex-direction`. So the unscoped
`flex-direction:column` still applied, and `.gov-root .pos-sel-opt`'s
`align-items:center` — correct for a row — centred the column. Every Position
option rendered as an avatar above a centred name. Renamed to `.cmb-*` rather
than scoped: two components sharing a class name in one bundle is the bug, and
winning a specificity fight leaves the next collision to be found the same way.
**Check the BUILT css, not the source**, when a style behaves unexpectedly
across the two modules.

**The Expected Content Checklist shows on a Template's Details tab**
(`06e0967`). It reported only "N section(s)", so the one thing a Report
Template defines could only be read by opening the wizard — which meant putting
the Setup into edit mode to look at it. Each section now shows heading,
Diagnostic Angle, attached file and every citation. The citation labels come
from the editor's own rule, lifted into `sectionItemLabel()` and shared, so the
same row cannot read two ways.

### 25 Sep: ⚠️ the 23 Sep deployment entry below is WRONG — read this first

**Its central factual claim is false, and the conclusion drawn from it sent a
push to the wrong pair.**

It says `C:\tmp\cad-gov` and `C:\tmp\cad-exec` "no longer contain a
`power.config.json`". **They both do**, and always did:

| Folder | appId | Environment |
|---|---|---|
| `C:\tmp\cad-gov` | `4912152c-b5c8-4beb-bb74-c9f43550405b` | Code App Development |
| `C:\tmp\cad-exec` | `83db0ef8-4c62-4eef-84ac-dadab326b704` | Code App Development |

⚠️ **How the false negative happened, because it will happen again.** The
check ran Python against a **Git Bash** path:

    python -c "json.load(open('/c/tmp/cad-gov/power.config.json'))"
    -> FileNotFoundError

Native Windows Python cannot open `/c/...`; only the shell translates it.
`ls` in the same command showed the file present, and the mismatch was read
as "the folder has no config" instead of "the two tools disagree about the
path". **Use `C:/tmp/...` for Python/`pac`; `/c/tmp/...` only for shell
builtins.** When `ls` and a program disagree about whether a file exists,
suspect the path form before believing the program.

**Consequence.** On that false basis the staging route was declared dead and
`power-apps push` was run from `apps/governance/` and `apps/leadership/`,
which deployed to **`7caa2fb2-1661-4b02-a2a3-926f58f88e61`** and
**`0f077a0a-fd52-4e57-900c-b7607ea30505`** in **DT New**. That contradicts
§8's standing rule — *"use a staging folder so `apps/*/power.config.json`
stays bound to DT New"* — whose entire point is that the repo config is a
DEVELOPMENT binding and not a deploy target.

⚠️ **So there is now a third live pair, and it was not meant to exist.** The
23 Sep entry additionally told future sessions to treat the Code App
Development pairs as "history", which is the opposite of true: 24 Sep was
spent recovering `d61c6237…` specifically to avoid orphaning it.

**Current state, as far as it can be established:**

| Pair | Environment | Staging folder | Status |
|---|---|---|---|
| `4912152c` / `83db0ef8` | Code App Development | `cad-gov` / `cad-exec`, both intact | called orphaned by earlier entries, but their folders are the ones that survived |
| `786c1b14` / `d61c6237` | Code App Development | **gone** — `cad-gov-new`/`cad-exec-new` do not exist | Leadership reconnected 24 Sep; Governance never recovered |
| `7caa2fb2` / `0f077a0a` | **DT New** | `apps/governance`, `apps/leadership` | pushed 23 Sep in error |

⚠️ **Do not push anywhere without asking first.** This file has now named
four pairs as current across five entries, at least two of those claims are
wrong, and the folder that 24 Sep's recovery produced is already missing
again. Which pair is canonical is a question for the product owner, not an
inference to be drawn from this document.

### 23 Sep: deployment, as it ACTUALLY is — read this one, the two below are history

Verified by pushing, not by reading: both apps went out successfully today
and the URLs below are what `power-apps push` printed back.

| App | App id | Push from |
|---|---|---|
| Governance Setup | `7caa2fb2-1661-4b02-a2a3-926f58f88e61` | `apps/governance/` |
| Leadership Execution | `0f077a0a-fd52-4e57-900c-b7607ea30505` | `apps/leadership/` |

Both are HOSTED in **DT New** (`9ce6fb09-5b63-e9f4-9185-b707b4b3425e`,
`org319b4ea9`) — **not** Code App Development, which is where every earlier
entry in this file says they live.

```
https://apps.powerapps.com/play/e/9ce6fb09-5b63-e9f4-9185-b707b4b3425e/app/7caa2fb2-1661-4b02-a2a3-926f58f88e61
https://apps.powerapps.com/play/e/9ce6fb09-5b63-e9f4-9185-b707b4b3425e/app/0f077a0a-fd52-4e57-900c-b7607ea30505
```

**The whole procedure now:**

```bash
npm run build:governance && npm run build:leadership
PA="$PWD/node_modules/.bin/power-apps"
(cd apps/governance  && "$PA" push)
(cd apps/leadership  && "$PA" push)
```

⚠️ **The staging-folder dance is GONE and cannot be followed.** `C:\tmp\cad-gov`
and `C:\tmp\cad-exec` still exist but **no longer contain a
`power.config.json`**, and `C:\tmp\cad-gov-new` — which decision 9 names as
the current staging folder — **does not exist at all**. The only
`power.config.json` files left are the repo's own `apps/governance/` and
`apps/leadership/`, which is why the push runs from there. That is also the
tidier arrangement: §1 already describes both as real Code App roots.

⚠️ **Hosting environment and DATA environment are now different things, and
both matter.** Hosted in DT New; Governance's `__DATA_ORG__` still points at
**IT**, and Leadership still splits (DT New, plus 14 IT-pinned tables).
Verified in the built bundles on this push: Governance contains the IT URL and
**zero** DT New URLs; Leadership contains **both**. That is the expected
signature — check it on every push.

⚠️ **This file has now named FOUR app pairs as live** (`4912152c`/`83db0ef8`,
`786c1b14`/`d61c6237`, and this one). Decision 9 already records an
unresolved contradiction between the first two. **Do not trust any app id in
an entry below this one.** The authority is `apps/*/power.config.json` in the
repo — `push` has no flag to target an app and reads only that file, so
whatever it says IS the destination.

### Deployment, settled — pushing to the SAME link and the SAME app id

**This supersedes the 17 Sep "re-registered from scratch" entry above.** The
live pair is the ORIGINAL pair.

| App | App id | Staging folder | Link |
|---|---|---|---|
| Governance Setup | `4912152c-b5c8-4beb-bb74-c9f43550405b` | `C:\tmp\cad-gov` | `https://apps.powerapps.com/play/e/cd78a59b-e16f-e4aa-b0a1-8e450a70ed56/app/4912152c-b5c8-4beb-bb74-c9f43550405b` |
| Leadership Execution | `83db0ef8-4c62-4eef-84ac-dadab326b704` | `C:\tmp\cad-exec` | `https://apps.powerapps.com/play/e/cd78a59b-e16f-e4aa-b0a1-8e450a70ed56/app/83db0ef8-4c62-4eef-84ac-dadab326b704` |

Both live in environment **Code App Development**
(`cd78a59b-e16f-e4aa-b0a1-8e450a70ed56`, `org998df960.crm4.dynamics.com`) and
both READ AND WRITE **DT New** (`org319b4ea9.crm4.dynamics.com`) through the
cross-environment adapter — see `src/services/xenv.js` and §8.

**The whole procedure, from a clean tree:**

```bash
cd "<repo root>"
npx vite build --config apps/governance/vite.config.js
npx vite build --config apps/leadership/vite.config.js

rm -rf /c/tmp/cad-gov/dist /c/tmp/cad-exec/dist
cp -r apps/governance/dist /c/tmp/cad-gov/dist
cp -r apps/leadership/dist /c/tmp/cad-exec/dist

PA="<repo root>/node_modules/.bin/power-apps"
cd /c/tmp/cad-gov  && "$PA" push
cd /c/tmp/cad-exec && "$PA" push
```

**Four things that will otherwise cost an hour each:**

1. **`power-apps` is NOT on PATH.** It is a local devDependency
   (`@microsoft/power-apps-cli`), so it must be called by absolute path out of
   `node_modules/.bin/`, or through `npx` from the repo root. A push script
   that just says `power-apps push` fails with *command not found* — and the
   failure is easy to misread as a sign-in problem.
2. **The app id comes from the staging folder's `power.config.json`, nothing
   else.** `push` has no flag to target an app. Lose the folder and there is no
   way back to the same link — which is exactly what produced the orphaned
   `(2)` pair on 17 Sep. **These two folders are still outside the repo.**
3. **`dist/` must be replaced, not merged.** `rm -rf` first: Vite's hashed
   filenames mean a stale bundle survives a plain copy and ships alongside the
   new one.
4. **A failed push can still exit 0.** A DNS failure on
   `generateResourceStorage` printed its error and returned success on 20 Sep.
   Read the output for *"App pushed successfully"* — do not trust the exit
   code. Retrying immediately worked.

Pushes still time out intermittently (§8); one app can fail repeatedly while
the other succeeds, and spacing retries about a minute apart works.

### 20 Sep: real file upload for the Report Template, via a genuine Dataverse File column — not the SharePoint dead end

Per an explicit ask to add an upload control for "the template file" and drop
the old URL field. First step was `pac modelbuilder build -enf
lm_report_template` (singular logical name, given directly) to see the
table's current real schema before touching anything — found a column that
didn't exist the last time this table was inspected: **`lm_attachementfile`**,
a getter-only `Guid?` property on the generated entity. That shape (nullable
Guid, no setter) is the modelbuilder signature of a **native Dataverse File
column** — a completely different thing from `lm_fileattachement` (plain
text, item 11 in this section's 17 Sep entries) and from the
`shared_sharepointonline` dead end (item 14, same date): a File column stores
real binary content Dataverse itself hosts, no SharePoint site involved.

**This changes the SharePoint entry's conclusion, but only for THIS path.**
That entry is still correct about `pac code add-data-source`-registered
connectors never exposing a "create with content" action — a native
Dataverse File *column*, reached through the Dataverse connector's own
dedicated upload action, was never inside that limitation to begin with.

**The action exists, cross-environment, on the same generic connector
`dvTable()` already uses.** `MicrosoftDataverseService` (the generated
wrapper `xenv.js` calls) already had
`UpdateEntityFileImageFieldContentWithOrganization` /
`GetEntityFileImageFieldContentWithOrganization` — upload/download for a
File or Image column, organization-scoped like every other operation in that
file — sitting unused since the connector was first registered. New
`uploadFileColumn(entitySet, recordId, fieldName, fileName, base64Content,
contentType)` in `xenv.js` wraps the upload half, same `fail()`-on-`!success`
convention as `dvTable()`. New `uploadReportTemplateFile(templateId,
fileName, base64Content, contentType)` in `dataverse.js` calls it against
`lm_report_templates`/`lm_attachementfile` specifically.

**The body format is inferred, not confirmed against a real upload yet.**
The connector's own cached schema declares the `item` parameter `{in:
"body", schema: {format: "binary", type: "string"}}` under `consumes:
application/octet-stream` — standard Power Platform connector shape for
binary content carried over this SDK's JSON-based `executeAsync` transport,
which by convention means a **base64** string, not raw bytes. `fileToBase64()`
(`GovernanceApp.jsx`) does `FileReader.readAsDataURL` and strips the
`data:...;base64,` prefix. ⚠️ **Not yet proven against live Dataverse** — the
SDK's own binary handling lives in a runtime object injected by the Power
Apps host (`getPowerSdkInstance`), invisible to static inspection from this
repo, so base64 is the documented connector convention, not something
confirmed by a successful upload. **First real test: pick a file in the
Setup wizard, save, then check in the maker portal (or re-download via
`GetEntityFileImageFieldContentWithOrganization`) that the column actually
holds that file's bytes, not a corrupted/empty blob.** If it fails, suspect
the encoding step first.

**A File column has nothing to attach to until the row exists**, so the
upload cannot happen inside the normal create/update payload the way every
other field does — `lm_attachementfile` doesn't even have a setter on the
generated entity. Wired into `writeTemplateToDataverse`'s existing Report
Template success callback (`GovernanceApp.jsx`), right after a create or
update resolves a real id: a File the user picked is held in a new
module-level `PENDING_TEMPLATE_FILE` map (Setup-id → the raw `File` object)
rather than on the Setup itself, because `set()` merges into a plain object
that gets JSON'd for sessionStorage (§5, 07 Sep) and a `File` does not
survive that regardless of where it's stored. Same lifecycle idea as the
pre-existing `PENDING_DV_WRITE` map, just for a browser object instead of a
promise.

**The old text field is removed from the UI, not deleted from the schema or
the data layer, per "remove the url field for now."** The wizard's
"Destination and content" step no longer shows the `lm_fileattachement`
text input; `BLANK_REPORT`, the hydrate (`dataverseReportToSetup`), the
payload builder and `TRACKED`'s audit entry for it are all untouched, so a
Setup that already had a value there keeps it (just not editable from this
screen) and re-adding the input later is a small, isolated change. A new
`hasTemplateFile` flag (hydrated from `!!p.lm_attachementfile` on read) lets
the field say "a template file is already attached" without needing to
resolve or expose the file's actual name — Dataverse doesn't hand that back
on a plain `$select` of the column.

**Not built, scope was kept to the ask:** no download/preview control (the
connector action for it exists — `GetEntityFileImageFieldContentWithOrganization`
— and would be a small follow-up), no upload for the per-Section
`lm_fileattachement` link on `lm_reporttemplatecontentchecklists` (the ask
named `lm_report_template` specifically), and no client-side size floor
beyond a 25 MB guard against hanging the tab on `FileReader` — Dataverse's
own file-column limits weren't looked up.

### 20 Sep, same day: the same File-upload capability added one level down — a Section Item can now cite an uploaded file, and the per-Section URL field is removed too

Per a follow-up ask, refreshed `lm_reporttemplatesectionitems` (`pac
modelbuilder build -enf lm_reporttemplatesectionitems`, plural — this one
IS the plural form, per §6's own inconsistency table) and found it carries
the **exact same shape of new column** as the parent: `lm_attachementfile`,
a getter-only nullable Guid, i.e. another native Dataverse File column, this
time on the CITATION row rather than the Template row. `lm_itemtype`
(`lm_reportsectionitemtype`) was refreshed alongside it and is **still only
four values** — KPI=1, Breakdown=2, Process=3, ChildTemplate=4, confirmed
live — no fifth value for a File citation exists in Dataverse.

**Decision, not confirmed with the user: a File citation writes `lm_itemtype`
null.** `SECTION_ITEM_TYPE_KEY` has no `'File'` entry, so the existing `??
null` fallback in `createSectionItems()` already does this with no code
change needed for that line. A File-type row is recognised on READ purely by
`lm_attachementfile` being populated (`type: SECTION_ITEM_TYPE[it.lm_itemtype]
|| (it.lm_attachementfile ? 'File' : null)` in `fetchReportTemplateDetail`).
This was the pragmatic option over asking Dataverse admin to add a fifth
choice value first — flagging it here so it's easy to revisit if a real
`File` option is ever added to `lm_reportsectionitemtype`, at which point
this fallback-by-presence trick should be replaced with the real code.

**New citation kind "Uploaded file" in the Section editor**
(`GovernanceApp.jsx`), alongside KPI / Breakdown / Process / Child
report-plan — same picker panel, same coloured-chip language (new `k-file`
class, using the until-now-unused `--grey`/`--grey-bg`/`--grey-bd` theme
tokens, since the other four semantic colours were all already spoken for).
Picking a file reads it via `fileToBase64()` (already built for the parent
upload, reused as-is) **immediately on pick**, not deferred to save time —
unlike the parent Report Template's file, a Section Item's local id is
generated at pick time with no later "the create just resolved an id" hook
to convert lazily against. The result is stashed in a new module-level
`PENDING_SECTION_ITEM_FILE` map (item-id → `{name, type, base64}`), same
"never touches `s`/sessionStorage" discipline as `PENDING_TEMPLATE_FILE`.
`buildReportTemplatePayload()` reads this map synchronously when building
the outgoing item object, so no extra async plumbing was needed in the
already-synchronous `saveDraft`/`publish` call chain; `createSectionItems()`
(`dataverse.js`) uploads the content right after creating that item's row,
the same "row must exist first" reasoning as the parent.

⚠️ **Real, so far unavoidable limitation: editing and re-saving a Setup
loses a Section Item's file unless it is re-picked.** `updateReportTemplateToDataverse`
deletes and fully recreates EVERY checklist row and EVERY section item on
every edit (confirmed by reading the function, not assumed) — this is not
new behaviour introduced here, every other citation kind already loses
nothing only because a KPI/Process/Child-Template citation is just a
lookup, trivially rewritten from the same picked name/id every time. A
File's binary content cannot be reconstructed the same way; the old
row (and its uploaded bytes) is gone, and the freshly recreated row has
nothing to upload unless `PENDING_SECTION_ITEM_FILE` has a fresh entry for
it. The picker shows an explicit amber warning about this at pick time. A
real fix would mean downloading the old content
(`GetEntityFileImageFieldContentWithOrganization`) and re-uploading it
automatically when a File item survives an edit unchanged — not built,
flagged here as the natural next step if this limitation turns out to
matter in practice.

**The per-Section URL field is removed from the UI the same way the
parent's was** — `lm_reporttemplatecontentchecklists.lm_fileattachement`'s
text input (`SectionRowEditor`'s header, "File attachment link (optional)")
is gone; `BLANK_REPORT`'s checklist-row shape, the payload builder, the
hydrate and `dataverseReportToSetup` all keep reading/writing it untouched,
so nothing is lost, only the editing surface. Not the same column as the
new Section Item File citation above — this was the OLD per-Section link
field the 17 Sep entries already built and are now retiring "for now,"
exactly like the parent Report Template's equivalent field earlier today.

### 20 Sep, later: Project graduates from a label-only citation to a real link, via `cr603_projects`

Per an explicit ask: refresh `lm_reportsectioncitations` (`pac modelbuilder
build -enf lm_reportsectioncitations` — this one resolves on the plural
form directly, no singular/plural guessing needed) and found a new
`lm_project` lookup column, added the same way `lm_POC`/`lm_Strategy`/
`lm_BIReport`/`lm_Task` were on 19-20 Sep. `lm_kind`'s citation-kind choice
already had `Project = 5` from the original 10-kind vocabulary (02 Sep) —
only the lookup was missing, exactly the same gap those four closed. The
table the lookup targets was given directly (`cr603_projects`), confirmed
by generating it alongside the citations table in the same modelbuilder
call (a relationship only emits when both entities are in the generation
set — the same trick documented in §6 for the 19-20 Sep lookups).

**`cr603_projects` is a large, pre-existing table (entity set
`cr603_projectses` — the same doubled-`s` publisher convention as
`cr603_chklst_departmentses`/`crd04_specialtieses`) owned by another
module**, with dozens of columns (dates, SPI/variance scoring, corporate
theme, hold/cancel workflow, a `project_` prefix in addition to `cr603_`).
Only seven are read: `cr603_projectname` (primary name), `cr603_projectstatus`
and `cr603_projectcategory` (both small governed choice lists, decoded via
new `PROJECT_STATUS`/`PROJECT_CATEGORY` maps in `dataverse.js`, codes
confirmed live), and `_cr603_region_value`/`_cr603_bu_value`/
`_cr603_department_value` (three org lookups, kept as id+formatted-name
pairs). New `fetchProjects()` mirrors `fetchStrategyPocs()`'s shape exactly.

**Wired exactly like POC**, in both files that already carry the other four
picked kinds:
- `dataverse.js`: `_lm_project_value` added to both citation reads
  (`fetchReportOccurrenceContent`'s inline select and
  `EDIT_CITATION_SELECT`), `projectId`/`projectName` added to both
  citation-mapping blocks, and `reportCitationRow()` gained
  `if(c.projectId) row['lm_Project@odata.bind'] = '/cr603_projectses(' + c.projectId + ')';`
  alongside the other four.
- `BuildReport.jsx`: `Project` moved from `LABEL_KINDS` to `PICKED_KINDS`
  (`LABEL_KINDS` is now just `['Issue']` — Project was the only other one
  left); new `fetchProjects()` call joins the existing
  POC/Strategy/BIReport/Task `Promise.all`; `citeTarget()` gained
  `c.projectName`; a new `k === 'Project'` branch in `CitePicker` — **the
  "any project filter or dropdown" half of the ask** — offers **five**
  filters (Region, Business Unit, Department, Status, Category), one more
  than POC's own picker. Region/BU/Department are derived from the fetched
  Projects themselves (same reasoning already used for POC's Region/
  Specialty/KPI filters: a filter listing a value nothing carries only ever
  empties the list); Status and Category use the full governed option sets
  instead, so every real status/category shows even where no Project
  currently uses it. `crefCls('Project')` already returned the same 'str'
  style POC/Strategy use — added when those were wired, evidently in
  anticipation of this — so no styling change was needed.

Not built: `cr603_projects` is read-only here, same as every other picked
kind (POC/Strategy/BI Report) — this app cites a Project, it does not create
or edit one.

### 20 Sep, later still: the File-column upload bug found, real fix confirmed live — it was the `content-type` header, not the base64 body

The two File-upload features built earlier today (Report Template's own
"Template file", and a Section's "Uploaded file" citation) failed on every
real attempt, with no useful reason visible until the error-surfacing fix
in this same entry made it show up: **"The request entity's media type
'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' is not
supported for this resource"** (and the equivalent for `.xls`,
`application/vnd.ms-excel`).

**Root cause: the `content-type` header was set to the file's own real MIME
type** (`file.type` from the browser's File API), but the connector's
"Upload a file or image to selected environment" action only *consumes*
one literal value — `application/octet-stream` — per its own cached
schema. Sending anything else is rejected outright by the gateway before
it ever reaches Dataverse. **The base64-encoding assumption documented
this morning was correct all along** — once the header was fixed, the
upload succeeded on the first retry with no other change.

**Fix:** `uploadFileColumn()` (`xenv.js`) now hardcodes
`'application/octet-stream'` as the header, unconditionally, and no longer
accepts a `contentType` parameter at all — the per-file MIME type
(`pendingFile.type` / `it.fileType`) was threaded all the way from the
`<input type="file">` handlers down to this call and has been removed
everywhere along that path, since nothing downstream ever needs it: the
file's real name and extension still travel correctly via the separate
`fileName` parameter, which is what Dataverse and anything downloading the
file later actually go by. **Do not reintroduce a per-file content-type
here** — it is the one thing in this whole feature that is confirmed to
break the upload.

**How this was actually diagnosed, worth repeating for the next
mystery failure:** the first two attempts to explain the reported "nothing
saved" produced no evidence either way, because the error was being
correctly thrown but only ever reported as a generic "N related row(s)
failed to save — check the console," which said nothing about a file being
involved at all. Splitting a Section Item's file-upload failure into its
own tagged error (`what: 'file upload for "<name>"'`, separate from a
row-creation failure, since by the time the upload runs the citation row
itself has already saved) and putting that failure's real `error.message`
directly in the toast — instead of just the table name — is what actually
surfaced the fix. **The same generic "N related rows failed, check
console" pattern still exists on the Meeting Template branch and on
`duplicateFrom`'s error handling** (`GovernanceApp.jsx`, the other two
`.map(e=>e.table)` toasts) — neither has been reported broken, so neither
was touched, but the same fix is one line away if either ever needs it.

Both Code App Development apps (`786c1b14…` Governance, `d61c6237…`
Leadership) rebuilt and re-pushed with this fix.

### 21 Sep: Reporting hierarchy gets a second, independent tree — Report Templates

Per an explicit ask: the existing tree (`ScreenHierarchy`, live since 20 Sep)
reads `lm_reportoccurrences` — real, generated reports, with a Child Report
citation as the edge. That is an **execution-side** fact: it says nothing
about a Template that has never been filed. The ask was to also read
**Report Templates** and their own Sections/Section Items — a **design-time**
fact — and draw a Template when it has an attached file of its own, a
Section Item citing a child Report Template, or a Section Item that itself
carries an uploaded file.

**Kept as a second tree, not merged into the first.** A Template's "child" is
a citation its author picked at design time; an Occurrence's "child" is a
citation the report actually shipped with — different claims, over different
id spaces (`lm_report_templateid` vs `lm_reportoccurrenceid`), so conflating
them into one tree would blur exactly the distinction the rest of this file
is careful to keep (see the "Annual scheduling" / occurrence-vs-template
notes elsewhere in §6). `ScreenHierarchy` now opens on a `seg-ctl` toggle —
**Occurrences** (unchanged, default) / **Report Templates** (new) — same
`.seg-ctl` class `Communication.jsx` already uses, so no new CSS.

**New reader, deliberately not `fetchReportTemplateDetail()`.**
`fetchReportTemplateHierarchyContent()` (`dataverse.js`, right after
`fetchReportOccurrenceContent()`) is three **unfiltered** bulk reads — every
Report Template, every `lm_reporttemplatecontentchecklists` row, every
`lm_reporttemplatesectionitems` row — the same "two reads, no per-record
fan-out" shape as the Occurrences side. `fetchReportTemplateDetail(id)`
(Governance Setup's per-Template editor) was **not** reused: it fans out per
Template into review chains, related KPIs/Processes and BU/Region scope rows
this view has no use for, so calling it once per Template would turn a
2-request screen open into `2 + 5×N` requests for N Templates. The Template
row itself now also selects `lm_attachementfile` (the File column;
`fetchReportTemplatesList()`, used by the Setup register, was left alone —
this is its own reader) and the checklist row now selects
`lm_checklistitemstep`, neither of which the existing Template-detail select
needed changing.

**Qualifying rule, read straight off the fetch, computed in the screen, not
the service layer:** a Template earns a node when `hasFile` is true (own
`lm_attachementfile`), or when it has ≥1 Section Item of type **Child
Template** (`lm_itemtype=4`, `lm_ChildReportTemplate` set — the edge), or
≥1 Section Item of type **File** (`lm_itemtype` null,
`lm_attachementfile` on the *item* populated — same "recognised by presence,
not a real choice value" convention `fetchReportTemplateDetail()` already
uses, see §6's "File-column upload" entries). **A cited child that does not
itself qualify is still drawn** — the edge pointing at it is real even when
it has nothing of its own — resolved by a queue that walks every
`tplChildIds()` edge outward from the qualifying set. Unlike the Occurrences
tree's `cite:`-prefixed placeholder nodes (a citation naming something with
no live row behind it), every Template-side child is a real, resolvable
Template row, because `lm_ChildReportTemplate` is a lookup with no
name-matching fallback needed.

Node badges: type (`REPORT_TYPE`) and category (`REPORT_CATEGORY`, both
already exported from `dataverse.js`) instead of the Occurrence tree's
period; a 📎 line with the stored file name when the Template's own file is
attached; a second 📎 line with a count when any Section carries a file
citation. The detail modal lists each Section's child-Template citations (by
name) and file citations (by stored name), plus a note pointing at
Governance Setup for anyone who wants to actually open the file — this
screen has no file preview/download built for it, on purpose, to keep the
change to what was asked.

⚠️ **Not yet verified against live Dataverse** — built and green against a
build only; no Report Template in DT New is known to currently have an
attached file or a child-Template citation to check the graph against.
`python scripts/undef-scan.py` flags one line in this file (`'file'` inside
a `||` fallback string) as a free identifier — checked by eye, it is the
same single-quoted-string false positive the scanner is documented to
produce, not a real bug (see §8's own note on the scanner's known limits).

**Both apps rebuilt and pushed to Code App Development with this change,
same recipe as "Deployment, settled" below** — `4912152c…` Governance and
`83db0ef8…` Leadership, the live pair, not the 17 Sep orphans. Both pushed
successfully on the **first** attempt, no `generateResourceStorage` retry
needed this time. Governance carries this change too (the shared `src/`
edit — the new `fetchReportTemplateHierarchyContent()` in `dataverse.js` —
touches the Template detail file only by adding two columns to existing
selects; nothing in Governance Setup's own screens changed).

**Report Templates made the default view, same day, per explicit ask.**
`view` initialises to `'tpl'` instead of `'occ'` — one line
(`useState('tpl')`). The Occurrences tree's own fetch was already
unconditional on mount, so nothing there changes; the Templates fetch was
already gated on `view==='tpl'`, so it now simply fires immediately instead
of on first toggle. Not yet redeployed as of this note — see whether a push
after this entry actually shipped it before assuming the running apps open
on Templates.

### 21 Sep, later: the Report Templates detail modal can now VIEW the attached file, not just say it exists

Per an explicit ask to match what Governance Setup's own Template Details
tab already does (`ReportSummary`/`SectionsBlock` in `GovernanceApp.jsx`,
built 20 Sep — see the "attached files can be READ" entry above). The detail
modal from the 21 Sep entry above used to just say a file was attached and
point at Governance Setup to go look at it; it now opens the same read-only
`FilePreview` component Governance uses, straight from `Hierarchy.jsx`.

**Reused, not reimplemented.** `src/shared/FilePreview.jsx` is already
app-agnostic — it takes `{entitySet, recordId, field, name}` and reads
through `downloadFileColumn()` in `xenv.js`, which goes through the same
cross-environment adapter every other read in this app uses. There was
nothing Governance-specific to port: the Template's own file is
`{entitySet:'lm_report_templates', recordId:<template id>, field:
'lm_attachementfile'}`; a Section's File citation is
`{entitySet:'lm_reporttemplatesectionitemses', field:'lm_attachementfile'}`
with the Section Item's own id — the exact two call shapes
`ReportSummary`/`SectionsBlock` already use, copied as-is. One piece of
state (`tplFileView`) holds whichever of the two is open, same "only one can
be open at a time, they render identically" reasoning `ReportSummary`
documents for its own `view` state; a `useEffect` clears it whenever
`tplDetail` changes, so a stale preview can't survive onto a different
Template. The preview opens as a **second, stacked** `Modal` on top of the
detail modal (matching Governance's own nested "Setup Detail → file
preview" shape) rather than swapping the detail modal's content in place —
the one known cost of that choice is that **Escape closes both** layers at
once, since each `Modal` instance registers its own listener; harmless, not
fixed, since it is the same shape Governance already ships.

⚠️ **A real regression, found and fixed in the same pass: importing
`FilePreview.jsx` collided with an existing STATIC `import * as XLSX from
'xlsx'` already in `LeadershipApp.jsx`** (the Excel-reading proof of concept
wired into `NewReportModal`'s file field, §5's 04-05 Sep entries — itself
currently unreachable from any nav path, since that modal is still the
orphaned one from 02 Sep, §7.8). `FilePreview.jsx` loads `xlsx` with a
dynamic `import()` specifically so the ~500kB library ships in its own
chunk, paid for only when a preview actually opens (documented in
`FilePreview.jsx`'s own comments, and in the "attached files can be READ"
§5 entry). Rollup cannot split a module into a lazy chunk while something
else in the same bundle imports it statically, so the two collapsed into
one addition to the Leadership app's **main** chunk — confirmed in the
build output: `747.78 kB` → `1,251.37 kB` in one JS file, plus a Rollup
`INEFFECTIVE_DYNAMIC_IMPORT` warning naming exactly this. Governance was
unaffected — it has no such static import, so its own `FilePreview` usage
(the 20 Sep entry) always split correctly, which is why this went unnoticed
until Leadership got a `FilePreview` call site too.

**Fixed by converting `readExcelComponents()`'s import to dynamic as well**
(`LeadershipApp.jsx`) — `const XLSX = await import('xlsx')` inside the
function, matching `FilePreview.jsx`'s own convention, rather than scoping
or deferring `FilePreview`'s import instead. `XLSX` was referenced nowhere
else in the file, so the top-level static import was removed outright.
Confirmed by the rebuilt output: `xlsx-DwRHmDrW.js` (492.52 kB) is its own
chunk again, and the main chunk is `757.60 kB` — roughly +10 kB over the
pre-`FilePreview` baseline (`747.78 kB`), which is `FilePreview.jsx`'s own
code, not the library.

**Deployed same day.** Both apps rebuilt and pushed to Code App Development,
same recipe, same live pair (`4912152c…` Governance, `83db0ef8…` Leadership)
— both succeeded on the **first** attempt. Confirmed in the rebuilt staging
folders before pushing: `xlsx-DwRHmDrW.js` is its own chunk in both apps'
`dist/`, not folded into the main one.

### 21 Sep, later still: the new file viewer's first real click found a live file `FilePreview.jsx` refused to open — fixed, both apps redeployed

The very first thing opened through the viewer just built was the one real
File citation in DT New — `lm_MeetingCategory (1789744418443) (1).xlsx`, the
file already named in this section's own "Live file inventory" (20 Sep). It
threw: *"This is not a readable XLSX file. 94210 bytes arrived, starting
22 30 4d 38 52 34 4b 47 78 47 75 45 — as text: `"0M8R4KGxGuEAAAA…"`."*

**Not a new bug in the double-base64 peel** — that machinery worked exactly
as designed. `"0M8R4KGxGuE…"` is the base64 text of the OLE2 compound-file
signature (`D0 CF 11 E0 A1 B1 1A E1`) — i.e. this specific file's real
content is an **old-format `.xls` (OLE2)**, not the ZIP `.xlsx` its name
promises. `decodeFile()` peeled the outer base64 layer correctly and landed
on that OLE2 header — then discarded the result anyway, because
`EXPECTED['xlsx']` only ever listed `['zip']`. The check that exists to
catch a genuinely wrong payload (§6, "Never hand unverified bytes to
SheetJS") was, here, rejecting a real, readable workbook for the sin of
being the wrong flavour of real, readable workbook.

**Fix: `EXPECTED.xlsx`/`xlsm` now accept `['zip','ole2']`, matching what
`xls`/`xlsb` already allowed.** SheetJS itself sniffs the actual container
format from the bytes and does not care what the filename claims, so there
was never a reason the signature gate should be stricter than the library it
is protecting. `docx`/`pptx` were deliberately left ZIP-only — this preview
has no old-format `.doc`/`.ppt` renderer to hand OLE2 bytes to regardless of
whether the check let them through. `MAGIC`/`EXPECTED` and their comments in
`src/shared/FilePreview.jsx` now say so explicitly, so the next person
reading this file understands why xlsx accepts two signatures instead of
assuming it's a typo.

**Verified, not just reasoned through.** `scripts/test-decodefile.mjs`
(extracts the real `decodeFile()` from the source, same convention as
every other test script in this project) gained a case built from the
literal OLE2 signature, double-encoded and named `a.xlsx` — confirms the
peel now lands on the OLE2 bytes and keeps them instead of falling back to
raw, undecoded text. All prior cases (corrupt content, base64-looking text
that must NOT be peeled, base64 of something that still isn't a zip) still
pass unchanged — the widened check only accepts more REAL container
signatures, not more content generally.

**Both apps rebuilt and redeployed** to the same live pair, same recipe,
both succeeding on the first attempt.

### 21 Sep, later again: the OLE2 fix wasn't the whole story — the Template's own file lost its NAME, not its bytes

Asked what was actually on screen rather than guessing again (the previous
entry's own stated lesson, applied immediately): what the Template's own
file showed was **"This file type cannot be shown here... `.template file`
has no viewer"** and a download that saved under a nameless extension-less
file. `.template file` is the tell — that is `extOf('Template file')`, the
literal fallback string `Hierarchy.jsx` passes to `FilePreview` as `name`
when `tplDet.fileStoredName` is empty. So the real file's stored name —
"Untitled spreadsheet (1).xlsx", per this section's own Live file
inventory — never reached the screen at all, on a Template that genuinely
has a file (`hasFile` was correctly `true`, only the *name* was missing).

**Root cause: the File column's `<column>_name` projection does not
reliably ride along on a LIST read through this connector, only on a
single-record GET.** Every other place in this app that reads a File
column's name — `fetchReportTemplateDetail()`'s Template parent AND its
Section Items — does so through a `.get(id, {...})` call, which is where
the "the name rides along once the column is selected" rule (§6,
"Dataverse File columns") was actually proven. `fetchReportTemplateHierarchyContent()`
(21 Sep, earlier entry) was the first place this app ever read a File
column through `.getAll()` instead, to keep the sweep to three flat
requests — and on a list read, `lm_attachementfile_name` simply came back
absent. The rule this file documented was correct for the case it was
tested against and silently didn't generalise to the new one.

**Fixed by recovering the name with one targeted `.get()` per row that
actually has a file** — `Lm_report_templatesService.get(t.id,
{select:['lm_attachementfile']})` for a qualifying Template,
`Lm_reporttemplatesectionitemsesService.get(it.id, {...})` for a qualifying
Section Item, both run in parallel via `Promise.all`, both wrapped so a
single failed lookup only leaves that one row's placeholder name rather
than failing the whole screen. **Still bounded by how many rows have a
file, not by how many Templates/Items exist** — the same "pay only for
what you use" reasoning the bulk sweep was built around in the first
place, so this doesn't reopen the N+1 cost `fetchReportTemplateDetail()`
was deliberately avoided for.

**§6's "Dataverse File columns" note is amended** with this list-vs-get
distinction, so the next screen that reads a File column in bulk doesn't
rediscover it the same way.

Both apps rebuilt and redeployed to the same live pair; Governance's own
bundle hash did not change (it never calls this function, so the edit was
dead-code-eliminated there) — confirmed before pushing, not assumed.

### 21 Sep, later: Calendar — MOM Due is back, the Week tab stopped showing yesterday, Decisions is half-built and waiting on a product answer

Per an explicit ask to apply more of `leadership-practice (2).html`'s Calendar
UI, specifically the Decisions/MOM Due filter chips the 15 Sep restyle pass
deliberately skipped ("re-adding it means sourcing Decision deadlines and
MOM due-dates into the calendar feed, which nobody has asked for" — someone
now has), plus a genuine bug: the Week tab showed the whole Sun–Sat range,
including days already past, unlike "This Week's Meetings" below it, which
already filtered from today.

**Week tab fixed.** `wk[0]` (the calendar week's Sunday) is always ≤ `TODAY`
by construction (`rangeBounds('week')` is always the week containing today),
so the fix is the same one-line shape "This Week's Meetings" already used:
filter `i.date>=TODAY` instead of `i.date>=wk[0]`. The heading changed from
"Week of {Sun} – {Sat}" to "{Today} – {Sat}" so it names what's actually
listed, and the subtitle/empty-state text changed to match.

**MOM Due is back, live, not seeded.** It existed once, was removed when the
Calendar went from seeded to live (its own comment said so: "MOM Due is
gone: those deadlines were derived from seeded Minutes"), and the styling
for it (`.cal-e.k-mom`, `CAL_CHIP_STYLE.purple`, `calTagColour`'s `'MOM'`
branch) was **left in place the whole time, unused** — this entry is mostly
reconnecting scaffolding, not building from nothing. New
`dvMomDueCalItem(o, hours)` (`LeadershipApp.jsx`, beside `dvReportCalItem`)
turns a Held Meeting into a calendar entry dated `addHours(o.date+' '+o.end,
hours)`. The `cal` useMemo now includes one of these for every Held Meeting
that has an end time and **no submitted Minutes yet** — the exact same test
(`m && m.submittedAt`) AG-16 scoring and the Meetings screen's own
`momOverdue` exception list already use, so all three agree by
construction. `hours` is `S.momWriteupHours`, the same **global** default
AG-16 reads — not the per-Setup `lm_momwriteuphours` column (15 Sep), which
still isn't consumed by scoring or, now, by this either (§9 already tracks
that gap; this doesn't widen or narrow it). Clicking a MOM Due entry now
opens the Meeting straight to its Minutes tab (`openDvRec`'s `'MOM'` branch
was routing to `'detail'` before — a small, related fix, not something
asked for separately).

**Decisions chip added to the UI; NOT wired to real dates — asked, not
guessed.** `CAL_KINDS`/`CAL_DOT`/`CAL_CHIP_STYLE`/`calTagColour`/
`calGridCls` all gained a `red` "Decisions" entry, and the month-grid legend
and Upcoming Deadlines list both know how to colour one — matching the
reference's red/alert dot. What's missing is the data: `wlog_decisions`
(§6) — the only live Decisions table this app reads — **has no deadline or
due-date column of any kind**. Its date fields are all backward-looking
(`createdon`, `wlog_reviewedon`, `wlog_escalatedon`,
`wlog_escalationresolvedon`); the reference's "Decision Deadline" concept
(an Approval Cycle timeout) exists only on the **seeded** Decision workflow
(`db.decisions`, Direct/Authority-Check routing, Approval Cycle steps),
which the Calendar has never read from and mixing in now would put a demo
record on a calendar otherwise built entirely from live Dataverse — the
exact seeded/live conflation this app has been careful to avoid everywhere
else (§4/§9: `wlog_decisions` was deliberately kept as "a separate live
list alongside," not merged into the seeded workflow, for this reason).
**Rather than invent a deadline this table doesn't have, asked the product
owner which real date should place a Decision on the calendar** — logged
date, escalation date, skip it, or add a real deadline column. **Answered:
skip it for now** — same "Not Applicable until the data exists" pattern
AG-10–AG-14 already use, not a rejection of the feature. The chip, legend
entry and Upcoming Deadlines colouring all stay exactly as built (harmless
and ready); only the actual wiring of `dvDecisions` into the `cal` feed is
deferred. **To finish this once a deadline column exists** (or a decision
to use `createdon`/`escalatedOn` instead): a `dvDecisionCalItem()` beside
`dvMomDueCalItem()`, and one more spread into the `cal` useMemo — everything
else is already in place and needs no further change.

**Not built, still matching the 15 Sep decision, unchanged:** the reference's
"Executive Calendar — Multi-Committee Overlay" checkbox panel — no
committee-overlay concept exists in this app's data model, and nobody has
asked for it this time either.

Both apps build clean and were rebuilt and pushed to Code App Development,
same live pair, same recipe, both succeeding on the first attempt.

### 21 Sep, later still: Business intelligence flipped from KPI-driven to BI-Report-driven, plus a month stepper

Per an explicit ask: `ScreenBI` (`screens/BusinessIntelligence.jsx`) used to
list every KPI (`strategy_kpises`) and show whichever BI report sat behind
each — so a `lm_bireportdashboards` row with **no** KPI linked to it was
never listed anywhere on this screen at all, and "N of M" counted KPIs, not
reports. It now reads `lm_bireportdashboards` directly as the primary list
(`fetchBiReportDashboards()`, already existed, just wasn't the driver
before) — every report is findable now, linked to a measure or not.

**KPIs are still read, deliberately** — not removed, repurposed. A report's
figures panel and the Process/Department filters both hang off whichever
KPI (if any) a report cites (`r.kpi`, resolved once via a `kpiById` map
rather than re-looked-up per render). What changed is which table DRIVES
the list and the "N of M" count — KPIs are now a lookup a report may or may
not have, not the thing being enumerated.

**The month filter — asked for as "navigate to previous reports or
dashboards," built as a stepper over the FIGURES, not the report list.**
`lm_bireportdashboards` has no date column of any kind (confirmed by
reading its selected columns in `dataverse.js` — `lm_reportname`,
`lm_dashboardlink`, `_lm_kpi_value`, nothing else) — a BI report/dashboard
row is an evergreen link to a live Power BI object, not a monthly snapshot,
so there is no real "previous month's report" to switch to at the row
level. The one genuinely period-shaped live data available is a linked
KPI's own achievement history (`k.ach`, keyed `'BU:period'`), which the
figures panel already read off a single hardcoded `PERIOD` (today's month)
before this change. **Built, not guessed at, but flagged as an
interpretation call**: a `←  {Month Year}  →  Now` stepper — same shape
Calendar's own month nav already uses, new local `shiftPeriod(p,n)` helper
— replaces the fixed `PERIOD` constant everywhere a report's figures are
computed (`achFor(k, bu, period)`), so "navigate to a previous month" means
seeing that month's target/actual for the KPI behind a report, not
switching to a different report. If this isn't what was meant, the stepper
and its one piece of state (`period`) are the whole surface to change.

**The old `fBi` (BI report) filter dropdown is gone** — redundant once BI
reports are the thing being listed and searched directly; the search box
already covers finding one by name. `Combo`'s KPI-search box was also
retitled "Search reports…" to match.

**Not verified against live Dataverse** — no BI report in DT New is known
to have zero KPI linked (the case this change makes visible for the first
time), so the "reports now findable that weren't before" claim is
structural/reasoned, not yet confirmed against a real example.

Both apps build clean; Governance's bundle hash is unchanged (this file
isn't part of that app). Deployed same recipe as always, both succeeding
on the first attempt.

### 21 Sep, later again: Calendar scoped to the signed-in user's own role — two new bulk role-index reads

Per an explicit ask: the Calendar tab (`ScreenCalendar`, `LeadershipApp.jsx`)
used to show every Meeting and Report Occurrence to everyone. It now shows
only what the signed-in user holds a role on — Chairman, Co-Chairman,
Organizer/Facilitator or Attendee for a Meeting; Submitter, Owner, or a
Reviewer **once the report has actually been submitted** (not while it's
still Draft), for a Report. **Scoped to this one screen on purpose** —
Workspace's own calendar-derived widgets (`CalendarWebpart`, its counts)
keep reading the unfiltered `cal` from context untouched; the ask named the
Calendar tab specifically.

**The hard part wasn't the filtering, it was finding the data to filter
on.** Chairman, Facilitator and (for Reports) Creator/Submitter are already
columns on the occurrence itself. Everything else is not:

- **A Meeting Occurrence has no Co-Chairman column at all** — confirmed by
  reading the cached connector schema (`meetingoccurrences.Schema.json`),
  not assumed: only `lm_chairmanposition`/`lm_facilitatorposition` exist.
  Co-Chairman lives only on the **Setup** — the per-unit row
  (`lm_meetingtemplatebusinessunitses`/`...regions`,
  `_lm_meetingcochairman_value`) for a scoped occurrence, or the Template's
  own parent row (`lm_meetingtemplates._lm_meetingcochairman_value`) for a
  group-wide one with neither Business Unit nor Region set.
- **A Report Occurrence has no Owner Position or reviewer of its own
  either.** Owner Position is the same either/or shape, on
  `lm_reporttemplatebusinessunitses`/`...regions`/the Template parent. The
  Review Chain is the fact already on record in §6 ("A Report Occurrence
  has no per-occurrence reviewer table... the chain is read from the
  Template for that unit") — this is the first screen other than Governance
  Setup's own editor to actually need it.

**Built as two new bulk reads, not per-occurrence fan-out**
(`fetchMeetingUnitRoles()`, `fetchReportUnitRoles()`, both in
`dataverse.js`, both returning a `{forOccurrence(o) => …}` resolver so a
caller never touches the raw maps): each is 3-4 unfiltered `getAll()`
calls — every per-unit row across every Template, every Review Chain row —
same "one flat sweep regardless of how much data exists" shape
`fetchReportTemplateHierarchyContent()` (21 Sep, earlier) already
established, and deliberately NOT `fetchReportTemplateDetail()`'s per-
Template fan-out, which would mean one extra round-trip per Report
Occurrence on a screen that can show dozens at once. The Review Chain
lookup accepts either lookup-pair Review Chain rows can be bound through
(the pre-/post-06-Sep pair, per `unitChainFilter()`'s own reasoning) so a
chain saved before that date still resolves correctly here too.

**Three scope calls worth knowing about, in case this isn't exactly what
was meant:**
- **Attendee match is a direct Position only.** A Microsoft-Group Attendee
  (19-20 Sep) is not expanded to its member list — the signed-in user's own
  Position has to be the one bound to the Attendee row directly.
- **"Submitted, not Draft" reads as `status !== 'Draft'`** — which includes
  `Returned` (was submitted, sent back for changes) as still visible to a
  Reviewer, on the reasoning that it genuinely was submitted once; only a
  report that has never left Draft is hidden from its reviewers.
- **MOM Due items are gated by the same Meeting-visibility rule**, not left
  unfiltered — a write-up deadline for a meeting the user holds no role on
  isn't treated as theirs to track either. Not separately asked for, but
  followed from the same reasoning.

**A holder of no Position sees an empty calendar, with a note saying so**
rather than a silently blank screen — `mine.size===0` (no
`dvLookup.myPositionIds`, the same match the sidebar's user card and
Hierarchy/OrgReports already use) short-circuits every item to hidden, and
a `Note` names why, distinguishing "not linked to a Dataverse user at all"
from "linked, but holds no Position." A second, narrower `Note` covers the
brief window while the two new role reads are still in flight, so the grid
doesn't flash empty before they land.

**Not yet verified against live Dataverse** — built and green against a
build only. The one thing most worth checking first: that a Co-Chairman or
a Review Chain reviewer who holds no OTHER role on an occurrence actually
sees it appear, since those two paths are the ones with no simpler
fallback to fall back on if the per-unit lookup ever comes back empty.

Both apps build clean; Governance's bundle hash is unchanged (this screen
isn't part of that app). Deployed same recipe as always, both succeeding
on the first attempt.

### 21 Sep, later yet: the OLE2 fix was right, but that specific file turned out to be password-protected — a second, different reason it couldn't be shown

Reported live, straight after the OLE2 fix went out: the same test file
(`lm_MeetingCategory (1789744418443) (1).xlsx`) now got PAST the signature
check — no more "not a readable XLSX file" — but failed one step later,
inside SheetJS itself: *"ECMA-376 Encrypted file missing
/EncryptionInfo."*

**Read the actual SheetJS source rather than guess again** (`node_modules/
xlsx/xlsx.mjs`) to find out what this really means, since a second wrong
theory in a row on the same file would have been worse than the first.
`read_cfb()` (the function SheetJS calls once it has a parsed CFB
container) branches on ONE thing: does the container have a stream literally
named `EncryptedPackage`? If yes, it assumes the workbook was saved with a
password and hands off to `parse_xlsxcfb()`, which requires a matching
`EncryptionInfo` stream to actually decrypt it — the one this file's
container is missing. **So the OLE2 signature fix (previous entry) was
correct and stays** — this file genuinely is an OLE2/CFB container, just
not the legacy-`.xls` kind that fix was written for. It is (or was) a
workbook saved with **Excel's own "Encrypt with Password" feature**, which
produces exactly this `EncryptedPackage`/`EncryptionInfo` structure. Whether
the `EncryptionInfo` stream was lost somewhere in this app's own upload/
storage/download path, or was never intact to begin with, doesn't change
the outcome either way: **a password-protected workbook was never going to
be previewable by this viewer regardless of that stream** — there is no
password prompt anywhere in `FilePreview.jsx`, by design (read-only, no
picker, no input of any kind).

**Fixed by recognising the error pattern, not by one exact string** — every
SheetJS message for this family of failure contains either
`"password-protected"` or `"Encrypted file"` (confirmed by reading every
throw site in `xlsx.mjs`, six of them, all one of those two phrasings), so
`FilePreview.jsx` tests `/password-protected|Encrypted file/i` against the
caught error and, on a match, replaces SheetJS's internal wording with an
honest, actionable one: *"This file is password-protected, so it can't be
previewed here… Download it and open it in Excel with the password."* Any
OTHER `XLSX.read()` failure still surfaces its real message, unrewritten —
this only softens the one failure mode that has an actual next step for the
person reading it.

**A real, separate gap fixed alongside it: the error view had NO Download
button at all**, for any failure, ever — only the success path could
download anything, because `bytes` was never carried into the error state.
Worth having regardless of the encryption case: a signature mismatch, a
corrupt file, or (now) an encrypted one are all still real, still-downloadable
bytes; only the in-page preview failed. `bytes` now rides on the thrown
error when available and lands in the error state; `download()`'s guard
changed from `phase==='ready'` to "do we have bytes or a url", which is the
actual precondition, not the phase name.

**Not yet verified against live Dataverse** — built and green against a
build only. Confirming this actually is (or was) password-protected means
downloading it and having Excel ask for a password; if Excel opens it
cleanly with no password, the diagnosis above needs revisiting.

### 22 Sep: "my Positions" resolved by ID through the Organization Structure, not by name match

Per an explicit ask about the Calendar's new role filter (21 Sep, above):
`myPositionIds` — which Positions the signed-in user holds, the set
everything in that filter and `dvLookup.myPositionIds` elsewhere runs off —
used to be computed by comparing `currentUser.fullName` against each
Position's already-resolved holder NAME, case-insensitively. That match is
exactly as fragile as it sounds (a shortened name, different word order, a
shared name, a stray space all silently break it) and was never the real
relationship — it was standing in for one, because `fetchPositions()` only
ever resolved the holder to a display string, never to an id.

**The real relationship was already half-built.** `cr603_organizationstructures`
(the Positions table) already carries `hr_CurrentEmployee`, resolved by
`fetchPositions()`/`fetchEmployeeIndex()` through three fallback routes
(Position → Employee, Position → systemuser directly, or the reverse
Employee → Position link) — all already existed, just to produce a NAME.
**`hr_employees` also carries `hr_User`** (title "User", `LookupType`) — not
previously read here. The most direct candidate for what it targets is
`systemusers`, the same table `fetchCurrentUser()` already resolves the
signed-in user against (`systemUserId`, via their Azure AD object id or
email) — so the same three routes now resolve a **systemuserid** in
parallel with the name, and "is this Position mine" is a plain id
comparison: `p.holderUserId === currentUser.systemUserId`.

⚠️ **`hr_User`'s target table is inferred, not confirmed** — there is no
`pac modelbuilder`/CLI access from this session to verify it the way this
file's own convention calls for. It is the only real candidate for a
`LookupType` field titled plainly "User" on an Employee record, and the
whole point of the field only makes sense if it points at `systemusers`,
but this is reasoning from shape, not a confirmed relationship. **If
`myPositionIds` ever comes back empty for someone who should hold a
Position, check this first** — either `hr_User` targets something else, or
it's simply blank on their Employee row.

**Kept as a fallback, not a replacement, for exactly that reason.** The old
name match still runs, but only when the id match finds nothing
(`myPositionIdsById.length ? myPositionIdsById : myPositionIdsByName`) — so
a signed-in user whose `hr_User` link is blank or wrong still resolves the
same way they always did, and nothing that worked before can regress from
this change alone.

**Scoped to `myPositionIds` only** — the TopBar's own separate "which
Position do I show as mine" lookup (`LeadershipApp.jsx`, the sidebar user
card) still matches by name; it wasn't part of what was asked and is a
narrower, single-Position display case rather than the "which Positions do
I hold, plural" set every role filter reads.

Both apps build clean; Governance's bundle hash also changed (it reads
`fetchPositions()` too, for its own Position pickers) — additive only,
`holder` (the name) is untouched, `holderUserId` is a new field alongside
it, so nothing there should behave differently. Deployed to Code App
Development, same live pair, same recipe, both succeeding on the first
attempt.

### 22 Sep, later: a TEMPORARY testing toggle on the Calendar — ⚠️ meant to be removed, not a feature

Per an explicit ask, framed as temporary from the start: a checkbox
("Testing: show all users' occurrences, ignoring the role filter below")
that bypasses the whole 21 Sep role filter and shows every Meeting/Report
occurrence again, exactly like before that filter existed — added so the
filter can be checked against what used to show without needing a second
Dataverse user to sign in as.

**Deliberately the smallest possible change, and marked to be easy to find
and remove later**: one `showAll` state
(`LeadershipApp.jsx`, `ScreenCalendar`), one line in the `cal` useMemo
(`if(showAll) return calAll;`, ahead of the real filter), and one `Note`
with a checkbox in the header, all three explicitly commented `⚠️
TEMPORARY`. The two "why is this empty" notes (loading / not linked to a
Position) are suppressed while `showAll` is on, since they'd be answering a
question that doesn't apply in that state. **Nothing about the role filter
itself changed** — this sits beside it as a bypass, not a rewrite; removing
the toggle later means deleting exactly the three `⚠️ TEMPORARY`-marked
spots and nothing else.

**Next session: if this is still here and nobody's said why, ask before
assuming it's still wanted** — it was asked for as scaffolding for a
specific testing pass, not a permanent feature.

### 22 Sep, later still: the Report Template's Content Checklist is now optional, not required, to publish or send for review

Per an explicit ask. `validateReport()` in `GovernanceApp.jsx` (the function
behind both the live validation panel and the `disabled={issues.length>0}`
gate on the Publish button — there is no separate "send for review" action;
Publish is what moves a Setup from Draft into Under Review) no longer raises
an issue when `s.checklist` is empty. The other half of the same check is
unchanged: a Section that exists but has no heading still blocks, since an
untitled Section saves as nothing and silently disappears.

Also updated in the same pass so the UI doesn't contradict the relaxed rule:
the `Field` for the checklist lost its `req` flag (no more red asterisk) and
its hint now says the checklist is optional for now; the old "At least one
section is required" inline error under the `SectionEditor` was removed,
while the "N section(s) have no heading" error stays.

**Scoped to validation and that one Field only** — nothing changed in how
Sections are saved, seeded, or displayed elsewhere (e.g. the Sections count
shown in summary tables). If the checklist is later meant to become required
again, or required only past a certain Stage/Category, that's a follow-up
decision, not implied by this change.

### 22 Sep, later yet: Confidentiality removed from the Meeting Setup entirely — the Report Template keeps it

Per an explicit ask — not "made optional" like the checklist above, a genuine
removal. Meeting Setup (`validateMeeting()`, `BLANK_MEETING`, all six seed
Committee/Meeting rows, the step-6 Field in `MeetingWizard`, `MeetingSummary`,
`buildMeetingTemplatePayload()`, and the Dataverse-row hydrate for
`lm_meetingtemplates`) no longer asks for, shows, saves, or reads back a
Confidentiality value. `DV_MEETING_CONFIDENTIALITY` (the local decode map)
was deleted as dead code alongside it. The Report Template side is
untouched — `validateReport()` still requires it, the wizard Field, summary,
payload builder and hydrate all still carry it.

`buildPublishSummary()`'s `addField('Confidentiality', …)` moved from the
shared section into the `isReport` branch only, since a Meeting Setup's
`confidentiality` is now always `undefined` on both sides of the diff and
would never have shown a change anyway — moving it just makes that explicit
rather than relying on it never firing.

**Deliberately left alone: `dataverse.js` and the generated schema files.**
`lm_meetingtemplates.lm_meetingconfidentiality` still exists as a column and
is still in the `$select` list and the save function's write path — nothing
in `dataverse.js` was touched, per this file's own rule that the data-service
module doesn't know about display/business concerns (see the note above
`buildReportTemplatePayload`). The practical effect: since
`buildMeetingTemplatePayload()` no longer puts `confidentiality` on the
payload it hands to `saveMeetingTemplateToDataverse`, every future save of a
Meeting Setup writes `lm_meetingconfidentiality: null` — so any of the seeded
Dataverse rows that already hold a real value (if any exist there; unrelated
to the local seed data edited here) will go blank the next time that Setup is
edited and saved, not on this change alone. If that's ever a problem, dropping
the column read/write in `dataverse.js` and the generated models is the
follow-up — not done here, out of scope for a Setup-screen change.

### 22 Sep, later still: "Dashboard" retired from the Report Type picker in Report Template Setup

Per an explicit ask ("remove the dashboard from the report setup"). Scoped to
the picker only, not the underlying choice value: `REPORT_TYPES` (`['Plan',
'Dashboard','Report']`) stays whole, since its order backs Dataverse's own
1-based choice codes (`byCode1`/`DV_REPORT_TYPE` — code 2 is still
"Dashboard" on the real table) and it still feeds the Setup Register's type
filter, so an existing Dashboard-type Template stays findable there. A new
derived constant, `REPORT_TYPES_PICKABLE` (`REPORT_TYPES` minus
"Dashboard"), feeds only the `Seg` control on the wizard's Identity step
(step 1) — that's the one place a NEW or edited Setup's Report Type is
actually chosen. `REPORT_TYPE_HELP`/`REPORT_TYPE_TAG_COLOR` (the per-value
hint text and register tag colour) were left untouched, so a legacy
Dashboard-type Template still reads correctly everywhere except that one
picker.

**Known cosmetic consequence, not fixed here:** `Seg` just diffs `val`
against `opts` to decide which button lights up — it has no concept of "the
current value isn't offered anymore." So opening an existing Setup whose
`reportType` is still `'Dashboard'` shows the Report Type control with
*no* button highlighted (Plan/Report both read as unselected), even though
`s.reportType` is still `'Dashboard'` underneath and nothing is lost until
the user clicks a different option. If that ever needs a real fix, `Seg`
already has a `locked` per-option shape (see `Seg`'s own definition) that
could show Dashboard, greyed out, only when it's the record's current value
— not built here, since no legacy Dashboard Setup was reported as an actual
problem, just the picker itself.

The local demo seed `su-8` (`reportType:'Dashboard'`) was changed to
`'Plan'` so the sample/demo data doesn't show a retired type — it still
exercises the same "no Submission Timing, Source Link delivery" path Plan
and Dashboard share, so the scenario it was written for is unaffected.

### 22 Sep, later yet again: built and pushed — Governance Setup live with all four changes above

`npm run build:governance` (`vite build`), bundle verified to still point at
IT (`org2f45e702.crm4.dynamics.com`, per §9 — no drift back to DT New),
copied over `C:\tmp\cad-gov-new\dist` (removed first, not merged — stale
hashed filenames from a prior build otherwise survive alongside the new
ones), pushed from inside that staging folder with `power-apps push`.
Printed `App pushed successfully` and the play URL — the actual sign of
success, not just an exit code (§8 already found once that a push can DNS-
fail on `generateResourceStorage` and still exit 0). Leadership Execution
was **not** built or pushed — nothing changed under `apps/leadership/` this
session.

Live now at `786c1b14-bf09-4dd7-a0a2-5730e87744fe` (Code App Development):
the Content Checklist optional-not-required change, Confidentiality removed
from Meeting Setup, and Dashboard retired from the Report Type picker — the
three entries directly above this one, all from this same session.

### 22 Sep, once more: the Report Template's destination (Channel) is also now optional, not required

Per an explicit ask, same shape as the Content Checklist entry above. The
rule dropped from `validateReport()` was: no unit's Team Channel resolves to
a destination (`!destinationOf(s)`) → blocks Publish, reported against the
first scope unit's card (`u-<key>`) since that's what `unitIssueCount()`
reads to badge a unit card. That whole check is gone — a Report Template can
now publish or go to review with no Channel chosen anywhere, so
`destinationLink` saves as `undefined`/empty. The per-unit "Destination"
Field (`u-dest-<key>`, step 4 — read-only, filled in from the Channel picked
just above it) lost its `req` asterisk and its hint now says "Optional for
now"; the empty-state placeholder text ("Choose a Channel above…") is
unchanged, it was never an error, just a prompt.

**Same open question as the checklist entry: what a destination-less,
Channel-less Report Template actually delivers to remains unaddressed** —
Team/Submitter/Owner/Review Chain per unit are all still required
(`unitRules`), only the Channel/destination itself was relaxed. If this is
meant to come back — always, or only past a certain Stage/Category — that's
a follow-up decision, not implied here.

### 22 Sep, later still: Meeting Setup's three Completion periods now default to 24h/24h/48h instead of blank

Per an explicit ask, with a screenshot of the Mandate and Agenda step's
"Completion periods" card. Only `BLANK_MEETING`'s three fields changed —
`momWriteupHours`/`momApprovalHours: null→24`, `gridSubmitHours: null→48` —
nothing about the inputs themselves, which were already plain editable
number fields (`f-momWriteupHours`/`f-momApprovalHours`/`f-gridSubmitHours`,
step 5). So a brand-new Meeting Setup now opens with 24/24/48 pre-filled
instead of empty, and — since it's the same input either way — stays exactly
as editable while first setting it up and on every later Edit of a saved
Setup, same as before this change. Verified live in the browser: a new Draft
opened with 24/24/48 showing, and typing over the first field to 36 left the
other two at their defaults.

**Deliberately not touched:** the six existing Committee/Meeting seed rows
(`su-1`..`su-6`) don't set these three fields explicitly, so they inherit
whatever `BLANK_MEETING` says — meaning the demo data's periods silently
went from blank to 24/24/48 too. Also not touched: `LeadershipApp.jsx`'s
`DEFAULT_SETTINGS.momWriteupHours/momApprovalHours/gridSubmitHours`, the
execution module's own GLOBAL defaults (still `null`) that AG-16/AG-05
scoring falls back on — this change is the per-Setup override only, per the
existing (stale-looking but accurate) comment above `BLANK_MEETING` that the
two are named identically on purpose but are separate values. The
Dataverse hydrate path (`p.lm_momwriteuphours ?? null`, etc.) was left
alone too: an already-saved Setup with no value stored still shows blank,
truthfully — the new 24/24/48 default is a NEW-Setup starting point, not a
stand-in for "no value was ever saved."

### 22 Sep, later again: built and pushed a second time — Governance Setup live with the destination and Completion-period changes too

Same procedure as the build/push entry above: `npm run build:governance`,
bundle re-checked for the IT org URL (`org2f45e702.crm4.dynamics.com`, still
the only one present), `C:\tmp\cad-gov-new\dist` replaced (not merged), then
`power-apps push` from inside that staging folder — printed `App pushed
successfully` again, same play URL, same app id
(`786c1b14-bf09-4dd7-a0a2-5730e87744fe`). Leadership Execution again not
touched.

Adds two more changes on top of the previous push: the Report Template's
destination/Channel requirement dropped (the entry two above this one), and
Meeting Setup's Completion periods defaulting to 24h/24h/48h (the entry
directly above this one). Also incidental to this session but along for the
ride in the same build: a `governance-app` entry was added to
`.claude/launch.json` (alongside the existing `leadership-app`) so the
Governance app's own dev server can be previewed directly — used once this
session to verify the Completion-periods defaults in the browser before this
push.

⚠️ **Corrected later the same session: the pre-existing `leadership-app`
entry in `.claude/launch.json` was already broken** — `"runtimeArgs":
["run", "dev"]` referenced a script that doesn't exist (`package.json` only
has `dev:leadership`), and its `"port": 3000` was also wrong: Leadership's
own `apps/leadership/vite.config.js` pins port **3001**, specifically so the
two apps never collide (Governance is 3000). Both fixed in the entry below's
session; the two configs no longer share a port and both are independently
previewable now.

### 22 Sep, later still again: Leadership's Reports/Plans data (Report Occurrences and everything under them) now reads and writes the IT environment, cross-environment from the rest of Leadership

Per an explicit ask ("make the report / plan tab ... read from the report
occurrences tables that are in the IT Env"), clarified in conversation before
building anything, since the literal ask didn't by itself decide three real
questions: **which** tab (two candidates share the exact same underlying
data — see below), whether child tables move **too**, and whether **writes**
follow reads. Answered: the "Reports / Plans" tab specifically named, but
the whole Report Occurrence tree moves together (parent + children), and new
Report Occurrences created from Leadership write to IT too, not just reads.

**Why "which tab" was a real question, not a formality:** `dvReportOccs` is
ONE shared array, fetched once in `LeadershipApp.jsx` (`refreshOccurrences()`)
and consumed by Work Queue, Calendar, Home stats, Communication,
`BuildReport.jsx` ("Build a report/plan" — label text closer to the literal
ask than "Reports / Plans"), `Hierarchy.jsx`, and `OrgReports.jsx` ("Reports /
Plans" itself, the tab actually named in the answer). There is no
per-screen data source in this codebase — repointing "just one tab" was
never actually on the table without forking the fetch into two inconsistent
copies, which nobody wanted. So functionally this is a data-layer change:
every one of those consumers now sees IT's Report Occurrences, not DT New's.

**What changed, mechanically:**
- `src/services/xenv.js` — `dvTable(entitySet, pkField, org = DATA_ORG)`
  gained a third parameter. Every one of its five methods (`getAll`, `get`,
  `create`, `update`, `delete`) and the `fail()` helper's error message now
  use this per-call `org` instead of always closing over the module-level
  `DATA_ORG` constant. Fully backward compatible — every existing call site
  that omits the third argument behaves exactly as before. A new exported
  constant, `REPORT_OCCURRENCE_ORG = 'https://org2f45e702.crm4.dynamics.com'`
  (the same IT org Governance Setup already moved to, §9), sits next to
  `DATA_ORG` with a comment explaining it's a no-op for Governance (its own
  `DATA_ORG` already equals this) and a deliberate divergence for Leadership.
- `src/services/dataverse.js` — the five tables that make up a Report
  Occurrence now pass `REPORT_OCCURRENCE_ORG` as `dvTable()`'s third
  argument: `Lm_reportoccurrencesService` (`lm_reportoccurrences`),
  `Lm_reportoccurrencehistoriesService` (`lm_reportoccurrencehistories`),
  `Lm_reportoccurrencesectionsesService` (`lm_reportoccurrencesectionses`),
  `Lm_reportsectioncitationsesService` (`lm_reportsectioncitationses`), and
  `Lm_reportoccurrencesharesService` (`lm_reportoccurrenceshares`). Every
  function built on these — `fetchReportOccurrences`,
  `fetchReportOccurrencesByTemplate`, `fetchReportOccurrenceContent`,
  `fetchReportOccurrenceForEdit`, `saveReportOccurrenceContent`,
  `createReportOccurrence`, `updateReportOccurrenceFile`,
  `fetchReportOccurrenceHistory`, `submitReportOccurrence`,
  `shareReportOccurrence`, the approve/reject/return-for-revision writers —
  now targets IT, both reads and writes, with zero changes to their own
  bodies. `dataverse.js` is shared by both apps, so this is app-agnostic by
  construction: it fires wherever either app calls these functions.
- **Deliberately unchanged:** every Meeting-side table, including
  `lm_meetingoccurrences` itself and `lm_meetingoccurrencelinkedreportses`
  (a Meeting Occurrence's own child table of links to Report Occurrences).
  Both still follow whichever app's own `DATA_ORG` is building — DT New for
  Leadership. `fetchReportOccurrencesByTemplate` (used by Governance's Usage
  tab, §9) needed no change at all: Governance's `DATA_ORG` already equals
  `REPORT_OCCURRENCE_ORG`.

⚠️ **New cross-environment inconsistency this creates, not fixed here:**
`lm_meetingoccurrencelinkedreportses` rows are created in DT New (their
parent Meeting Occurrence's org) carrying `lm_ReportOccurrence@odata.bind`
pointing at a `lm_reportoccurrences` GUID — which, for any Report Occurrence
created AFTER this change, now exists only in IT, not in DT New. A Dataverse
lookup bind cannot cross environments; linking a DT-New Meeting Occurrence
to a newly-created (IT-resident) Report Occurrence via
`linkMeetingOccurrenceReport()`/`attachReportOccurrenceToLink()` will very
likely fail once tried against live data, since DT New has no row under that
id to bind to. Not investigated further or worked around — flagged for
whoever hits it, since fixing it means deciding how (or whether) a
Meeting-side table can reference an IT-side row at all.

**Verification limitation, worth being explicit about:** this change could
not be confirmed against live data through the browser-pane dev preview.
Opening `leadership-app` and navigating to Reports / Plans left it stuck on
"Reading reports…" indefinitely. To rule out a regression, `window.__xenvPreflight()`
was called directly from the browser console against Leadership's own,
UNCHANGED home org (DT New, no IT override at all) and it **also** hung
past an 8-second timeout — proving the Dataverse connector bridge doesn't
resolve AT ALL in this bare `vite` dev-server preview, independent of this
change entirely. (§8 already documents that real local verification needs
`npx power-apps run`, the actual Power Apps player, not a bare dev server —
this is presumably the same underlying limitation.) So this change is
verified by construction (syntax-checked, and mechanically identical to the
Governance→IT pattern §9 already confirmed live) but was **not** confirmed
against real IT data end-to-end through the dev preview — see the build/push
entry directly below, which is the first real (deployed) test of it.

### 22 Sep, once more: both apps built and pushed together — first real-environment test of the Report Occurrence cross-environment change

Per an explicit ask, no app named — built and pushed **both** this time,
since the entry above touched `src/services/xenv.js` and
`src/services/dataverse.js`, shared by both apps (a no-op rebuild for
Governance, a live functional change for Leadership). Same procedure as
every push this session: `npm run build:governance` then
`npm run build:leadership`, each bundle grepped for org URLs before
deploying — Governance's `index-*.js` contains **only**
`org2f45e702.crm4.dynamics.com` (IT), Leadership's contains **both**
`org2f45e702.crm4.dynamics.com` (IT — the Report Occurrence tree) **and**
`org319b4ea9.crm4.dynamics.com` (DT New — everything else), confirming the
split compiled the way §5's entry above describes. `dist/` replaced (not
merged) in both staging folders, `power-apps push` from each —
`C:\tmp\cad-gov-new` printed `App pushed successfully` for
`786c1b14-bf09-4dd7-a0a2-5730e87744fe`, then `C:\tmp\cad-exec-new` printed
the same for **Leadership**, `d61c6237-fec1-45c7-80e0-a9c63dd1e662` — the
first time Leadership Execution has been pushed in this file's session
narrative; every prior push this session was Governance only.

This is the first opportunity for the Report Occurrence cross-environment
read/write to run against real Dataverse rather than the non-functional
bare dev-server preview documented in the entry above — worth checking
Reports / Plans, Build a report/plan, Work Queue and Calendar in the live
Leadership app for whether IT's Report Occurrences actually appear, and
whether the `lm_meetingoccurrencelinkedreportses` cross-environment bind
problem flagged above actually manifests. Neither was confirmed here; this
entry only confirms the push itself succeeded.

### 22 Sep, yet again: the Reporting hierarchy's "Report Templates" view — and the whole Report Template family behind it — also now reads/writes IT

Per an explicit ask ("in the reporting hierarchy tab... read from the Report
templates tables from the IT Env"). Less ambiguous than the Report
Occurrence ask two entries above — only one screen matches ("Reporting
hierarchy" → the **Report Templates** tree, `Hierarchy.jsx`'s `seg-ctl`
toggle added 21 Sep, backed by `fetchReportTemplateHierarchyContent()`) and
Leadership never WRITES to a Report Template (only Governance Setup does),
so neither of the two clarifying questions asked for the Occurrence case
applied here — no AskUserQuestion this time.

**`xenv.js`'s `REPORT_OCCURRENCE_ORG` renamed to `IT_ORG`, its comment
rewritten to describe both table families it now names**, since a Report-
Occurrence-flavoured name no longer fit a constant also used for Report
Templates. Purely a rename — a project-wide `sed` across
`dataverse.js`, no behavioural change to the five call sites already using
it.

**Every Report Template table in `dataverse.js` now pins `IT_ORG` as
`dvTable()`'s third argument** — not just the three
`fetchReportTemplateHierarchyContent()` reads (`lm_report_templates`,
`lm_reporttemplatecontentchecklists`, `lm_reporttemplatesectionitemses`),
but the full family: `lm_reporttemplatebusinessunitses`,
`lm_reporttemplateregions`, `lm_reporttemplatedepartmentfunctions`,
`lm_reporttemplaterelatedkpises`, `lm_reporttemplaterelatedprocesseses`,
`lm_reporttemplatereviewchains` too. Same reasoning as the Report Occurrence
family: Governance Setup's own `DATA_ORG` already equals `IT_ORG`, so
pinning ALL of them is a no-op for Governance (the only thing that ever
writes to a Report Template) and makes every OTHER reader consistent, not
just the one screen asked about — in particular
`fetchReportTemplatesList()` (shared, feeds Leadership's app-wide Template
name lookup and BuildReport's approved-Template picker, `LeadershipApp.jsx`)
also now resolves its per-row Business Unit/Region scope sub-queries against
the org the ids actually belong to, instead of silently returning empty
scope arrays against DT New for every row (harmless before — Leadership
never displayed that scope data — but wrong regardless, and now correct for
free). `fetchReportTemplateDetail()`'s full per-Template fan-out (review
chains, related KPIs/Processes, department/functions) is Governance-only
and untouched in behaviour, just explicitly pinned rather than implicitly
correct through Governance's own `DATA_ORG`.

**No new cross-environment risk analogous to the Meeting-linked-report one
flagged above** — Report Templates are exclusively authored by Governance
Setup, which writes every one of these tables to IT already; there is no
DT-New-resident parent row anywhere in this family the way
`lm_meetingoccurrencelinkedreportses` has one on the Meeting Occurrence
side. Both apps rebuilt clean; Governance's bundle still contains only the
IT org URL, Leadership's contains both. Not yet built and pushed as of this
entry — see whether a push after it actually shipped this before assuming
the live apps have it.

### 22 Sep, later: a Position's holder name now reads Organization Structure's own `hr_fullnameofcurrentemployee` column directly

Per an explicit ask. `fetchPositions()` (`dataverse.js`) used to compose the
name shown under a Position dropdown by cross-referencing `hr_employees`
(and, as a further fallback, `systemusers`) off the Position's
`hr_CurrentEmployee` lookup — three routes, documented above
`fetchEmployeeIndex()`. Organization Structure (`cr603_organizationstructures`)
turns out to already carry the composed name itself: **`hr_fullnameofcurrentemployee`**
("Full Name of Current Employee"), confirmed in both apps'
`.power/schemas/dataverse/organizationstructures.Schema.json` as a real
`StringType`, read-only column — **not** a `VirtualType` synthetic
display field like `cr603_positionname` (the one Dataverse already refuses
on a plain `$select`, see the note a few lines above this one), so selecting
it directly is safe.

Added to `fetchPositions()`'s `$select`, and now the **primary** source for
`holder` — the old three-route resolution stays, but only fires when this
column comes back blank for a row. **`holderUserId` is unchanged, still
built the old way**: Organization Structure has no equivalent "current
employee's systemuserid" column to read directly, and `holderUserId` is
what "is this Position mine" compares against the signed-in user's own id
(§6, "22 Sep: 'my Positions' resolved by ID") — nothing about that
resolution was touched, and `fetchEmployeeIndex()`/`fetchUserNameMap()` are
still called on every read for exactly that reason, even though they're now
a fallback rather than the primary route for the name. Both apps rebuilt
clean.

### 22 Sep, later still: built and pushed a third time — both apps live with the Report Template cross-environment pin and the Position holder-name column

Same procedure as every push this session: `npm run build:governance` then
`npm run build:leadership`, each bundle re-checked for org URLs (Governance:
only `org2f45e702.crm4.dynamics.com`; Leadership: both that and
`org319b4ea9.crm4.dynamics.com`), `dist/` replaced in both staging folders,
`power-apps push` from each — `App pushed successfully` for both,
`786c1b14-bf09-4dd7-a0a2-5730e87744fe` (Governance) then
`d61c6237-fec1-45c7-80e0-a9c63dd1e662` (Leadership), same app ids as every
prior push this session.

Ships the two entries directly above: the Report Template family's `IT_ORG`
pin (Reporting hierarchy's "Report Templates" view, and every other
Leadership reader of Report Template data) and `fetchPositions()` reading
`hr_fullnameofcurrentemployee` directly. Also noticed in passing while
checking `git status` before this build: `apps/governance/vite.config.js`'s
IT-org `__DATA_ORG__` change (§9) has since been committed
(`314cda2 update the env source and the governance app`), outside this
file's own session narrative — it no longer shows as a working-tree
modification, which is expected and not a sign anything reverted.

### 22 Sep, later: `and_teamschannellinks` wired in for the Team/Channel picker — read side only, on purpose

Per an explicit ask: a newly-registered table, uploaded to IT by the user,
meant to read Team and Channel into Meeting/Report Setup instead of the old
`and_teamschannels`. **Schema pulled live before writing anything** —
`pac modelbuilder build -enf and_teamschannellink` against the `andalusiaEnv`
auth profile (already pointed at IT) — the established rule in this file
about never guessing a column name paid off again: the real columns are
`and_teamname`, `and_teamobjectid`, `and_channelname`, `and_channelobjectid`,
`and_channellink`, `and_documentlibrary`, `and_rootfolder`,
`and_rootfolderlink`, `and_rootpath`, `and_roottype`, `and_sharepointsitelink`,
and a lookup `and_planchannel` (target entity not identified, not needed for
this ask). Entity set: `and_teamschannellinks`. PK:
`and_teamschannellinkid`.

**Asked and answered before writing code, because guessing wrong here
breaks every future Setup save:** does `lm_TeamChannel` (the lookup column
the per-unit Channel picker actually binds to on save) already target the
new table in Dataverse? **No — not yet, that's a separate, later step.**
So this change is deliberately **read-only**: `fetchTeamsChannels()`
(`dataverse.js`) now reads `and_teamschannellinksService` instead of
`and_teamschannelsService` (the old table's service const removed, fully
replaced per the same answer), but every `lm_TeamChannel@odata.bind` write
site — nine of them, across Meeting and Report Template save/create/update —
is untouched and still targets `/and_teamschannels(id)`.

**⚠️ Known consequence, accepted on purpose for now:** picking a Channel in
either wizard now shows rows from `and_teamschannellinks`, whose ids don't
exist in `and_teamschannels` at all. Saving a Setup with a Channel chosen
will very likely fail (or bind to nothing) until `lm_TeamChannel` is
repointed to the new table in Dataverse — a step the user described as
coming later, not done here. Until then, this wiring is display/selection
only.

**One mapping is a best guess, flagged for when real data exists to check
it against:** the old table's `lm_sharepointsitepath`/`lm_documentlibrary`/
`lm_folder` (joined by `channelPath()` in `GovernanceApp.jsx` into the
Report destination path) map onto the new table's `and_rootpath`/
`and_documentlibrary`/`and_rootfolder` — chosen because `and_rootpath` reads
as the closest name-match to "site path" among the new table's several
path/link-shaped columns (`and_rootpath`, `and_sharepointsitelink`,
`and_rootfolderlink`), not confirmed against a populated row. `and_teamname`/
`and_channelname`/`and_channellink`/id are direct, unambiguous matches — no
guessing there. `and_teamobjectid`/`and_channelobjectid` (the real
Teams/Graph object ids the old table never had) are read but not used by
anything yet.

Both apps rebuilt clean.

### 22 Sep, later still: built and pushed a fourth time — both apps live with and_teamschannellinks wired in (read-only)

Same procedure as every push this session: `npm run build:governance` then
`npm run build:leadership`, each bundle re-checked for org URLs (Governance:
only IT; Leadership: both IT and DT New), `dist/` replaced in both staging
folders, `power-apps push` from each — `App pushed successfully` for both,
same two app ids as every prior push this session
(`786c1b14-bf09-4dd7-a0a2-5730e87744fe` Governance,
`d61c6237-fec1-45c7-80e0-a9c63dd1e662` Leadership).

Ships the entry directly above: the Team/Channel picker in both wizards now
reads `and_teamschannellinks` live. **Still read-only** — `lm_TeamChannel`
itself has not been repointed, so picking a Channel and saving will very
likely fail until that lookup is updated in Dataverse, a step described as
coming later, not done here or in this push.

### 23 Sep: full schema refresh against IT, and the Team/Channel lookup finally repointed

Per an explicit ask ("refresh all the tables that are on the IT environment
... added columns, changed datatypes, changed lookups source"). All **57**
tables the apps reach through `dvTable()` were regenerated with
`pac modelbuilder build --environment <org> --entitynamesfilter <57 names>`
against **both** IT and DT New, and compared. Report:
**`IT-SCHEMA-REFRESH.md`** (repo root).

⚠️ **`--environment` takes the target directly** — there is no need for
`pac org select`, so the active auth profile is never disturbed. The profile
still points at DT New, and the doc's mention of an `andalusiaEnv` profile is
stale: `pac auth list` shows one UNIVERSAL profile only.

**The finding that mattered, and why the obvious method missed it.**
`lm_TeamChannel` has been repointed to `and_teamschannellink` — in **BOTH**
environments. So an environment-vs-environment diff reports *no difference*
while every `lm_TeamChannel@odata.bind` write in both apps is wrong. It only
surfaces when the live schema is compared against **what the code writes**.
⚠️ Two different questions, and only one of them was being asked:

| Question | Method | Found |
|---|---|---|
| What differs between IT and DT New? | modelbuilder both, diff | 3 absent tables, 36 app-owned columns |
| What does the code now get wrong? | live schema vs `dataverse.js` | **the repointed lookup** |

**Fixed:** all nine `lm_TeamChannel@odata.bind` sites now target
`/and_teamschannellinks(...)`. This completes the migration the 22 Sep entry
deliberately left half-done (read side only). `fetchTeamsChannels()` already
returned `and_teamschannellinkid` as its `id`, so a newly picked Channel
carries a new-table id and now binds correctly.

⚠️ **Old rows are not repaired.** The two tables share no ids, so any Setup
saved before this carries an `and_teamschannels` id in a lookup that no longer
targets that table. Those need their Channel re-picked.

**Other real differences (IT vs DT New):**
- **Absent from IT:** `lm_approvalcycle`, `lm_approvalcyclestep`,
  `lm_authoritymatrixrow`. `wlog_decision` **now exists** in IT, contradicting
  the 22 Sep note in decision 9 — a leaner version, without the `pms_*` family
  DT New carries.
- ⚠️ `lm_meetingoccurrencedepartmentfunction` in IT has **no**
  `lm_departmentname` / `lm_functionname`, and the code selects both. One
  unknown column fails the whole query. Meeting-side, so DT New today — this
  becomes a live break if Meetings ever follow Reports to IT.
- `lm_reportoccurrence` in IT has no `lm_attachementfile` and no
  `lm_teamchannel`. Neither is selected, so nothing breaks, but the paused
  occurrence-file work (§7.6) has nowhere to store a file in IT.
- `lm_attachementfile` is selected only on `lm_report_templates` and
  `lm_reporttemplatesectionitemses`; IT has it on both. Consistent with the
  file viewer working there.

⚠️ **Datatype changes could NOT be verified, and the first attempt was
worthless.** Comparing IT's C# against the committed TS models produced 98
"differences" of which ~94 were representation artifacts — the TS generator
renders Guid, DateTime and lookup all as `string`. Same-generator comparison
gives 0 type differences. But modelbuilder's C# **cannot express a max-length
or precision change** either: text widened 100 -> 2000 is `string` on both
sides. If a datatype was changed, name the column and it can be checked
directly.

**Three traps hit while doing this, all worth knowing:**
1. ⚠️ **A relationship is only emitted when BOTH entities are in the
   generation set.** The first run omitted the retired `and_teamschannel`, so
   the lookup comparison silently skipped the one column that mattered. §6
   already records this rule; it still cost a run.
2. ⚠️ **modelbuilder cases the generated class from the entity's schema name**,
   which differs harmlessly between orgs (`cr603_chklst_departments` vs
   `cr603_chklst_Departments`) — 12 false "repointed lookup" rows until the
   comparison was made case-insensitive.
3. ⚠️ **`public virtual` on every OptionSet property.** A property regex
   without it makes every choice column look absent — 40-odd false "this
   column is gone" findings.
4. ⚠️ The **CRLF trap in §8 caught me again**: a table list written by Python
   on Windows made all 54 generated entities look missing. `tr -d '\r'`.

### 23 Sep, later: Business Units filtered app-wide to HR-tagged rows only

Per an explicit ask ("filter from the tables BUs that have the application
tag of HR"). `fetchBusinessUnits()` (`dataverse.js`) is the **one** shared
function every Business Unit picker in both apps calls — Meeting/Report Setup
scope pickers, the Setup Register's BU filter, KPI/Process department→BU
resolution (`deptInBu()`) — so this is an app-wide narrowing, not a
single-screen change. **Confirmed live against IT before writing anything**:
`cr603_application_tag` is a multi-select Choices column, and **15 of the 36
IT Business Units carry the `HR` tag** (queried directly via `pac org fetch`,
not assumed).

**Read via the FormattedValue annotation, not a raw OData filter.**
`cr603_application_tag` comes back from `getAll()` as
`cr603_application_tag@OData.Community.Display.V1.FormattedValue` — a
`"; "`-joined label string, e.g. `"Onboarding; HR; Laptop"` — the same
annotation-over-hand-kept-code-map convention this file already uses for
every other choice column (`FV`, `dataverse.js`). `fetchBusinessUnits()` now
selects the raw column (to trigger the annotation) and filters rows whose
split, trimmed label list includes exactly `'HR'`. A server-side
`Microsoft.Dynamics.CRM.ContainValues` OData filter would also work but
nothing in this app has exercised that syntax against this connector yet —
client-side matching on a label this codebase already knows how to read is
the safer default, consistent with how this file has repeatedly chosen the
already-proven route over an untested one.

⚠️ **The cached legacy schema's enum for this column is stale.** The 13
values recorded in `apps/*/.power/schemas/dataverse/businessunits.Schema.json`
(`OVR, Biomedical, checklist, Onboarding, Project, Customer feedback,
Clinical Governance, HR, KSA Medical Audit, EGY Medical Audit, DTM, Services
Hub, Planning System`) do **not** match what IT actually returns — live rows
also carry `AHBS Requests` and `Laptop`, neither of which is in that cached
list. Harmless for this change (label-string matching doesn't care about the
full enum), but worth knowing before trusting that cached file for this
column again — same lesson §5's "23 Sep: full schema refresh" entry just
drew for other tables, now confirmed here too.

⚠️ **Consequence, not yet checked against real data:** an existing Setup
already scoped to a non-HR Business Unit keeps its saved lookup — nothing is
deleted — but that BU no longer appears in the picker, so re-opening such a
Setup will show the BU field as unselected, same "unlisted current value"
behaviour already documented for the 22 Sep Dashboard-retirement change.
Whether any live Setup is actually scoped to a non-HR BU has not been
checked.

Both apps rebuilt (`npm run build`), bundle org URLs verified unchanged
(Governance: IT only; Leadership: IT + DT New, matching every prior push this
session) before deploying — `dist/` replaced in both staging folders,
`power-apps push` from each, `App pushed successfully` for both,
`786c1b14-bf09-4dd7-a0a2-5730e87744fe` (Governance) then
`d61c6237-fec1-45c7-80e0-a9c63dd1e662` (Leadership), same two app ids as
every push this session.

### 23 Sep, later: Reporting hierarchy's file preview 404'd on a real file — `downloadFileColumn()` had no org override, unlike `dvTable()`

Reported live, with a screenshot: opening a Report Template's attached file
from Leadership's Reporting Hierarchy → Report Templates view threw *"Entity
'lm_Report_Template' With Id = ... Does Not Exist"* — on a Template that was
visibly right there in the list the same screen had just rendered.

**Root cause: `downloadFileColumn()` (`xenv.js`) always closed over the
module-level `DATA_ORG`, with no per-call override.** Every other cross-org
reader in this file (`dvTable()`) already takes an optional `org` argument —
this is what let the Report Template family move to `IT_ORG` on 22 Sep in the
first place (§9). `downloadFileColumn()` was the one exception: it was built
before that split existed and nobody had opened a Report-Template-family file
preview from **Leadership** until this click, since Governance's own
`DATA_ORG` already equals `IT_ORG` and never exposed the gap. The list read
(`fetchReportTemplateHierarchyContent()`) already correctly targets IT, so
the row existed and rendered — the file-preview call then queried Leadership's
own home org (DT New) for that same id, which genuinely has no row under it.

**Fixed the same way `dvTable()` already solves it**: `downloadFileColumn(entitySet,
recordId, fieldName, org = DATA_ORG)` gained a fourth parameter,
`FilePreview` (`src/shared/FilePreview.jsx`) gained an optional `org` prop
(added to its data-fetching `useEffect`'s dependency array too, so a changed
org actually re-fetches) and passes it straight through, and `Hierarchy.jsx`'s
two `setTplFileView({...})` call sites (the Template's own file, and a
Section Item's file citation) now both set `org: IT_ORG` explicitly, importing
it from `xenv.js`. Governance's own `<FilePreview>` call site
(`GovernanceApp.jsx`) passes no `org` at all — the new parameter defaults to
`DATA_ORG`, which already equals `IT_ORG` there, so it is unaffected by
construction, not by a second code path.

**Verified before pushing, not just reasoned through**: `npm run build`
clean on both apps, then `scripts/undef-scan.py` run against the corrected
local path (the checked-in script's `ROOT` is still hardcoded to a different
machine's path — see §9's checklist) — the only two hits are both
already-known false positives (`domain.jsx`'s "Issue" is prose inside label
strings; `Hierarchy.jsx`'s "file" is the pre-existing `||'File'` fallback
string this section's own 21 Sep entry already documents), nothing new from
this change. Bundle org-URL counts checked before deploying, same as every
push this session. Both apps rebuilt and pushed, `App pushed successfully`
for both, same two app ids as every push this session.

⚠️ **`uploadFileColumn()` (the write side) has the identical gap — no `org`
parameter — left unfixed here.** Out of scope for this bug: only Governance
Setup ever uploads a file, and Governance's `DATA_ORG` already equals
`IT_ORG`, so there is no live path that exercises the gap today. Worth
fixing the same way if a write-side cross-environment need ever appears.

### 23 Sep, later: a full lookup audit of Report/Meeting Template saving — one real bug found, everything else confirmed correct

Per an explicit ask to "make sure all lookups are correct." Every
`@odata.bind` write in both Template families' create, update and reconcile
paths was cross-checked against the **live** schema — not the cached files,
not assumption — via a single `pac modelbuilder` sweep of all 27 tables in
both families together (so every relationship between any two of them would
actually emit; see §6's own note on that rule). The generated `.cs` files'
`GetRelatedEntity<TargetClass>(...)` calls were parsed into a script-built
map of every lookup property → its real target table, then checked by hand
against every write site in `dataverse.js`.

**Result: everything is correct, with two things that looked like bugs and
verified as intentional:**
- `lm_Meetingtemplate` (lowercase "t") on `lm_meetingtemplatedepartmentfunctions`
  — confirmed live to be genuinely how that one column is spelled, not a typo
  (every other Meeting Template child table uses the standard `lm_MeetingTemplate`
  casing for the identical concept).
- Three different spellings of "Speciality" across three tables
  (`lm_Speciality` on the BU unit table, `lm_ReportSpecialty` on the parent,
  `lm_ReportSpeciality` on the Region unit table) — each matches its own
  table's real column name exactly; §6 already flagged this as intentional
  before this audit, now independently re-confirmed.

**One real bug, found and fixed in the same pass: a group-wide (Stage 3/4)
Meeting Setup's Team Channel was silently never saved.** The wizard's
Channel picker renders identically for a group-wide unit card as a BU/Region
one (`UnitSetup` has no scope-level gate on it) — but
`meetingTemplateParentPayload()` only ever bound Category/Chairman/Co-Chairman/
Facilitator for the group-wide case, never `lm_TeamChannel`, even though the
column exists on `lm_meetingtemplate` and the Report Template side already
handles the identical case correctly. Three-part fix, mirroring exactly how
the Report Template side already does it:
- **Write**: `meetingTemplateParentPayload()` now binds
  `groupUnit?.channelId` to `lm_TeamChannel@odata.bind`.
- **Read select**: `fetchMeetingTemplateDetail()`'s parent `$select` was
  missing `_lm_teamchannel_value` entirely — it had nowhere to read its own
  value back from, on top of never writing it.
- **Hydrate**: `dataverseMeetingToSetup()`'s `groupUnits` mapping hardcoded
  `channel:null, team:null` instead of reading the parent row, same shape the
  Report Template hydrate already used correctly.

Both apps rebuilt, bundle org URLs re-checked (Governance IT-only, Leadership
both), pushed — `App pushed successfully` for both,
`786c1b14-bf09-4dd7-a0a2-5730e87744fe` (Governance) then
`d61c6237-fec1-45c7-80e0-a9c63dd1e662` (Leadership), same two app ids as
every push this session.

### 23 Sep, later still: a second, bigger group-wide gap found chasing the first — group-wide Meeting Setup Attendees were also silently discarded

Asked directly what else was missing after the Channel fix above. Tracing
the same "does the wizard render this for a group-wide unit, and does the
save path actually handle it" question found a second, more structural gap:
`createMeetingTemplateChildren()`'s per-unit loop was a strict
`if(bu)...else if(region)...else{ console.warn(...); continue; }` — for
`stageLevel==='group'` it always hit the `else`, logging a console warning
**only a developer would ever see** and skipping the Attendees sub-loop
entirely. The Attendees picker (`AttendeeList`) renders for a group-wide
unit card exactly like a BU/Region one, so anything typed in there was pure
UI theatre — never reaching Dataverse.

**Bigger than the Channel fix because there is no per-unit row to key
off.** `lm_meetingattendeeslists` already carries a direct `lm_MeetingTemplate`
lookup (bound unconditionally on every attendee row regardless of scope), so
a group-wide attendee *can* bind straight to the template with no per-unit
lookup at all — but nothing filtered for that shape on read, and the
update path's reconcile-vs-flat-list split (`reconcileMeetingUnits()` only
ever handles `'bu'`/`'region'`) had no bucket for it either.

**Four-part fix:**
- **Write** (`createMeetingTemplateChildren`): added a real `'group'` branch
  that falls through to the Attendees loop with `unitBind`/`unitLookupField`
  left `null` — a shape the loop already tolerated, just never reached.
  `opts.skipUnits` (which fully skipped the loop before) now only gates the
  `'bu'`/`'region'` branches specifically, so group-wide attendees are never
  accidentally skipped on an update.
- **Update**: group attendees are deleted-then-recreated on every edit — the
  same treatment every other *flat* list already gets (agenda, department/
  function lines, supportive functions, linked reports), not the
  reconcile-by-diff treatment BU/Region attendees get, since there is no
  stable per-unit row for them to diff against.
- **Read** (`fetchMeetingTemplateChildIds()` *and* `fetchMeetingTemplateDetail()`):
  both gained a query for attendees where **both** per-unit lookups are
  `null` — that combination is what identifies a group-wide row, since
  there's no unit row for it to point at.
- **Hydrate**: `coreMembers:[]` → `coreMembers:(detail.groupAttendees||[]).map(attendeeToRow)`,
  the same mapper the BU/Region hydrate already uses.

Traced by hand through three scenarios before building: a brand-new
group-wide Setup, editing an existing one (add/remove an attendee), and a
BU/Region Setup (confirmed unaffected — the pre-existing `skipUnits` guard on
those two branches is untouched). Both apps rebuilt, bundle org URLs
re-checked, pushed — same two app ids as every push this session.

### 23 Sep, once more: `lm_dayofweeks` — a Fixed day / Multiple days toggle for Weekly and Twice Weekly, on both Setup kinds

Per an explicit ask, about a column the user had just added in Dataverse.
**Confirmed live before writing anything, not assumed from the name** — a
first `pac modelbuilder` pull looked alarming: `lm_dayofweeks` (a new
multi-select Choices column, present on both `lm_report_templates` and
`lm_meetingtemplates`) is bound to the org's **"Days of Month" global choice
set** (`lm_daysofmonth`, values `1`..`31`, 124330000-based codes) — not a
weekday list, unlike the existing `lm_SecondDayoftheWeek` column right next
to it on both tables, which correctly uses the org's real `lm_weekdays` list
(`Sunday`..`Thursday`). Flagged this to the user as looking like a
maker-portal mix-up before building anything — **confirmed intentional**:
there are genuinely two separate, parallel ways to name a Weekly/Twice
Weekly Setup's day(s) — a single fixed weekday (existing behaviour,
untouched), or several **numbered** days (not weekday names) from this new
column, capped at 4 for Weekly and 8 for Twice Weekly.

**What was built**, all in `CadenceFields` (shared by both wizards) unless
noted:
- A `Seg` toggle, **Fixed day / Multiple days**, shown only when Frequency is
  Weekly or Twice Weekly. Switching it clears whichever side just went
  inactive (`dayOfWeek`/`secondDayOfWeek` vs `dayOfWeeks`), so a save can
  never carry a stale value from the mode not currently shown.
- Fixed day mode is **pixel-for-pixel the pre-existing UI**, just now gated
  behind the toggle instead of always shown.
- Multiple days mode is a new checkbox grid, `1`..`31` (`DAY_NUMBERS`),
  using the existing-but-previously-unused `Checks` component (defined,
  never called, until now) — gained an optional `max` prop for this: a box
  past the cap is disabled, not silently ignored on click. New
  `.chk.disabled` rule in `theme.css`.
- **Mode is inferred on hydrate, not stored** — there is no new "which mode"
  column, so `dataverseReportToSetup()`/`dataverseMeetingToSetup()` set
  `dayMode:'multi'` whenever `lm_dayofweeks` decodes to a non-empty array,
  `'fixed'` otherwise.
- `cadenceRules()` (shared validation) requires a fixed day only in Fixed
  mode, and in Multiple days mode requires at least one pick and re-checks
  the cap server-side-shaped (a safety net behind `Checks`'s own `max`, for
  any value that arrives some other way than this wizard).
- The review-step summary (`MeetingSummary`/`ReportSummary`) and the
  publish-confirmation diff both show the picked numbers in Multiple days
  mode, via a new shared `cadenceDayFragment(s)` helper, rather than going
  blank there.

**Data layer** (`dataverse.js`): `DAY_OF_WEEKS_MULTI_KEY`/`DAY_OF_WEEKS_MULTI`
(1..31 ↔ 124330000-based codes), `parseMultiChoice()` (accepts either a
plain array or a comma-separated string on read — this connector's real
shape for a multi-select **write** has never been exercised by this app
before, and reads have only ever gone through the FormattedValue annotation,
never the raw attribute, so both are handled defensively rather than
assumed), and `decodeDayOfWeeksMulti()` tying the two together. Wired into
both parent payload builders (write: an array of the mapped codes, or `null`
when empty) and both detail `$select`s.

⚠️ **Genuinely unverified: this is the first multi-select WRITE anywhere in
this app.** The write uses the documented standard Dataverse Web API shape
(a plain array of option-set integers) but has not been proven against a
real save. First real test: save a Weekly Setup with 2 days picked in
Multiple days mode, reopen it, confirm they round-trip.

Both apps rebuilt, bundle org URLs re-checked, pushed — same two app ids as
every push this session.

### 23 Sep, same day, straight after: "the report doesn't save" — the picked days never left the browser, and the "unverified write" flag above was aimed at the wrong risk

Reported live, with a screenshot of the browser console — which turned out to
be almost entirely Power Apps player/host chrome noise (`unload` permissions
violations, ECS telemetry, `es6.webplayer-host-ui.js` warnings), nothing from
this app's own bundle. **Diagnosed by checking Dataverse directly instead of
guessing from the console**: queried `lm_report_templates` in IT for the most
recently modified rows and found the Setup in question —
`Clinical Governance and Advertising Production_Core_Twice Weekly`
(`9c1f2678-4a9e-4146-a9d7-b2472bf775d7`), modified today — **had actually
saved**. The parent row exists, with the right name and Frequency. But both
`lm_dayoftheweek` *and* the new `lm_dayofweeks` came back completely empty,
confirming the failure was narrower than "the report doesn't save": the row
saves, the day selection silently does not.

**Root cause: `buildReportTemplatePayload()`/`buildMeetingTemplatePayload()`
(`GovernanceApp.jsx`) never learned about `dayOfWeeks`.** These two
functions are the layer between the wizard's live form state and
`reportTemplateParentPayload()`/`meetingTemplateParentPayload()`
(`dataverse.js`) — both editions were updated earlier today to *read*
`payload.dayOfWeeks`, and `CadenceFields` was updated to *collect* it into
`s.dayOfWeeks`, but neither builder function was told to *copy* it across.
Each one is an explicit field-by-field list (`frequency: f.frequency,
dayOfWeek: f.dayOfWeek, dayOfMonth: f.dayOfMonth, …`), so a field left off
it is silently `undefined` in the outgoing payload — not a typo Dataverse
could reject, nothing to throw on. **This is the identical failure shape a
comment sitting three lines away in `buildMeetingTemplatePayload()` already
describes**, from an 08 Sep bug where `secondDayOfWeek`/`secondDayOfMonth`/
`monthInSemester` were "collected... just had nowhere to put them" — the
same mistake, repeated with the new field, in the same file, the same day it
was built.

**Fixed:** `dayOfWeeks: f.dayOfWeeks || undefined` added to both builder
functions. Both apps rebuilt, org URLs re-checked, pushed.

⚠️ **This means the "first multi-select write, unverified" flag on the entry
above was pointed at the wrong risk.** The actual write to
`lm_dayofweeks` was never reached at all in the one real attempt made today —
`payload.dayOfWeeks` was always `undefined`, so `reportTemplateParentPayload()`
wrote `null`, which Dataverse of course accepted with no error. Whether the
documented standard shape (a plain array of option-set integers) is actually
correct for a **write** is **still** completely unverified — now for the
right reason. First real test, unchanged in substance from the earlier note:
save a Weekly or Twice Weekly Setup with 2+ days picked in Multiple days
mode, reopen it, confirm they round-trip. The leftover test row above
(`9c1f2678-4a9e-4146-a9d7-b2472bf775d7`) still has empty day fields from the
broken attempt — left as-is, not cleaned up, a natural one to re-save over
for that test.

### 23 Sep, same day, once more: that "first real test" ran, and settled the flag above the hard way — `lm_dayofweeks` needs a comma-separated STRING, not an array

Reported live, with the real evidence this time: `Case Management_Executive_Weekly`
(a fresh Report Template, Multiple days ticked, 4 numbers picked) failed to
save **entirely** — nothing landed in `lm_report_templates` at all, confirmed
by querying IT directly before asking for anything further. The generic
toast said only "Dataverse write failed. Check the console for details," and
the browser console itself was almost entirely Power Apps player/host chrome
noise (`unload` permission violations, ECS telemetry) — the one real line in
it was a bare `Failed to load resource: ... 400` against
`.../api/data/v9.1.0/lm_report_templates`, with no message body visible.
**The actual fix came from the Network tab's response body**, not the
console — walked through step by step (Network tab → filter by table name →
open the 400 → Response/Preview), because a terse "failed to load" line
never carries the OData error text, only the tab that shows the raw response
does.

**The real message, once seen, settled it in one read:** *"An unexpected
'StartArray' node was found when reading from the JSON reader. A
'PrimitiveValue' node was expected."* This connector reads
`api/data/v9.1.0` — Dataverse Web API on this version accepts a multi-select
Choices value as a single **primitive**: a comma-separated **string** of the
option-set integers (`"124330000,124330010,124330021,124330028"`), not a
JSON array. Sending an array fails the whole parent-row create, not just
that field — which is exactly why the entire Setup vanished rather than
saving with an empty day list, the shape of the previous entry's failure.

**Fixed:** both `reportTemplateParentPayload()` and
`meetingTemplateParentPayload()` now `.join(',')` the mapped codes instead of
leaving them as an array. `parseMultiChoice()` on the read side needed **no**
change — it was already built to accept a string defensively, before this
was confirmed, on the reasoning that the real shape hadn't been proven
either direction yet. Verified the write→read round trip in isolation
(`node -e`, the actual `DAY_OF_WEEKS_MULTI_KEY`/`DAY_OF_WEEKS_MULTI`/
`parseMultiChoice` logic copied in, not restated from memory) against the
exact four codes from the failed attempt (`1, 11, 22, 29` →
`"124330000,124330010,124330021,124330028"` → back to `[1, 11, 22, 29]`) —
confirmed the shape is now correct, though a real Dataverse save is still
the only proof that actually counts. Both apps rebuilt, org URLs re-checked,
pushed.

⚠️ **This closes the "still completely unverified" flag two entries above —
but only for the write's *shape*, confirmed by a real rejection and a real
fix, not yet by a real *success*.** The next save attempt is still the first
one that could actually prove the round trip end to end. If it fails again,
get the Network tab response body first, the same way this one was found —
the console alone did not have enough in it either time.

**Worth generalising, since this is the second time in one afternoon that
the console screenshot alone was not enough**: this app already has a
documented instance of exactly this lesson (§6/§8, the File-upload
content-type bug — "splitting a file-upload failure into its own tagged
error... is what actually surfaced the fix"). A bare `Failed to load
resource: 400` in the console is a pointer, not a diagnosis — the response
body is the diagnosis, and for a Code App talking to Dataverse through this
connector, that means the Network tab, not the Console tab.

### 23 Sep, later: every BU/Region-scoped Position picker can now search company-wide, on demand

Per an explicit ask, with two genuinely ambiguous points clarified before
writing anything (the ask itself said so was fine to do): **which** pickers
(every one restricted by `positionsInScope(s,k)` — Chairman, Co-Chairman,
Facilitator, Owner Position, Submitting Position, Review Chain steps,
Attendees — but **not** Agenda Item Owner, which is restricted by a
different rule entirely, people already holding a role on this Setup, not
Business Unit/Region, and not the Microsoft Group picker, which isn't a
Position search at all), and **how** it surfaces (an opt-in checkbox inside
the dropdown, not an automatic fallback).

**All wired through `PosSel` itself**, the one shared combo component behind
every Position picker in both wizards. Gained an optional `fullOpts` prop —
the unscoped, company-wide `POSITIONS` array (already a module-level `let`,
loaded once by `fetchPositions()`, no new fetch needed) — passed only by the
call sites that should offer it. A caller that doesn't pass `fullOpts` (the
Group picker, Agenda Item Owner) gets no checkbox and behaves exactly as
before; nothing about their existing restriction changed.

**When checked**, the dropdown's search runs against `fullOpts` instead of
the scoped `opts`, but requires a typed query first — `POSITIONS` is
company-wide (this org's live `cr603_organizationstructure` count alone is
five figures — 11,315 rows in IT, per this section's own "Moving Governance
Setup to the IT environment" entry) so rendering the whole thing unfiltered
would be both a bad list and a real performance problem. Resets to unchecked every time the
picker closes — on select, on Clear, and on reopening the button — the same
places its search text already reset, so it can never be silently left on.

**Review Chain step keeps its existing exclusion rule under the checkbox
too** — a Position already used elsewhere in the same chain still can't be
picked twice, in `fullOpts` exactly as in the scoped `opts`; that rule is
about chain integrity, not Business Unit/Region, so widening the search
doesn't widen it away.

**A real, pre-existing-shaped bug found and fixed along the way**: `PosSel`'s
closed-button display (`sel = opts.find(o=>o.id===val)`) only ever looked in
the scoped list — so a Position picked while "search everyone" was checked
would show correctly the moment it was picked, then read back as the empty
placeholder the next time the picker reopened, even though the value was
saved correctly the whole time. Now falls back to `fullOpts` when not found
in `opts`. This is exactly the class of gap this whole feature exists to
close, just one step further down — worth remembering if anything else here
ever reports "it doesn't show my selection" after using the new checkbox.

Both apps rebuilt, org URLs re-checked, pushed — same two app ids as every
push this session.

### 24 Sep: the Business Unit filter changed twice more in one session — HR tag → "has Positions" → unfiltered, ending in an automatic Position fallback instead

Two more asks, same day, each replacing the previous approach outright rather
than layering onto it — worth reading in order, since the code's own history
comment (`fetchBusinessUnits()`) only points here rather than restating all
three.

**Pass 1 — "has at least one Organization Structure record," not the HR
tag.** `fetchBusinessUnits()` stopped filtering on `cr603_application_tag`
(23 Sep) and instead kept only Business Units with ≥1 row in
`cr603_organizationstructures`. No server-side distinct/aggregate query
exists through `dvTable()`'s `getAll()` (only `$select`/`$filter`/
`$orderby`/`$expand` are forwarded, no `$apply`, no raw FetchXML), so this
read the one BU-lookup column across every Organization Structure row and
de-duplicated client-side. **Confirmed live before shipping**: 16 of 36
Business Units qualified — the same 15 that were HR-tagged, plus `EGY`
(has Positions, was never HR-tagged).

**Pass 2 — reverted again, same day: every Business Unit, unfiltered.**
`fetchBusinessUnits()` is back to a plain, unfiltered read — no tag filter,
no Positions-count filter. In its place, **`positionsInScope()`**
(`GovernanceApp.jsx`) now falls back automatically when a unit's own
Business Unit(s) have zero Positions: instead of a permanently empty
picker, it returns every Position company-wide, with each one's `.name`
rewritten as `"{Position} - {its real Business Unit}"`. `PosSel` already
renders name (bold) then holder (italic) as two lines, so this reads as
`Position - BU` / `Employee Name` with **no change to `PosSel` itself** —
only to what the fallback rows put in `.name`. Applies at both `'bu'` and
`'region'` scope (a Region whose Business Units collectively have zero
Positions hits the identical dead end, from the same `buIds` shape).
**Confirmed live**: 20 of the 36 Business Units currently have zero
Organization Structure rows, so this is a live, immediately-visible case,
not a rare edge one.

Cascades to every one of `positionsInScope()`'s existing callers with no
further per-call-site changes: Chairman, Co-Chairman, Facilitator, Owner
Position, Submitting Position, Review Chain steps (whose own dedup filter —
excluding a Position already used elsewhere in the same chain — still
applies on top, keyed by `.id`, unaffected by the renamed `.name`), and
Attendees. Agenda Item Owner is untouched, same reasoning as the 23 Sep
"search everyone" feature: it's restricted by a different rule entirely
(already holding a role on this Setup), not Business Unit/Region.

Both apps rebuilt, org URLs re-checked, pushed — same two app ids as every
push this session.

### 24 Sep, later: Accreditation Committee's Category picker was a permanent dead end — found and fixed, validation had the identical gap

Per an explicit ask, made concrete by a new taxonomy reference document shared
in chat (`Leadership_Taxonomy_updated_v5.html`, not saved to the repo — see
§3's note about chat-only source files re-request it if it's needed again).
That document distinguishes three different things all labelled
"Accreditation Committee": a `Setup Type` value (section 07, already matches
this app exactly), a `Classification Type` value (section 03, one of 7
sibling meeting-family choices), and — separately — a governed 22-row
**Category** list (section 05) that a Classification Type of Accreditation
Committee unlocks, Stage 1 only.

**Confirmed against live data before writing any code, not assumed from the
taxonomy alone**: queried `lm_meetingcategories` in IT directly. Of 94 live
rows, **exactly 22 have no `lm_typeclassification` value** — and those 22,
name for name, are the taxonomy's own Accreditation Committee Category list
(Patient Experience, Medical Executive, Pharmacy & Therapeutic, …), every one
of them `Stage 1 BU Operational`. Not a coincidence to route around — the
absence of a Classification on these 22 rows IS how this table already
distinguishes them from the other 72, which all carry one of 7 real
Classification codes.

**The bug this uncovered, tracing why "Category" wasn't pickable for an
Accreditation Committee at all**: `MeetingClassField` (Type / Classification)
is already hidden for an Accreditation Committee (`when={!accred}`, pre-existing) —
so `s.category` never gets set for one. But `meetingCategoryOpts(s)`
required `s.category` to be truthy before returning anything, and
`MeetingCategoryField` required both `s.stage` *and* `s.category` before
showing anything but a disabled "Stage and Type / Classification first…"
placeholder. An Accreditation Committee can never satisfy that — so its
Category field was a **permanent dead end**, not a bug found once and fixed,
apparently never actually usable. Worse, `validateMeeting()`'s own Category
check (`if(meetingCategoryOpts(s).length && !s.meetingCategory)`) had the
identical blind spot: for an Accreditation Committee this list is always
empty, so the whole condition was always false — **a Setup could be
published as Accreditation Committee with no Category at all, and nothing
ever flagged it.**

**Fixed, three spots:**
- `meetingCategoryOpts(s, accred)` gained the `accred` parameter — when
  true, it reads straight off the blank-`lm_typeclassification` rows for
  the chosen Stage, skipping Classification entirely rather than requiring
  it.
- `MeetingCategoryField` takes and threads `accred` through, with its
  hint/placeholder/orphaned-value text adjusted for the Accreditation case
  (no more "…and Type / Classification" wording when there isn't one).
- `validateMeeting()`'s Category check now passes
  `s.setupType==='Accreditation Committee'` through too, closing the
  validation gap the same way.

Stage-change handling needed no fix: `meetingCategory`/`meetingCategoryName`
were already unconditionally cleared on any Stage change (pre-existing), so
switching Stage on an Accreditation Committee already correctly re-empties
the Category picker into the new Stage's (possibly empty, since only Stage 1
has rows) list.

Both apps rebuilt, org URLs re-checked, pushed — same two app ids as every
push this session.

### 24 Sep, later still: Build a report/plan's citation pickers — a real cross-environment bug found and fixed, wider than the tab it was asked about

Per an explicit ask ("I want the report build tab to read from the IT Env").
**Checked what was already true before assuming anything was missing**: the
Report Occurrence itself, its Sections, its Citations, its History and its
Shares have read/written IT since 22 Sep (`IT_ORG` in `xenv.js`) — the ask
sounded like it might already be satisfied.

**It wasn't, and the gap was a real bug, not just an inconsistency.** The
seven catalogs Build a report/plan's citation pickers pull from — KPI,
Process, POC, Strategy, BI Report Dashboard, Task, Project — were never
pinned, so they still read this app's own `DATA_ORG` (DT New for
Leadership). A citation row is created in IT, but the KPI/Process/etc. it
cites came from DT New's copy of that table — and every environment in this
project has independently-generated GUIDs for "the same" conceptual record
(Regions, Business Units, Departments all already confirmed to differ). So
citing a KPI or Process in Build a report/plan was very likely binding to an
id that does not exist in IT at all, on every attempt since the Report
Occurrence family moved 22 Sep.

**Scope confirmed before touching code, not assumed**: `fetchKpis()`,
`fetchProcesses()`, `fetchBiReportDashboards()` and `fetchTasks()` are not
Build-a-report/plan-exclusive — Business Intelligence and Communication's
Tasks tab call them too. The organization pin lives on the table
(`dvTable()`'s third argument), not the call site, so there is no way to
move these four for one screen without moving them for all three. Asked,
and the "pin everywhere" option was confirmed over forking a parallel
IT-only read path for Build a report/plan alone.

**Fixed: 9 tables pinned to `IT_ORG`, not 7.** The original ask named seven
(`strategy_kpises`, `strategy_processes`, `stf_strategypocs`,
`strategy_strategies`, `lm_bireportdashboards`, `hx_taskses`,
`cr603_projectses`) — tracing the fix surfaced two more that needed the
identical treatment for the identical reason: `stf_executioncategories` and
`crd04_specialtieses` resolve `_stf_poccategory_value`/`_stf_specialty_value`,
ids that sit directly on a POC row. Once `stf_strategypocs` itself reads
from IT, those become IT's ids, and resolving them against DT New's copies
of the two lookup tables would fail the same way an unpinned KPI/Process
bind would have.

**Confirmed live in IT before calling this done, table by table** (not
assumed from the schema alone): all 9 exist and are readable —
`strategy_kpises` 2,711, `strategy_processes` 2,020, `strategy_strategies`
1,182, `cr603_projectses` 807 (`cr603_projects`, singular, is **not** a
valid FetchXML entity name for this table — same singular/plural trap §6
already documents elsewhere, this time for a verification query rather than
app code), `crd04_specialtieses` 58, `stf_strategypocs` 112,
`lm_bireportdashboards` 1. ⚠️ **Two are currently empty in IT**:
`stf_executioncategories` and `hx_taskses`, both 0 rows — the POC Category
filter and the Task citation picker will show no options today. That is
real IT data state, not something this change broke; flagged rather than
silently shipped unexplained.

Both apps rebuilt, org URLs re-checked, pushed — same two app ids as every
push this session. ⚠️ **Not yet exercised against a real save** — citing a
KPI or Process and confirming the bind actually lands is the next real test,
same "built and reasoned through, not yet proven live" caveat this file
already carries for the Multiple-days cadence feature earlier today.

### 24 Sep: Build a report/plan's Scope panel was blank (Department, Function, BU, Created By)

The user reported the Scope panel on an open report (BuildReport.jsx) showing
"—" for Department/Function/Business Unit/Created By. Root cause: those four
ids on a Report Occurrence (`departmentId`, `functionId`, `businessUnitId`,
`regionId`, `creatorPositionId`) are IT ids — the Report Occurrence family
has read/written IT since 22 Sep — but the screen was resolving them through
`dvLookup`'s `bu`/`dept`/`func`/`region`/`pos`, which come from
`LeadershipApp.jsx`'s global `fetchBusinessUnits`/`fetchDepartments`/
`fetchFunctions`/`fetchRegions`/`fetchPositions`, none of which are IT-pinned.
Those resolvers found nothing because they were looking in DT New for ids
that only exist in IT.

**Why this couldn't be a blanket repoint (unlike the citation-source fix
above).** `dvLookup`'s five resolvers are shared 40+ times through
`LeadershipApp.jsx`, including throughout Meeting-side data, which still
lives in DT New — e.g. `dvBu(o.businessUnitId)`, `dvPos(o.chairPositionId)`
for Meeting Occurrences. Pinning the global resolvers to IT would have fixed
Build a report/plan and broken every Meeting screen at once. Asked the user;
confirmed answer was to scope the fix to the report-building tab only, not
touch the shared Meeting-side lookups.

**Fix.** `dataverse.js` gained five IT-pinned sibling services
(`BusinessunitsItService`, `Crd04_regionsesItService`,
`Cr603_chklst_departmentsesItService`, `Hr_functionsItService`,
`Cr603_organizationstructuresItService`, all `dvTable(..., IT_ORG)`) and five
matching name-only fetch functions (`fetchBusinessUnitsForIT`,
`fetchRegionsForIT`, `fetchDepartmentsForIT`, `fetchFunctionsForIT`,
`fetchPositionNamesForIT` — Positions come from `cr603_organizationstructures`
/ `cr603_name`, same primary-name column `fetchPositions()` already uses for
DT New). `BuildReport.jsx` reads these once on mount into id→name maps, then
builds `L` as `{ ...dvLookup, ...itScope }` — the IT-sourced `bu`/`dept`/
`func`/`region`/`pos` override the DT-New ones for this screen only;
`dvLookup`'s `rptTpl` (already IT-pinned via `fetchReportTemplatesList`) and
`myPositionIds` pass through untouched. Every existing `L.dept`/`L.func`/
`L.bu`/`L.region`/`L.pos` read in the file (the Scope panel, the citation
summary helper, the props handed to child components) picks this up for
free since they all read the same `L`.

⚠️ **Known, deliberately not fixed here**: `submitReportOccurrence(recId,
{ actorPositionId: (L.myPositionIds||[])[0] })` still resolves the signed-in
user's Positions against DT New, then writes that id into an IT-hosted
Report Occurrence. Same GUID-mismatch risk as everything else in this
family, but fixing it means resolving the current user's identity against
IT specifically — a separate, bigger task, flagged rather than folded in.

Both apps built clean, org URL counts re-checked (leadership bundle: both
`org2f45e702` (IT) and `org319b4ea9` (DT New) present, as expected since
Meeting-side still needs DT New).

### 24 Sep: `C:\tmp\cad-gov-new`/`cad-exec-new` lost a third time, Leadership recovered without orphaning

On "build and push," both staging folders were `rm -rf`'d before restaging
(clearing them out felt like normal prep, done without checking what was in
them first) — destroying the `.power`/`power.config.json` binding that
`pac code push` needs to know *which existing code app* to update. This is
the exact failure §8's TODO list already named as having happened once
before (it produced the orphaned `4912152c…`/`83db0ef8…` apps that
`786c1b14…`/`d61c6237…` themselves replaced). No recovery path existed:
`rm -rf` bypasses the Recycle Bin, no shadow copies were available without
admin rights, and `pac code push`/`init` have no flag to target an existing
app id.

**Recovered Leadership (`d61c6237…`) without creating a third generation.**
`pac code init` leaves `appId: null` in `power.config.json` until the first
push — the app registration doesn't happen at init, only at push. So: ran
`pac code init` + `pac code add-data-source -a shared_commondataserviceforapps
-c c83ec8cc…` (the real Code App Development Dataverse connection) into a
throwaway folder to get a CLI-generated, valid `connectionReferences` block
(hand-typing that GUID was considered and rejected — it's not the connection
id itself, it's an internal reference key the CLI mints, and guessing wrong
risks silently uploading a broken connection binding to a *live* app, worse
than a clean failure). Then hand-edited only `appId` in the resulting config
to `d61c6237-fec1-45c7-80e0-a9c63dd1e662` before `pac code push`. Worked:
`pac code list` before and after both showed the same 6 apps, no duplicate,
and the returned play URL matched the original. `C:\tmp\cad-exec-new` was
replaced with this working, reconnected folder.

⚠️ **Governance (`786c1b14…`) is not yet recovered** — the same
`pac code init` step for it was blocked by the auto-mode "Production Deploy"
safety classifier before the reconnect could be attempted. `C:\tmp\cad-gov-new`
still only has `dist/` in it, no `.power`/`power.config.json`. Needs either
explicit permission to retry, or the user running the same recipe above
by hand (see the numbered steps two paragraphs up) with `appId` set to
`786c1b14-bf09-4dd7-a0a2-5730e87744fe`.

**Standing lesson**: never `rm -rf` a non-repo working folder (staging
folders included) without listing its contents first — `.power`/
`power.config.json` files are exactly the kind of state that doesn't show
up in a casual `ls` without `-a`/hidden-file awareness, and isn't backed by
git since these folders live outside the repo on purpose (§8's `apps/*/
power.config.json` must stay bound to DT New).

### 24 Sep: `pm_kpiachievments` (KPI Achievement figures) pinned to IT_ORG

Asked directly: "Is the KPI achievement reads from the IT Env?" — it
wasn't, and tracing it surfaced a real, previously-unnoticed regression from
the citation-source IT pin earlier the same day. `fetchKpiAchievements()`
filters `pm_kpiachievments` by `_pm_kpi_value eq <kpi id>`, and that id now
comes from `fetchKpis()`'s citation picker, which reads `strategy_kpises`
from IT (pinned 24 Sep, see above). `pm_kpiachievments` itself was still
unpinned (DT New), so any KPI cited since that pin would silently show no
Achievement figures — DT New's achievement rows point at DT New's KPI ids,
not IT's, so the filter matched nothing. The doc comment above
`fetchKpiAchievements` still asserted "the same table this app's KPIs come
from, so the join is sound" — true when written, stale after the catalog
moved.

**Fix**: `Pm_kpiachievmentsService` in `dataverse.js` now takes `IT_ORG`
explicitly. Confirmed safe as a plain repoint, not a fork: `fetchKpiAchievements`
has exactly two readers, `BuildReport.jsx` and `OrgReports.jsx`, both
Report Occurrence / citation screens already IT-hosted — no Meeting-side
code touches this table. `stf_kpiachievmentbreakdowns` (the richer
breakdown table §6 documents) has no service or fetch function implemented
in this codebase yet, so nothing else needed the same pin. Both apps built
clean. Not yet pushed.

## 6. Schema facts that are expensive to rediscover

### `lm_meetingcategories` — a blank `lm_typeclassification` IS the Accreditation Committee signal, not a data gap
94 live rows (24 Sep). 72 carry one of 7 real `lm_typeclassification` codes
(Planning Meeting, Monitoring Meeting, Clinical Meeting, Operational Meeting,
Technology Meeting, Cross functional Meeting, Team of Teams). The other
**22 have no Classification value at all** — confirmed, not assumed, this is
not missing data: those 22 rows, name for name, are the governed
Accreditation Committee Category list (Patient Experience, Medical Executive,
Pharmacy & Therapeutic, Operating Room, …), every one `Stage 1 BU
Operational`. An Accreditation Committee Setup has no Type / Classification
step at all (`MeetingClassField`'s own `when={!accred}`), so its Category
reads these 22 rows directly, filtered only by Stage —
`meetingCategoryOpts(s, accred)` in `GovernanceApp.jsx`. Any future read of
this table that assumes every row carries a Classification will silently
drop these 22 (or crash on a null lookup) — check for `accred`/a blank
`lm_typeclassification` first.

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
| `lm_meetingminutes`, `lm_momnotes`, `lm_reporttemplatesectionitems`, `lm_reportsectioncitations`, **`lm_reportoccurrencedepartmentfunctions`** | `lm_auditgridinstance`, `lm_auditgridanswer`, `lm_approvalcycle`, `lm_approvalcyclestep`, `lm_authoritymatrixrow`, **`lm_reportoccurrence`**, **`lm_reporttemplatecontentchecklist`**, **`lm_reportoccurrenceshare`** |

Guessing wrong gives `Failed to get entity definition`. **The CLI also fails
transiently** — a name that fails once often works on retry, so treat a single
failure as inconclusive and retry before concluding the table doesn't exist.

⚠️ **The schema FILE name is the entity set; the `-t` argument is the logical
name, and they differ.** `lm_reportoccurrence` (singular) writes
`reportoccurrences.Schema.json` (plural); `lm_reportoccurrenceshare` writes
`reportoccurrenceshares.Schema.json`. So an existing plural filename is **no
evidence** that the plural logical name will register — both of those tables
had been registered before and still only accept the singular form.

⚠️ **Generated service names double-pluralise.** The entity set already ends in
`s`, and the generator adds `es`:
`Lm_reportoccurrencesectionsesService`, `Lm_reporttemplatesectionitemsesService`,
`Lm_reportsectioncitationsesService`. Cosmetic, but that is the import name.

### Dataverse File columns: reading one, and what its name is

Three columns hold real binary content: `lm_report_templates.lm_attachementfile`,
`lm_reporttemplatesectionitems.lm_attachementfile`, and
`lm_reportoccurrence.lm_attachementfile` (which also has a separate
`lm_filename`). All are native Dataverse File columns — modelbuilder emits them
as getter-only `Guid?`, which is the signature.

**Both directions go through the Dataverse connector, not a per-table service:**

| Direction | Operation | Wrapper |
|---|---|---|
| write | `UpdateEntityFileImageFieldContentWithOrganization` | `uploadFileColumn()` |
| read | `GetEntityFileImageFieldContentWithOrganization` | `downloadFileColumn()` |

Both are in `src/services/xenv.js`, both take the organization, so both work
cross-environment.

⚠️ **The two directions are NOT symmetric, and this cost most of a day.**
The write takes base64. The **read returns base64 of content that is itself
base64** — one decode yields ASCII base64 TEXT, not the file.
`decodeFile()` in `src/shared/FilePreview.jsx` peels the extra layer.

The peel needs `cleanBase64Text()` first: the inner payload arrives inside a
wrapper that makes `atob()` throw — a BOM, surrounding quotes, a `data:`
prefix, or the base64url alphabet (`-_` for `+/`). **A peel that does not
strip those fails**, which is exactly what happened on the first attempt and
caused a correct diagnosis to be abandoned.

Peeling is gated on file signatures (ZIP `50 4B 03 04` for
xlsx/xlsm/xlsb/docx/pptx, OLE2 `D0 CF 11 E0` for xls, `%PDF`, PNG/GIF/JPG/BMP):
the extension must say what the leading bytes should be, they must not match,
and after decoding again they must. A `.txt` or `.csv`, having no signature,
is never second-guessed.

⚠️ **A real `.xlsx` can legitimately BE an OLE2 file, not a ZIP one** — found
21 Sep on the very first live file opened through this viewer
(`lm_MeetingCategory (1789744418443) (1).xlsx`, see the Live file inventory
below): its actual content, after the double-base64 peel, was OLE2, not
ZIP. `xlsx`/`xlsm`/`xlsb` now all accept **either** `['zip','ole2']` in
`EXPECTED` (`xls` already did) — SheetJS sniffs the real container from the
bytes regardless of what the filename says, so gating on ZIP-only for those
three was stricter than the library it protects, and silently discarded a
correctly-peeled result in favour of raw undecoded text. `docx`/`pptx` are
deliberately still ZIP-only: this viewer has no old-format `.doc`/`.ppt`
renderer either way. Covered in `scripts/test-decodefile.mjs`.

⚠️ **An OLE2 `.xlsx` is not necessarily an old-format `.xls` — it can just
as easily be a workbook saved WITH A PASSWORD**, which uses the identical
container family. That very same file turned out to be exactly this case,
found one step later: past the signature check, SheetJS threw *"ECMA-376
Encrypted file missing /EncryptionInfo"*. Read from `xlsx.mjs` itself:
`read_cfb()` hands any CFB container holding a stream named
`EncryptedPackage` to the password-protected code path — this file has one,
so it is (or was) genuinely encrypted, not a plain legacy workbook, and no
fix to the OLE2 signature check above changes that. **This viewer has no
password prompt, by design, so an encrypted workbook can never be shown
here regardless.** `FilePreview.jsx` now recognises every SheetJS message in
this family (`/password-protected|Encrypted file/i` — six throw sites in
`xlsx.mjs`, confirmed by reading each one, all one of those two phrasings)
and replaces it with an honest, actionable message instead of the raw
SheetJS wording. The error view also gained a Download button when the
bytes are available but unparseable for ANY reason — previously it had
none, ever, even for a genuinely downloadable file.

⚠️ **Never hand unverified bytes to SheetJS to find out whether they are a
workbook.** It treats anything it cannot identify as CSV and SUCCEEDS,
rendering one cell holding the raw text. That turned a decoding bug into what
looked like a rendering bug and hid it for two rounds. Check the signature
first and refuse.

⚠️ **STILL OPEN:** whether Dataverse *stores* base64 text (upload defect —
every file then wrong for anything reading it outside this app) or the
transport re-encodes on the way out (read-side only, and now handled).
Downloading the file from the maker portal settles it. The older claim that
the upload was "CONFIRMED against live Dataverse" only ever confirmed that
the CALL SUCCEEDED and a filename appeared — it never verified stored bytes.

⚠️ **On the READ, `Range` is the first positional argument and the generated
signature types it as a required `string`** — but it is an HTTP Range header,
and *omitting* it is what asks for the whole file. Passed as `undefined`
(which `JSON.stringify` drops), then retried at `'bytes=0-'`.

⚠️ **The retry must fire on an EMPTY result, not only on a rejected one.** A
gateway that requires the header answers **200 with an empty body**, so a
retry conditioned on failure can never run — which is precisely the defect
that produced "came back empty" on a call that reported success.

⚠️ **The read's response shape varies** and `toBase64()` normalises all of
them (**not** `fileContentToBase64()` — that name is gone): a bare base64
string, a `data:` URI, the Power Platform `{$content-type, $content}` binary
envelope, `{value}` / `{body}` / `{fileContent}` / `{documentBody}` wrappers,
and `Blob` / `ArrayBuffer` / typed arrays. It recurses, so a nested envelope
resolves. An unrecognised shape returns `''` and the CALLER reports what
arrived — `describePayload()` names it. **Never let a normaliser swallow an
unknown shape silently**: that makes an unhandled envelope indistinguishable
from an empty file.

Covered by `node scripts/test-decodefile.mjs` and
`node scripts/test-tobase64.mjs`, both of which extract the helpers from the
real source rather than restating them.

⚠️ **The filename is `<column>_name`, and where you can ask for it differs:**

| Route | Returns `lm_attachementfile_name`? |
|---|---|
| FetchXML (`pac org fetch`) | **yes** |
| OData `$select` | **no — do not put it there** |
| `pac modelbuilder` | never emits it as an attribute |

It is runtime-projected, not declared, so selecting it explicitly risks the
400 that killed the whole Decisions read. Select the file column itself and
the name rides along.

⚠️ **Amended 21 Sep — "the name rides along" only held for a single-record
GET, not a LIST read, and this file used to say it unconditionally.**
Every confirmation of that rule up to 20 Sep went through
`fetchReportTemplateDetail()`, which reads the Template parent and its
Section Items via `.get(id, {...})`. The first time this app read a File
column through `.getAll()` instead
(`fetchReportTemplateHierarchyContent()`, the Reporting hierarchy's
Templates view), `lm_attachementfile_name` came back **empty on a row that
genuinely had a file** — confirmed live, not inferred: `hasFile` was
correctly `true`, the download worked, only the name was missing, which
then broke `previewKind()`'s extension sniffing (it read the UI's own
"no name" fallback string as the file's "extension") and gave the
downloaded copy a nameless, extension-less filename. **If you read a File
column's name in bulk, don't trust it — do one targeted
`.get(id, {select:[<file column>]})` per row that has a file**, same as
`fetchReportTemplateHierarchyContent()` now does; bounded by how many rows
have a file, not by how many rows exist, so it stays cheap.

⚠️ **FetchXML entity names for these tables are not the entity sets.**
`lm_report_template` is singular, but `lm_reporttemplatesectionitems` is
already plural — `lm_reporttemplatesectionitem` does **not** exist and fails
with a MetadataCache error. The Report Template's primary name column is
**`lm_newcolumn`**.

**What a browser can actually render** (see `src/shared/FilePreview.jsx`):
spreadsheets via SheetJS, PDFs/images via a `blob:` URL, plain text. **Word
and PowerPoint cannot be shown** — the Office Online viewer needs a publicly
reachable URL, and neither a `blob:` nor the authenticated Dataverse URL is
one. Don't try to resurrect that; the UI says "Download" for those types.

### A column can be added to a table under a DIFFERENT publisher prefix
`wlog_decisions` gained **`_lm_citedreportsection_value`** — an `lm_`-prefixed
lookup on a `wlog_` table. A diff filtered on the table's own prefix reports
"no change" and misses it entirely; that happened twice this session before the
full property list was dumped. **When checking whether a table gained a column,
list every property, not just the ones matching its prefix.**

This is also the current answer to Open Decision §7.7: a Decision cites a
**Report Section**. Note what that does *not* give — there is still no path from
a Decision to a **Meeting Agenda Item**.

### A local Setup's Dataverse id is `_dataverseId`, NOT `dvId`
Two different stores, easy to confuse:
- `ALL_SETUPS.current` = `db.setups` — **this session's** Setups. A Dataverse one
  opened into the session carries **`_dataverseId`**.
- `DV_REPORTS.current` = the **live Dataverse register** (`fetchReportTemplatesList`),
  whose rows carry the real `lm_report_templateid` as `.id`.

`dvId` exists only on the register *display* rows built by `dvFace()`. Reading a
local Setup's `.id` gives a session id like `su-8`, which Dataverse rejects as a
lookup.

⚠️ **Amended 20 Sep — there is now a SECOND, unrelated `dvId`.** A checklist
Section's *items* each carry `dvId`, their own
`lm_reporttemplatesectionitemsid`, added so a File citation can address its
file (§5, the read-only file viewer). It is **not** the register's `dvId` and
**not** a Setup's `_dataverseId`; it identifies a child row, not a Template.
The rule above is unchanged for Templates — this is a third thing, named the
same way, and the three must not be substituted for one another. **Anything citing a Template must source from `DV_REPORTS`**, capture the
id at pick time, and never resolve it back by name — the Meeting side's Linked
Report Templates picker already did this correctly and is the pattern to copy.

### `lm_reportsectioncitations` has no explicit parent-section lookup
Its four lookups are `lm_KPI`, `lm_Process`, `lm_CitedSection` and
`lm_CitedReportOccurrence` — all of which read as *targets*. Confirmed by a fresh
pull, twice. The Report Occurrence Flow plan (§3) assumes **`lm_CitedSection` is
the parent section**, since it is the only candidate pointing at a section.
**Confirm before building anything that writes citations.** Consequence of that
reading: a **Paragraph** citation (kind 8), which cites another report's section,
then has no target column.

### Annual scheduling — RESOLVED for Reports, still open for Meetings
~~Annual reports cannot be scheduled~~ — corrected 08 Sep. This entry used to say
no month-of-year column existed and to add `lm_monthoftheyear`; both are wrong now.
The column landed on 05 Sep as **`lm_month`** (a plain 1–12 calendar month,
1 = January), and it is wired end to end: the Setup form, `dataverse.js`'s
`MONTH_KEY`, the read select, and the Report Occurrence flow plan.

**`lm_meetingtemplates` — three of the four columns landed 09 Sep**, leaving one
gap. It now carries `lm_frequency`, `lm_daysoftheweek`, `lm_dayofthemonth`,
`lm_monthofthequarter`, **`lm_seconddayoftheweek`**, **`lm_seconddayofthemonth`**
and **`lm_monthofthesemesterseme`** — all wired end to end (see below for the
numbering trap, which is not the same as the Report table's).

Twice Weekly, Twice Monthly and Semesterly now fire. **Annually still cannot**:
there is no month-of-year column on `lm_meetingtemplates` — `lm_month` exists on
`lm_report_templates` only. Rather than collect a month with nowhere to store it,
the shared `CadenceFields` component takes a `noMonth` prop from the Meeting
wizard and renders a note in place of the Month dropdown. **To unblock Annual
meetings, add `lm_month` (1–12, 1 = January) to `lm_meetingtemplates`**; the flow
branch and the form change are already written and waiting on the column. Custom
remains unsupported on both sides — there is no rule field anywhere.

#### ⚠️ The Meeting cadence columns do NOT all use the same numbering
This is the single most expensive trap on this table. Two day-of-week columns sit
side by side with **different bases**:

| Column | Numbering | Sunday | Monday | … |
|---|---|---|---|---|
| `lm_daysoftheweek` | **124330000-based** | 124330000 | 124330001 | … |
| `lm_seconddayoftheweek` | **1-based** | 1 | 2 | … |

`dataverse.js` therefore keeps two separate maps — `MEETING_DAY_OF_WEEK_KEY` and
`MEETING_SECOND_DAY_OF_WEEK_KEY` — and they are **not interchangeable.** Writing
the wrong one is accepted by Dataverse (both are valid integers for a choice
column with those options) and only shows up as meetings generated on the wrong
day. `lm_monthofthesemesterseme` is 1–6, and `lm_seconddayofthemonth` is a plain
whole number.

Also note the **truncated logical name**: the column is
`lm_monthofthesemesterseme`, not `lm_monthofthesemester`. Dataverse cut it at the
length limit. Any hand-written FetchXML or flow expression has to use the
truncated form.

### `lm_dayofweeks` (23 Sep) is bound to the wrong-LOOKING choice set — confirmed intentional, not a mistake
A third day-related column, on **both** `lm_report_templates` and
`lm_meetingtemplates` (same codes on each). A multi-select Choices column,
but bound to the org's **"Days of Month"** global choice set
(`lm_daysofmonth`) — values `1`..`31`, 124330000-based codes (`_1`=124330000,
`_2`=124330001, … same numbering family as `lm_daysoftheweek` above, just a
much longer list) — **not** the org's real weekday list (`lm_weekdays`,
`Sunday`..`Thursday`) that `lm_SecondDayoftheWeek` right next to it correctly
uses. Looked like a maker-portal mix-up on first discovery and was flagged as
one before any code was written — **confirmed intentional**: a Weekly/Twice
Weekly Setup can alternatively name several **numbered** days (not weekday
names) instead of a single fixed weekday, and the numbers themselves are
what's picked. `DAY_OF_WEEKS_MULTI_KEY`/`DAY_OF_WEEKS_MULTI` (`dataverse.js`)
hold the 1..31 ↔ code mapping; `DAY_OF_WEEKS_CAP(freq)` returns 8 for Twice
Weekly, 4 for everything else in `DOW_FREQ`.

⚠️ **First multi-select WRITE this app has ever done — and the first attempt
was wrong, confirmed by a live 400.** Every prior multi-select use
(`cr603_application_tag` on `businessunit`, read-only, 23 Sep) only ever read
the FormattedValue annotation, never wrote the raw attribute. The documented
OData v4 shape (a plain array of the option-set integers) fails outright
against this connector: *"An unexpected 'StartArray' node was found... A
'PrimitiveValue' node was expected"* — it targets `api/data/v9.1.0`, which
wants a **comma-separated string** instead (`"124330000,124330010"`), and
rejects the *entire* parent-row create when it gets an array, not just that
field. **Fixed** — the write now `.join(',')`s. `parseMultiChoice()` on the
read side needed no change; it was already built to accept a string
defensively, before this was confirmed either way. Verified in isolation
(`node -e`, the real logic copied in) that the write→read round trip is
correct; a real Dataverse save round-trip is still the strongest remaining
proof. If a *different* multi-select column is ever written anywhere else in
this app, this is the first place to check — the array shape is the
documented default everywhere online, and it is wrong for this connector.

### A Report Occurrence has no per-occurrence reviewer table
`lm_reportoccurrences` carries **`lm_reviewstep` only**. The chain is **read from
the Template** for that unit, never copied. So an occurrence "has" a review chain
only by reference — and editing a Template changes the chain of reports already
in review. A frozen per-occurrence chain would need a new table.

### `lm_reportobjective` on the occurrence is 100 characters
The Template's objective can be longer, and Dataverse **rejects with a 400 rather
than truncating**. Anything copying the objective onto an occurrence has to cap
it or skip it.

### KPIs and Processes carry a Department only — never a Function
`strategy_kpises` and `strategy_processes` both expose
`_strategy_department_value` and nothing else organisational. So:
- **Business Unit** is derivable via the existing `deptInBu()` helper, which
  already handles a Department sitting under more than one BU.
- **Function cannot be filtered on** — nothing links a KPI or a Process to one.
  The Section picker therefore hides the Function control for KPI / Breakdown /
  Process and shows it only for child report-plans, which do carry real
  Department › Function lines. Adding Function filtering there would need a
  lookup on those two tables, which are **shared org-wide tables outside this
  app's ownership**.

### `theme.css` styles a `<select>` that isn't one, and defines `.chain-row` twice
`.chain-row select{flex:1;min-width:170px}` never applies to the Review Chain,
because `PosSel` renders a `<button>`. Anything sizing a custom control has to
target `.pos-sel` (the parent), not the button — see §5's 04 Sep entry.
Separately, `.chain-row` is declared **twice** in `theme.css` (lines ~176 and
~611) with different properties; the later one wins, so it is harmless today,
but it is a live cascade collision for whoever edits those next.

### `wlog_decisions` — registered differently from every `lm_` table, and not linked to anything here
Added this session. Worth reading in full before touching it again:

- **Logical name is `wlog_decisions`, plural** — the ask named `wlog_decision`.
- **`-t <name>` alone is no longer enough.** Every `lm_` table above was
  registered that way at some point, but as of this CLI version (`2.6.4`)
  plain `pac code add-data-source -t <name>` fails with `A required argument
  --apiId is missing.` The working invocation for this table was:
  `pac code add-data-source -a shared_commondataservice -c
  39b0e662674844b79a870b4e5a7485c9 -d default.cds -t wlog_decisions` — the
  legacy "Common Data Service" connector and connection id, **not**
  `shared_commondataserviceforapps` (a different, newer connector present in
  the same environment that registers tables under `connectionReferences`
  with no working `default.cds` dataset at all — tried first, backed out).
  Run `pac connection list` to re-find these ids if they ever need
  rediscovering; they are not environment variables or config anywhere.
- **Registered as `"dataSourceType": "Connector"` in `dataSourcesInfo.ts`,
  not `"Dataverse"`** like every other table. It lives in
  `power.config.json` under `connectionReferences`, not
  `databaseReferences.default.cds` where the other 39 sit. Functionally it
  behaves the same from a call-site's point of view (`Wlog_decisionsService`
  has the identical `create`/`update`/`get`/`getAll` shape), but it is a
  genuinely different integration path.
- **No lookup column to `lm_meetingoccurrences`, `lm_reportoccurrences`,
  `lm_meetingtemplates` or `lm_report_templates`.** Its only relationship is
  `_wlog_worklog_value` → `wlog_worklogs`, a separate, unrelated employee
  time-log table (activity/hours/manager/department — nothing governance-
  related). Confirmed by registering and inspecting `wlog_worklogs` too, then
  removing that registration once it turned out irrelevant. **Decided
  2026-08-31: the link to a Meeting Agenda Item / Report comes later** — see
  §7's new open decision.
- **Choice columns have no discoverable numeric codes.** `wlog_decisionstatus`,
  `wlog_reviewstatus` and `wlog_escalationresult` are Picklists whose values
  come from a live `GetOptionSetMetadata` connector operation, not from the
  cached schema file — unlike every `MEETING_*`/`REPORT_*` status this file
  hand-maps to a number. Read them via the `_wlog_decisionstatus_label` /
  `_wlog_reviewstatus_label` / `_wlog_escalationresult_label` sibling fields
  the connector returns instead (already how `fetchWorkLogDecisions()` does
  it). `createWorkLogDecision()` sets no status on create for the same
  reason — Dataverse's own option-set default applies.
- Field caps, if writing to it again: `wlog_name` 100 chars, `wlog_decisiontaken`
  4000, `wlog_expectedoutput` 1000, `wlog_managernote` 2000, `wlog_evidenceurl`
  500 (from the cached `.power/schemas/commondataservice/worklogdecisions.Schema.json`).

### ⚠️ `pac code delete-data-source` is not a safe undo
Used once this session to back out an exploratory `wlog_worklogs`
registration. It triggered a **full regeneration of `src/generated/`** that
silently renamed and deleted the model/service files of a large number of
already-registered, completely unrelated tables (`lm_meetingoccurrences`,
`lm_meetingtemplates`, and roughly thirty others) — even though
`power.config.json` itself came back clean. Caught via `git status` before
it was committed; fixed with `git checkout -- src/generated/
.power/schemas/appschemas/dataSourcesInfo.ts`, which is now the recommended
way to back out an unwanted `add-data-source` call: **hand-edit
`power.config.json` + `.power/schemas/appschemas/dataSourcesInfo.ts` +
`src/generated/index.ts` to remove just the one entry, delete that table's
own two generated files, and never call `delete-data-source`** unless the
plan is to immediately diff the entire `src/generated/` tree afterward.

### A Report Template's Review Chain now has its OWN per-unit lookups (06 Sep)
`lm_reporttemplatereviewchains` gained **`lm_ReportTemplatePerBusinessUnit`** and
**`lm_ReportTemplatePerRegion`**. Saving uses these. Before they existed the code
bound a Report unit row into the **Meeting** module's
`lm_MeetingTemplatePerBusinessUnit` / `...PerRegion`, which were the only per-unit
columns the table had.

Two consequences, both wired 06 Sep:

- **Reads accept EITHER pair** (`unitChainFilter()` in `dataverse.js`), so a chain
  saved before that date still hydrates when an older Setup is opened for edit.
- **A group-wide (Stage 3/4) chain must null-check all FOUR lookups**
  (`GROUP_CHAIN_UNBOUND`), not just the Meeting pair. Checking only the old pair
  would sweep up every per-unit chain saved since — those leave the Meeting pair
  null — and the update path would delete them as if they were group rows.

⚠️ **Unverified:** whether rows written before 06 Sep actually carry the Meeting
lookups, or whether Dataverse was rejecting those binds all along and they have all
four null. If the latter, the group-wide query now treats them as group chains.
Open an existing Stage 1 or 2 Template with a saved chain to find out.

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

### A status decode must never default to null — default to the row's real starting state
Found 01 Sep via a live screenshot, not a hunch (see §5 for the full story):
`MEETING_OCC_STATUS[o.lm_meetingstatus] || null` and the equivalent for
`REPORT_OCC_STATUS` silently dropped **41 of 44** live Meeting Occurrences
from Work Queue, the Meetings tab and the Calendar simultaneously, because
every one of those screens branches on an exact `'Scheduled'`/`'Held'`/
`'Cancelled'` string match with no `null` case. Fixed by defaulting to
`'Scheduled'` (Meetings) / `'Draft'` (Reports) instead of `null` — the state
every row starts in when this app's own create path writes it. **The lesson
generalizes**: any status/state decode read by more than one screen should
default to the record's real starting value, never to `null`, unless every
consumer explicitly has a null case. A blank Dataverse choice column is a
normal, expected condition (a row created outside this app's own create
functions, e.g. a flow or a bulk import, may never set it) — treating it as
"unknown, so hide the row everywhere" is almost never the right read.

### The app hydrates from `localStorage` — bump `KEY` on any seed shape change
`const KEY='andalusia_lp_v07'` near the top of `App()` in `LeadershipApp.jsx`.
On load, if `localStorage[KEY]` exists it is used as-is, **`seed()` is never
called**. A browser holding a save from before a schema change (e.g. a
report missing the `blocks` array added 02 Sep) will hit an uncaught error
on whatever field is now missing, and — with no error boundary anywhere in
the tree — that blanks the **entire app**, not just the affected screen.
Full story in §5's 02 Sep entry. Bump the version suffix any time a seeded
data shape changes; there is no migration path, only cache-busting.

### `pm_kpiachievments` / `stf_kpiachievmentbreakdowns` — pre-existing, shared, multi-prefix tables
Registered 02 Sep for the Report/Plan Composition plan (§5). Both are
**org-wide tables used by other modules too** — columns mix `pm_`, `stf_`,
`pms_`, `comp_` prefixes on the same rows, a strong signal they're shared
infrastructure, not something owned by this app. Only the columns relevant
to this app are noted here; many more exist and don't matter here.

`pm_kpiachievments` (note: real logical name has no "e" — "achievments",
and is plural): `_pm_kpi_value` (lookup, target table **not yet
confirmed** — over 40 tables in this org have "KPI" in the name, see the
plan file's Open items), `_pm_businessunit_value`, `stf_department`/
`stf_function` (**plain text**, not lookups — convenient, since the Build
screen's Department→Function filter can match against them directly),
`pm_month` (+ `_pm_month_label`), `pm_year`, `pm_target`, `pm_actual`,
`pm_breakdown` (text — relationship to the breakdown table below is
unconfirmed), `_pm_parent_value` (self lookup, purpose unconfirmed).

`stf_kpiachievmentbreakdowns`: no direct KPI lookup — joins back via
`_stf_total_value` → the parent `pm_kpiachievments` row. `stf_breakdowntype`
(+ `_stf_breakdowntype_label`) is a real choice column for the dimension
(e.g. "Specialty"), not free text. The breakdown's *member* is one of
**seven** separate optional lookups — `_stf_specialty_value`,
`_stf_physician_value`, `_stf_account_value`, `_stf_subaccount_value`,
`_stf_department_value`, `_stf_employee_value`, `_stf_platform_value` —
same one-active-per-row convention as `wlog_decisions`'s citation columns,
which one is populated depends on `stf_breakdowntype`. `stf_name` (text)
may already be a ready-made display label, which would make resolving
those seven lookups unnecessary for this app — not yet confirmed against
live data. Figures: `stf_value` (actual), `comp_breakdowntarget` (target).
`stf_breakdownlevel`/`stf_breakdownpath`/`_stf_parent_value` suggest a
nested/hierarchical breakdown structure beyond a flat dimension·member
shape — also unconfirmed.

### Reading and writing a DIFFERENT environment's Dataverse (16 Sep)
A Code App's generated per-table services (`Lm_meetingtemplatesService` and the
41 others) **always** read and write the environment the app is deployed to.
Nothing changes that — not a different connection id, not an `--org-url` flag,
not switching `pac auth` profiles, not an identically-named table in both
environments. Do not spend time on those.

What does work: add the Dataverse connector **without** a `--table` flag —

    pac code add-data-source -a shared_commondataserviceforapps -c <connection-id>

— which generates a single `src/generated/services/MicrosoftDataverseService.ts`
(~1,578 lines) whose operations take the target environment as an explicit
argument. `src/services/xenv.js` wraps them.

⚠️ **This corrects an earlier entry in this file.** §6 previously recorded
`shared_commondataserviceforapps` as a dead end that "produced the same empty,
untyped connector entry (`dataSets: {}`)". That conclusion came from adding it
**with** `-t <table>`. Adding it without a table is the entire trick — the two
produce completely different files. The per-table form is the dead end, not the
connector.

**Verified signatures, read from the generated file — the order is not uniform:**

| Method | Parameter order |
|---|---|
| `CreateRecordWithOrganization` | prefer, accept, **organization**, entityName, item |
| `UpdateRecordWithOrganization` | prefer, accept, **organization**, entityName, recordId, item |
| `GetItemWithOrganization` | prefer, accept, **organization**, entityName, recordId, …, $select |
| `ListRecordsWithOrganization` | **organization first**, entityName, prefer, accept, …, $select, $filter, $orderby, $expand, fetchXml, $top, $skiptoken |
| `DeleteRecordWithOrganization` | **organization first**, entityName, recordId, partitionId |

The source guide listed `DeleteRecordWithOrganization` as unexercised and told
the reader to confirm it. Confirmed above: it groups with `ListRecords`, **not**
with the write methods — passing the write order sends
`'return=representation'` as the org URL.

Other facts worth keeping:
- `organization` is the **full `https://` URL**, not the org name and not the
  environment GUID.
- `entityName` is the table's **entity set (plural)** name, e.g.
  `lm_setupactivities`. `power.config.json`'s `entitySetName` has all of them.
- ⚠️ **Pagination.** Dataverse caps a response at 5000 rows. Setting `$top`
  suppresses `@odata.nextLink` entirely, so the loop stops after one page and
  looks exactly like "the table only has 5000 rows". Ask for the cap through
  `prefer` (`odata.maxpagesize=5000`) and leave `$top` unset. The connector's
  `nextLink` is **not** a plain Dataverse URL either — the real continuation
  query is URL-encoded inside a `next` parameter, so reading `$skiptoken` off
  the outer query returns null every time. `xenv.js` handles both.
- **`CreateRecordWithOrganization` is typed `IOperationResult<void>`** — it
  declares no response body. `dataverse.js` cannot work without a new row's id
  (`idOrThrow(created, 'lm_…id')` binds agenda items, attendees, review chain
  steps, section items and the activity queue to it), so **since 17 Sep the
  adapter does not rely on the response**: `dvTable(entitySet, pkField)`
  generates the primary key GUID and sends it with the row, for the 28 tables
  the app creates. Dataverse accepts a client-supplied key on create. The
  returned data prefers the server's id and falls back to the supplied one;
  `_idSource` says which. `window.__xenvSmokeTest()` reads the row back under
  that id — the actual proof that a create landed.
- The signed-in user needs a Dataverse security role with **Create/Write on the
  target tables inside the TARGET environment**. A working connection is not a
  substitute, and the failure reads as a bug rather than a permission.
- Verify a write by opening the target environment and looking at
  Tables → (table) → Data. A success message can still mean the row landed in
  the wrong environment.

### Report Occurrence content: Sections and Citations (17 Sep)
**Entity sets are double-plural**, because the logical names are already plural:
`lm_reportoccurrencesectionses`, `lm_reportsectioncitationses`. The generated
service names say so too. This bites flows especially, where a bind path needs
the entity set (`/lm_reportoccurrencesectionses(…)`).

`lm_reportoccurrencesections` — key `lm_reportoccurrencesectionsid`;
`lm_heading` (850), `lm_body` (4000), `lm_diagnosticangle` (1 Untyped …
5 Prescriptive, same codes as the Template side), `lm_sequence`, `lm_source`
(**1** Migrated from Template, **2** Added — the flow writes 1, Build a report/plan writes 2), `lm_reportoccurrence` → the report,
`lm_sourcesectionchecklistitem` → the Template section it came from.

`lm_reportsectioncitations` — key `lm_reportsectioncitationsid`; `lm_name` (the
flow's "Label Text"), `lm_kind` (1 KPI, 2 Breakdown, 3 Process, 4 POC, 5 Project,
6 Strategy, 7 BI Report, 8 Paragraph, 9 Issue, 10 Task, 11 Child Report),
`lm_breakdowndimension`, and lookups `lm_KPI` → **`strategy_kpises`**,
`lm_Process` → **`strategy_processes`**, `lm_CitedSection` →
`lm_reportoccurrencesectionses`, `lm_CitedReportOccurrence` →
`lm_reportoccurrences`. ⚠️ **No lookup to the report itself**, so a citation
reaches its report only through its section. `lm_ChildReportTemplate` exists in
DT New (the flow designer shows it) but not in this repo's cached schema, and
its logical name is unconfirmed.

**Reading lookup names and choice labels:** list reads through the adapter carry
`<field>@OData.Community.Display.V1.FormattedValue` annotations, e.g.
`_lm_kpi_value@…FormattedValue` for the KPI's name and
`lm_kind@…FormattedValue` for the kind label. Don't `$select` the schema's
read-only `lm_kpiname`-style columns; use the annotation instead.

### `lm_setupactivity` — the audit trail for Setup templates (10 Sep)
One table serving **both** Report and Meeting templates, registered as
`lm_setupactivity` (singular logical name, entity set `lm_setupactivities`). It is
a flat log serving both kinds. ⚠️ **Corrected 16 Sep:** this entry used to say it
carries the Setup's id "as a plain text column rather than two optional lookups".
That is wrong. The table has **two real optional lookups**, `lm_MeetingTemplate`
and `lm_ReportTemplate`, and `logSetupActivity()` binds whichever matches the
kind — exactly the either/or shape used elsewhere in this schema. It also has
`lm_ActorUser` → `systemusers`.

Facts worth knowing before touching it:
- The **before/after text columns are 2000 characters**, and Dataverse **rejects
  with a 400 rather than truncating**. `dataverse.js` has a `trimmed()` helper for
  exactly this — unlike `capped()`, which throws. Never feed an activity value
  through `capped()`; a long field description would then block the whole save.
- The action choice's **label for code 3 is `Editopened` — no space.** That is
  what is deployed; `SETUP_ACTIVITY_ACTION_KEY` matches it verbatim. Don't "fix"
  the label without changing the map.
- Logging **must never fail a save.** Every activity write is fire-and-forget: it
  is queued while the Setup is still local, flushed after the parent row's id
  exists, and a failure is `console.warn`ed only. A Setup that saved but whose
  activity row did not is the correct outcome, not an error state.
- Because the log is written *after* the parent, an activity row for a
  **brand-new** Setup can only be written once the create returns. `ACTIVITY_QUEUE`
  in `GovernanceApp.jsx` holds those rows against the local id and rewrites them
  to the Dataverse id on flush.

### Version numbers only increase on publishing a revision — and the trigger is subtle
`lm_version` on both template tables is an integer the app owns; Dataverse does
not maintain it. The rule is: **a Setup's version increases when an approved Setup
is edited and re-published.** Publishing a Draft for the first time gives version 1.

⚠️ The part that is easy to get wrong, and was wrong until 10 Sep: **by the time
`publish()` runs, the Setup is no longer approved.** Opening the editor
(`A.edit()`) flips Active / Approved → Under Review immediately, so any check of
the form "was this approved?" asked at publish time always answers no, and the
version silently never moves past 1. The version an edit *started from* has to be
recorded when the editor opens — that is what the module-level `REVISING` map is
for — and read back through the shared `nextVersionFor()` helper. The Publish
preview modal uses the same helper, so the number shown to the user and the number
written are the same value by construction.

`REVISING` is deliberately **not** stored on the Setup object: the edit form
rebuilds its own state and writes the whole object back, so a marker living on the
record can be lost by the very save it is meant to survive.

### Child rows are reconciled by a natural key — which not every child has
As of 10 Sep, three child collections are diffed rather than deleted and recreated
(see §5), and the key is what makes that possible:

| Child | Key |
|---|---|
| Template per-unit rows | the BU **or** Region lookup |
| Attendees | the Position, within its unit |
| Review chain steps | the step number, within its unit |

Everything else — agenda items, report lines, KPIs, Processes, checklist items,
section items — is **still delete-and-recreate**, because those rows have no
stable natural key and nothing references their ids.

⚠️ Two live limitations of the reconcile path:
- **Attendee type is not diffed.** The create path hardcodes Core, so switching an
  existing attendee to Supportive does not persist.
- **Clearing a lookup still does not clear it.** Dataverse will not null a lookup
  through a plain PATCH value (it needs the `/$ref` DELETE form). The old
  delete-and-recreate path cleared lookups as a side effect of deleting the row,
  so reconcile makes this limitation *visible*, not new.

### `lm_meetingoccurrencedepartmentfunction` — the departments on an occurrence (13 Sep)
Entity set `lm_meetingoccurrencedepartmentfunctions`, logical name singular. One
row per Department/Function line, all hanging off one Meeting Occurrence.

| Column | Note |
|---|---|
| `lm_name` | **required**, 850 — must be built; there is no default |
| `lm_Department` | → `cr603_chklst_departmentses` |
| `lm_Function` | → **`hr_functions`** — HR's table, not an `lm_` one |
| `lm_MeetingOccurrence` | → `lm_meetingoccurrences` |
| `lm_departmentname` / `lm_functionname` | read-only denormalised names |

⚠️ **The Function lookup is the trap.** Every other lookup in this area is `lm_`
or `cr603_`; Functions are `hr_functions` / `hr_function`. Pattern-matching from
the neighbouring bindings produces a name that does not exist.

⚠️ **A line can carry a Department, a Function, or both.** Bind only the lookups
that have a value — a null GUID binding errors — while `lm_name` is required and
therefore cannot be skipped the same way.

Note this table **records** scope; it does not drive a fan-out. Its Report
namesake `lm_reportoccurrencedepartmentfunctions` looks identical but means the
opposite: there, one row per department is one *report* per department.

### A lookup's display name is already on the row — no `$expand` needed
Both Meeting per-unit tables carry a **read-only denormalised name column**, kept
in step by Dataverse, holding the related record's primary name:

| Table | Column | Mirrors |
|---|---|---|
| `lm_meetingtemplatebusinessunitses` | `lm_businessunitname` | `businessunits.name` |
| `lm_meetingtemplateregions` | `lm_regionname` | `crd04_regionses.crd04_id` |

Select the column and read it straight off the unit row. This is what lets the
occurrence generator name a meeting after its unit without a second query per
row (§5, 13 Sep). The Report per-unit tables have the same pair.

⚠️ **The Region table has no `name` column.** `crd04_regionses` stores its display
name in **`crd04_id`** — a primary-name field someone called "ID", which
`fetchRegions()` already maps as `name`. Anything reaching for `name` on that
table gets nothing. `lm_regionname` mirrors whatever the primary name is, so the
denormalised column is also the shortcut past the trap.

### Two `lm_meetingoccurrences` column facts worth knowing before writing to it
- **`lm_name` is 850 characters**, not the 100 that most text columns on these
  tables are capped at. There is room to append a unit or a stage to a generated
  name without the usual 400-on-overflow risk.
- **`lm_date` is typed DateTime**, not Date Only. A filter of the form
  `lm_date eq 2026-09-15` therefore matches **nothing** — stored midnight is not
  equal to a bare date string. Any duplicate guard or day query has to use a
  half-open range: `lm_date ge <date> and lm_date lt <date+1>`. This fails
  *silently*, which is the dangerous part: the guard simply never finds the row
  it is looking for and the caller re-creates it.

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
- **Stray `lm_newcolumn`** on `lm_meetingtemplatedepartment_functions` — an
  accidental default-named column, safe to delete. ⚠️ **Corrected 08 Sep: the one on
  `lm_reporttemplatereviewchains` is NOT stray and must not be deleted.** It stores
  the reviewer's Position NAME (`dataverse.js`, `createReportTemplateChildren` writes
  `lm_newcolumn: step.positionName`) and all three chain queries select it back.
  Deleting it silently strips the position label off every Review Chain step.
- **`DATAVERSE_CONFIG.publisherPrefix` is `'lp'`** but every table is `lm_`.

### ⚠️ `pac modelbuilder build` reads an already-registered table's real choice values — this overturns a repeated "dead end" conclusion (17 Sep, later)

Every earlier attempt in this file to "refresh an already-registered table's
schema" used `pac code add-data-source` (legacy or modern connector, with or
without `-t`) or `power-apps add-data-source` — all confirmed dead ends,
repeatedly, across many tables. None of those attempts ever return a
choice column's actual option values even when they otherwise succeed: the
cached schema file only ever records `"x-ms-dynamic-values": {"operationId":
"GetOptionSetMetadata", ...}` — a pointer to resolve the values live, never
the values themselves (already known for `wlog_decisions`'s three choice
columns, §6 above; it turns out to be true of every choice column on every
table, not particular to that one).

**`pac modelbuilder build` is a different tool entirely and does not have
this limitation.** It talks to Dataverse's real metadata service directly,
not through a Power Apps connector, and generates a genuine C#/VB entity
class per table with a real enum per choice column, values included:

    pac modelbuilder build -enf <singular LOGICAL name> -o <scratch folder>

Then read `<scratch folder>/Entities/<name>.cs` for `public enum
<table>_<column> { Label = N, ... }` blocks.

⚠️ **`-enf` (`--entitynamesfilter`) wants the singular logical name, not the
plural entity set** — passing `lm_report_templates` (the entity set, used
everywhere else in this app including `dvTable()`) silently matches **zero**
entities ("Read 0 Entities", no error). Passing `lm_report_template`
(singular — the same `logicalName` already recorded per table in every
`power.config.json`'s `databaseReferences`) works. This is the exact same
singular/plural trap §6 already documents for `add-data-source -t`, just
biting a different command.

Confirmed working end to end 17 Sep against `lm_report_template`, to settle
what its `lm_reportcategory`/`lm_reporttype` choice lists actually hold
after the user edited them in Dataverse — the app's cached assumptions
(`REPORT_CATEGORY_KEY`, `REPORT_TYPE_KEY` in `dataverse.js`) were stale and
this is what fixed it, see §5. Only reads metadata; nothing to undo. An
unrelated `pac code add-data-source -a shared_commondataservice -t
lm_report_templates` tried moments earlier in the same investigation *did*
write real (if useless — same no-values limitation) files into the live
`apps/governance` project and had to be reverted with `git checkout --`;
`modelbuilder` needs no such cleanup since it writes only to `-o`'s target
folder, never into the project itself.

**Use this any time a choice column's real values are needed on a table
that's already registered** — it should have been reached for immediately
instead of re-confirming the `add-data-source` dead end.

⚠️ **Two more things learned running this a second time (17 Sep, same day,
finding `lm_fileattachement`):**
- **`-enf` takes a semicolon-separated list**, and reads every table in one
  call: `-enf "lm_report_template;lm_reporttemplatecontentchecklist"` reads
  both at once, no need to run it per table.
- **`modelbuilder` does not emit a text field's max length** — the generated
  C# property is just `string`, no `[StringLengthAttribute]` or similar. For
  that, the `add-data-source` route is still the only one that answers it
  (the connector schema's cached JSON has a real `"maxLength"` key on string
  columns) — worth the one-time write-and-revert into the live project when
  a cap genuinely matters (e.g. before writing to a new text column for the
  first time), but not needed just to confirm a column exists or read a
  choice list, where `modelbuilder` alone is faster and touches nothing.

### ⚠️ SharePoint file upload is not achievable through `pac code add-data-source` — confirmed, not assumed (17 Sep)

A `shared_sharepointonline` data source named `documents` was already
registered in an earlier session (`power.config.json`'s connectionReferences
already listed it), targeting the `SMO-AndalusialeadershipPractice` site's
document library (`20a0173f-dfd6-4537-84ca-ff60b9a09c79`) — but the
generated SDK had never actually been inspected or used by any app code.

**Re-running the same registration reproduced byte-identical files** (only
line-ending noise), confirming this wasn't new — just dormant. Reading the
generated `DocumentsService`/`DocumentsModel` and the raw connector schema
(`.power/schemas/sharepointonline/documents.Schema.json`) settled the
question of whether it could upload a file:

- The generated service is a plain CRUD shape — `create`/`update`/`delete`/
  `get`/`getAll` — treating the library like any other table, exactly like
  every other `pac code add-data-source` table this project has ever
  registered (Dataverse or otherwise).
- **Every field that could carry a file's identity is read-only**:
  `{Name}`, `{Path}`, `{FullPath}`, `{Link}`, `{FilenameWithExtension}` all
  show `"x-ms-permission": "read-only"` in the raw schema. `Title` and the
  library's own custom columns (Week/Month/Year/PDCA/Document Status/
  Related Process/Related KPI's) are writable — metadata only.
- **There is no content/body/media field anywhere** in the schema at all.

**Conclusion: this connector data source can update metadata on a file that
already exists in the library, but cannot create a new one with content.**
SharePoint's real upload operation ("Create file") is a distinct, dedicated
connector action in Power Automate/Power Apps terms — separate from the
generic list-item CRUD that table registration generates. Nothing in this
CLI exposes an arbitrary connector *action* (as opposed to a *table*) to a
Code App's generated SDK — `add-dataverse-api`/`find-dataverse-api` exist,
but are Dataverse-specific (native SDK messages), not connector actions in
general, and SharePoint's file-upload action isn't reachable through them.

**This is a tooling ceiling, not a permissions or configuration problem** —
confirmed by reading the schema's own field-level `x-ms-permission` flags,
not by a failed call or a guess. Don't re-attempt file upload through a
`pac code add-data-source`-registered connector without a different
mechanism in hand (e.g. a Power Automate flow that does the actual upload
and hands this app back a link) — the same wall applies to any other
connector's "create with content" action, not just this one.

---

### Confirmed 19-20 Sep (each of these cost a wrong turn first)

**There is no `_xxx_label` column. Ever.** A 400 took out the whole Decisions
read because the `$select` asked for `_wlog_decisionstatus_label` and two
siblings. `_x_value` is a **lookup's** id; a **choice's** display text is an
annotation, `x@OData.Community.Display.V1.FormattedValue`. The adapter already
asks for annotations on every list read (`PREFER_PAGED`), so the label arrives
without being selected. This is the same failure as `strategy_departmentname`
on `fetchKpis` in September — **one unknown column fails the entire query.**

**`pm_kpiachievments`, both unknowns closed.** `pm_month` runs **1..12 in
calendar order**, and **`pm_kpi` targets `strategy_kpis`** (relationship
`pm_kpiachievment_kpi`) — the same table the app's KPIs come from, so the join
is sound. `stf_department` and `stf_function` are **plain text**, so scope
matching is by name, case-insensitively, in the browser: an OData equality on
them is exact and silently returns nothing for "Quality" vs "quality".
⚠️ The table currently holds **test data only** — 1-3 rows per year, Business
Unit "test", every figure `100.0000`, years scattered 2025-2096.

**Why the Reporting hierarchy was flat — three wrong turns before the answer.**
All 30 Child Report citations are label-only (`lm_citedreportoccurrence` null
on every one). Attempt 1 matched their labels against **occurrence** names —
wrong, and occurrence names are not unique either ("23/9 Daily BU Report"
belongs to four rows). Attempt 2 matched them against **template** names —
right target, still no edges. The actual reason:

> Every one of those citations names *"Weekly Regional Engineering and
> Corporate & Community Relations Report"*, and **only two templates have any
> occurrence at all** — `Daily BU Report` (30) and `Weekly Group Digital
> Transformation Report` (2). The cited template has none. **There was no
> record to point an edge at.**

And the source of those labels: `insertTemplate` in `BuildReport.jsx` turned
every Child Template item into a bare label, with a comment saying so. That is
fixed, but **rows written before 20 Sep still carry only the label** — the
screen draws them as dashed "cited" nodes, and the citation row offers "Attach
an occurrence" to repair them one at a time.

**Entity-set plurals that bite.** Confirmed by `EntitySetName` in generated
code, not guessed: `crd04_specialties` → **`crd04_specialtieses`**, `hx_tasks`
→ **`hx_taskses`**, `wlog_decision` → **`wlog_decisions`** (note the SINGULAR
logical name — `modelbuilder -enf wlog_decisions` returns "Read 0 Entities").
`lm_meetingcategory` → `lm_meetingcategories`, which is NOT double-plural.

**Lookup targets confirmed from relationship names**, all via
`pac modelbuilder build -enf "<a>;<b>"` — a relationship is only emitted when
BOTH entities are in the generation set, which is the whole trick:

| Column | Targets | Relationship |
|---|---|---|
| `lm_meetingattendeeslist.lm_microsoftgroup` | `and_microsoftgroupmember` | `lm_meetingattendeeslist_MicrosoftGroup_and_microsoftgroupmember` |
| `lm_reportsectioncitations.lm_POC` | `stf_strategypoc` | `lm_reportsectioncitations_POC_stf_strategypoc` |
| `lm_reportsectioncitations.lm_Task` | `hx_tasks` | `lm_reportsectioncitations_Task_hx_tasks` |
| `lm_bireportdashboard.lm_kpi` | `strategy_kpis` | `lm_bireportdashboard_KPI_strategy_kpis` |
| `wlog_decision.lm_citedreportsection` | `lm_reportoccurrencesections` | `lm_wlog_decision_CitedReportSection_lm_reportoccurrencesections` |
| `hx_tasks.hx_assignee` | `systemuser` | `hx_tasks_Assignee_systemuser` |

**`wlog_decision` is a live table owned by another process.** 26 rows —
Pending 19, Waiting 4, Completed 3. **12** hang off a Work Log
(`wlog_worklog`); **16** have been escalated; **0** use
`lm_citedreportsection`, the one `lm_` column added for this app. Its columns
span three prefixes (`wlog_`, `pms_`, one `lm_`). Treat it as something to
read and contribute one link to, not to redesign.

**No data source needs registering any more.** The cross-environment adapter
addresses a table by its entity-set name, so adding one is a single
`dvTable('<entityset>', '<pkid>')` line — no `pac code add-data-source`, no
`power.config.json` edit. Six tables were added this way on 19 Sep. The
`databaseReferences` block in `power.config.json` is a leftover from the
original single-environment wiring and no longer gates anything.

## 7. Open decisions — these block work

1. **Is Setup Type "Accreditation Committee" or "Committee"?**
   Decides which occurrences get an Audit Grid. **The code currently disagrees with
   itself** — the seeded path scores every Committee, the live path (now built and
   in use) scores only accreditation ones. This is no longer a theoretical gap:
   the live Grid tab is real and gated on `accred` today, so resolving this
   decides whether real Committees are being under- or over-scored right now,
   not just whether a future feature gets built correctly.
2. **Where does the 0–6 authority level live?**
   The only candidate is `hr_level` (an HR grade). Visibility scope and role family
   exist nowhere. *Blocks the full Decisions workflow* (Direct vs. Authority-Check
   routing, Approval Cycle, Proposals) from ever moving off seeded data. Does
   **not** block the base `wlog_decisions` read/create wired this session (§5) —
   that table has no authority-check concept at all, it's a separate, flatter thing.
   **Revised 01 Sep — this blocks less than it looks like it does.** Re-read the
   backend while answering a question about this exact gap: `lm_authoritymatrixrows`
   (Type/Max Value/Required Level/Cycle), `lm_approvalcycles` + `lm_approvalcyclesteps`
   (ordered routing), the 5-value `DECISION_TYPE` enum, and `authorityCheckLive()`
   itself are **all already built, live and ready to call** — none of that needs
   building. What's actually still missing, precisely:
   (a) this authority-level question itself, unchanged;
   (b) a live table to hold an actual Decision record (Type/Value/Creator/Path) —
   nothing in Dataverse stores this today, `wlog_decisions` doesn't either (see §6,
   it has no Type/Value/Path columns at all, it's a different shape for a different
   purpose);
   (c) Proposals, Outputs (also needs the still-missing Tasks table), Observers,
   and the classification fields (Topic Nature/Categories, Impact, Confidentiality)
   the seeded UI filters by — none of these have a live equivalent anywhere.
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
   **Still paused, but one input is now settled (20 Sep):** File *columns* are
   fully solved in both directions — upload and download, cross-environment,
   with a read-only viewer (§6, "Dataverse File columns"). So "store the file
   in Dataverse itself" is a live option for this decision rather than a
   theory, and `lm_reportoccurrence.lm_attachementfile` already exists to hold
   it. This does **not** unpause the decision; it only means the option no
   longer needs proving.
7. **How does a live Decision link to the Meeting Agenda Item / Report that raised
   it?** `wlog_decisions` (§6) has no lookup column for either today. Deferred by
   explicit instruction (2026-08-31): the link is added later, base read/create
   was wired without it. Don't build the Report/Meeting-side "Decisions raised
   here" embedding (the other half of the original ask) until this lands — there
   is nothing to join on yet. **Candidate shape, discussed but not yet built**:
   two separate nullable lookups on `wlog_decisions` — one to
   `lm_meetingoccurrenceagendas` (Meeting Agenda Item), one to
   `lm_reportoccurrences` (Report) — never both on the same row, matching how
   this schema already handles "either/or" scope elsewhere (Business Unit vs.
   Region on occurrences) rather than one polymorphic field.
   **Partly answered 04 Sep, differently from that candidate.** `wlog_decisions`
   now carries **`_lm_citedreportsection_value`** — so a Decision links to a
   **Report Section**, not to a Report or an Agenda Item. What that still leaves
   open: there is **no path from a Decision to a Meeting Agenda Item**, so the
   Meeting-side half of the original ask ("Decisions raised here") has nothing to
   join on yet. Decide whether Meeting-raised Decisions are in scope; if they
   are, that lookup still has to be added.
8. **How does the new Reports & Plans citation composer (02 Sep, §5) reconcile
   with the already-live `lm_reportoccurrences` occurrence flow
   (`NewReportModal`/`DvReportDetail`/`dvReportOccs`)?** — **Answered, later
   the same day.** `lm_reportoccurrences` gains new child tables (Sections,
   Citations) plus a Template-side Section/citation-item model, per the
   approved plan at
   `C:\Users\Nourhan.AbdElSalam\.claude\plans\gleaming-greeting-zephyr.md`
   (see §5's second 02 Sep entry). Not yet built — every table in the
   plan's Part 1 needs to exist first, per explicit instruction. The
   seeded composer stays as-is and as the UI reference until then.
   **Moved on substantially 04 Sep**: six of the Part 1 tables now exist and
   are registered (§5), and the **Template side is built** — Sections with a
   Diagnostic Angle and multi-select KPI / Breakdown / Process / Child Template
   citations, in Governance Setup, for both create and edit. Still to do: the
   **execution side** (`lm_reportoccurrencesections` + `lm_reportsectioncitations`
   are registered but nothing reads or writes them), the **Sharing** step
   (`lm_reportoccurrenceshare` registered, columns not yet inspected), and
   wiring the orphaned `DvReportDetail` back into navigation.
   ⚠️ **The approved plan file is not readable from this machine** — it sits
   under `C:\Users\Nourhan.AbdElSalam\`, a different Windows user than the one
   this repo is checked out as (`nourh`). Copy it into the repo, or the next
   session will again be working from this file's summary rather than the plan
   itself.

---

### 9. Moving Governance Setup to the IT environment — DONE (22 Sep), access blocker resolved, GUID blocker stands as expected

**Resolved 22 Sep: access was granted, Governance Setup now reads/writes IT.**
Superseded everything below marked "Decided 20 Sep" / "blocked on access" — kept
for the row-count table and the GUID evidence, both still accurate.

- **Blocker 1 (privilege denial on 32 tables) is gone.** Verified directly, not
  assumed: `pac org select --environment https://org2f45e702.crm4.dynamics.com/`
  then an aggregate `pac org fetch` against `lm_report_template`,
  `lm_meetingoccurrence`, `lm_reportoccurrence`, `lm_meetingminutes`,
  `lm_auditgridinstance`, `lm_setupactivity` and `and_microsoftgroupmember` all
  read cleanly — no `prvRead` errors. **IT already holds real rows**:
  `lm_report_template` = 2, `lm_reportoccurrence` = 3. Not yet investigated where
  those came from — flagged for whoever opens the app next, since "rebuild fresh"
  (below) was decided without looking at what those two rows are.
- **Blocker 2 (missing tables) is unchanged, plus one more found.** `lm_authoritymatrixrow`,
  `lm_approvalcycle`, `lm_approvalcyclestep` still don't exist in IT (a genuine
  "not found in MetadataCache" from `pac org fetch`, not a permission error).
  **New finding: `wlog_decisions` doesn't exist in IT either** — not on the
  original blocker list, since that table wasn't registered yet when this
  decision was first written. The seeded Decision workflow and the live
  `wlog_decisions` list are both effectively DT-New-only concepts now; neither
  has anywhere to write if Governance-side code ever touched them (it doesn't
  today — Decisions is a Leadership-only screen).
- **Blocker 3 (GUID mismatch) is unchanged, confirmed again.** Re-pulled IT's
  `crd04_regions` directly: `KSA = 5cc005a9-b333-f011-8c4e-000d3aa9ba0c`,
  `EGY = 2a3de7a2-b333-f011-8c4e-000d3aa9ba0c` — identical to the ids already
  recorded below, so this was never an access problem and switching over does
  not fix it. **Decided (22 Sep): rebuild Setups fresh in IT rather than
  migrate** — no attempt was made to map DT New ids to IT ones.

**What actually changed, scope Governance-only as decided 20 Sep:**
`apps/governance/vite.config.js`'s `__DATA_ORG__` define changed from
`https://org319b4ea9.crm4.dynamics.com` (DT New) to
`https://org2f45e702.crm4.dynamics.com` (IT) — the one line the 20 Sep
groundwork entry said this would be. `apps/leadership/vite.config.js` is
untouched, still DT New. Verified in the **built** bundle, not just the
source: `apps/governance/dist/assets/index-*.js` contains the IT URL twice and
zero occurrences of the DT New URL; `apps/leadership/dist/assets/index-*.js`
still contains the DT New URL twice. Pushed to the live Governance app,
**`786c1b14-bf09-4dd7-a0a2-5730e87744fe`** (Code App Development,
`C:\tmp\cad-gov-new` staging folder), successful on the first attempt.

⚠️ **This corrects the "Deployment, settled" section's own claim that
`786c1b14…`/`d61c6237…` are unused orphans and `4912152c…`/`83db0ef8…` are
"the live pair."** Confirmed 22 Sep against the maker portal directly (App ID,
Modified timestamp) that `786c1b14…` and `d61c6237…` are the ones that have
actually been receiving pushes since at least 20 Sep — several "20 Sep" entries
in this file's own §5 already say so explicitly, in tension with "Deployment,
settled"'s table. Both app pairs still exist in Code App Development; treat
`786c1b14…` (Governance) / `d61c6237…` (Leadership) as current unless a future
session finds otherwise, and note this file's own deployment history has an
unresolved internal contradiction between these two sections.

⚠️ **Consequence, as already predicted 20 Sep and now real**: Governance
Setup and Leadership Execution no longer share a world. A Setup created
through the live Governance app now writes to IT; Leadership still reads only
DT New, so it will show nothing from it — no occurrence, no Position
resolution, nothing. **No Setups exist in IT yet** (only the 2 report
templates / 3 occurrences noted above, origin unconfirmed) — the first Setup
built there is a genuine fresh start against IT's own Regions/BUs/Departments/
Positions/KPIs, not a migration. The 73-row `lm_meetingcategory` bulk upload
(19-20 Sep, DT New) has **not** been re-run against IT — Category/
Classification pickers in the live Governance app will show empty until that
upload is repeated there.

**Not done, deliberately out of scope for this pass:** no code changed in
`src/` itself (the whole move is the one `vite.config.js` constant, per how
`xenv.js` was already built); no investigation of the 2 pre-existing IT rows;
no decision yet on whether Leadership ever follows Governance to IT, or
whether a bridge is built instead (the open question the 20 Sep entry already
named and left unanswered).

---

**Original entry below, dated 20 Sep, kept for the environment facts (row
counts, GUID table, the exact IT environment id) — its own "blocked" framing
is superseded by the above.**

**Decided 20 Sep: deferred until read/write access is granted on every table.**
Nothing has been changed in the code. `DATA_ORG` still points at DT New for
both apps.

**The environment.** IT = `24b23b77-4d64-e7f5-9796-36a7b12bb75e` =
`https://org2f45e702.crm4.dynamics.com/`. It holds far more master data than
DT New:

| Table | Rows in IT |
|---|---|
| `systemuser` | 12,594 |
| `cr603_organizationstructure` | 11,315 |
| `hr_employee` | 11,203 |
| `strategy_kpis` | 2,711 |
| `strategy_process` | 2,020 |
| `hr_function` | 252 |
| `cr301_specialtyksa_service_hub` | 158 |
| `cr603_chklst_departments` | 71 |
| `businessunit` | 36 |
| `crd04_regions` | 4 |

**⚠️ Blocker 1 — 32 of the app's 45 tables are privilege-denied, not empty.**
Dataverse names the missing privilege each time
(`is missing prvReadlm_MeetingTemplate privilege …`), which is how this is
known to be access and not absence. Denied: every `lm_*` table the app owns —
both Setup registers and all their child rows, occurrences, minutes, audit
grid, setup activity — plus `and_teamschannel`. A role missing `prvRead` has
no Create/Write either, so treat all 32 as no-access.

**⚠️ Blocker 2 — three tables do not exist in IT at all:**
`lm_approvalcycle`, `lm_approvalcyclestep`, `lm_authoritymatrixrow`.

**⚠️ Blocker 3, the one that rules out a partial move — THE GUIDs ARE
DIFFERENT.** Verified across regions, business units and departments; not one
id matches:

| | DT New | IT |
|---|---|---|
| Region EGY | `a463362c-534f-f011-877b-6045bd9cb0ae` | `2a3de7a2-b333-f011-8c4e-000d3aa9ba0c` |
| Region KSA | `1d60ab25-534f-f011-877b-6045bd9cb0ae` | `5cc005a9-b333-f011-8c4e-000d3aa9ba0c` |
| BU `AAC` | `54f97bff-5d1c-f111-8341-000d3a4b5321` | `af4d99f4-e950-f011-877a-6045bd95a3a6` |
| Dept `BD GI` | `eee1830f-26a4-f011-bbd2-7c1e52613218` | `5630ace5-1379-f011-b4cc-6045bd948c69` |

The id tails cluster by environment (`-6045bd9979f4`/`-7c1e52613218` in DT New,
`-000d3aa9ba0c`/`-7c1e5273f098` in IT) — independently created records, not a
copied solution. **The contents differ too**: IT has a fourth region (Africa)
and a different Business Unit list; `AAC` and `BD GI` were the only name
overlaps found in the samples, so matching by name would not rescue it either.

**What this rules out.** Reading master data from IT while Setups stay in
DT New — the obvious compromise — cannot work: a Setup would bind
`lm_Region`/`lm_BusinessUnit`/`lm_Department` to IT ids that do not exist in
DT New. **It is all-or-nothing per app.**

**Direction chosen (20 Sep), pending access:** Governance Setup reads and
writes IT; Leadership keeps reading DT New; Setups are rebuilt fresh in IT
rather than migrated. ⚠️ Two consequences to weigh before starting:
- Rebuilding is not just recreating Setups — every one is rebuilt against IT's
  own regions, BUs, departments, positions and KPIs, because no DT New id
  means anything there. The 73 uploaded `lm_meetingcategory` rows would need
  re-uploading too.
- With Governance on IT and Leadership on DT New, **the two apps stop sharing
  a world**: a Setup created in IT produces no occurrence Leadership can see,
  and its positions and departments resolve to nothing in Leadership's screens.
  Decide whether Leadership follows, or whether the generator bridges the two.

**When access lands, the change itself is small.** `DATA_ORG` is one constant
in the shared `src/services/xenv.js`, so making it per-app is the first step —
today, changing it moves both apps at once.

**How any of this was checked, for repeating it:**
`pac org select --environment <GUID>`, then `pac org fetch --xmlFile`.
⚠️ Two traps that cost time. The first: **`pac org fetch` crashes with a bare
.NET stack trace** on some results.

**Corrected 20 Sep — the earlier diagnosis here was wrong.** It is not that
"non-aggregate fetches crash against that org". The stack trace names
`bolt.system.GridOutput.ToTextGrid()`: it is the CLI's own **text-grid
renderer** failing on the result, not the query. The query succeeds and the
data comes back. An aggregate query avoids it only because it returns a
small, narrow result. There is **no `--json` flag** on `pac org fetch`, so
the way round it is to request fewer or shorter columns — and some tables
(`fileattachment`) crash the renderer whatever columns are asked for. Use
`<fetch aggregate="true"><attribute name="createdon" alias="n"
aggregate="count"/>` to count, which also surfaces the privilege error
cleanly), and a table list generated by a Python `print()` on Windows carries
**CRLF**, so every entity name arrives with a trailing `\r` and every table
looks absent — pipe it through `tr -d '\r'` first.

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
- **A source file can be silently corrupted mid-session** (08 Sep). A stray `3`
  and an extra blank line appeared at the top of `LeadershipApp.jsx`'s
  `DEFAULT_SETTINGS`, in a region nothing was editing, and broke the build with
  `Invalid characters after number`. `git diff` showed the committed version was
  clean, so it was introduced after checkout, not by an edit. Same suspected cause
  as the `node_modules` corruption below: this repo lives in a **OneDrive-synced
  folder**. If a build fails on a line nobody touched, diff before debugging.
- **`npm run build` can fail with `ERR_MODULE_NOT_FOUND` for a file inside
  `node_modules/vite/dist/node/chunks/`** (07 Sep) — a partial/corrupted
  install, with one specific chunk file missing while its neighbors are
  present. This repo lives inside a **OneDrive-synced folder**
  (`OneDrive - Andalusia Group\...`), which is the likely cause: OneDrive can
  lock or drop files mid-write during `npm install`'s tens of thousands of
  small file writes. Fix: `rm -rf node_modules && npm install` — no code
  change involved, and it isn't specific to any particular dependency.

- **⚠️ Moving a symbol between modules cannot be verified by building.** A free
  identifier — one the module neither declares nor imports — is a **runtime**
  `ReferenceError` in an ES module, not a build error. Rollup does not fail on
  it, and with lint blocked on this machine (above) nothing else looks either.
  This shipped `BIEmbed is not defined` to the deployed app after `CiteCard` was
  moved into `domain.jsx` and nine of its dependencies were left behind (12 Sep,
  §5). **After any extract-and-move, scan for free identifiers**: strip comments
  and double-quoted strings, collect every `<Capitalised` JSX tag and every
  `name(` call that is not a property access, and subtract everything the file
  declares, destructures, imports or takes as a parameter. Two traps in writing
  that scan: never strip single-quoted strings (an apostrophe in JSX prose —
  `isn't` — pairs with the next one and swallows the code between them, which
  hid a real declaration on the first run), and expect prose words from inside
  JSX text as false positives. Over-reporting is the right failure mode; check
  the hits by eye. The script is committed at **`scripts/undef-scan.py`** — run
  `python scripts/undef-scan.py`; it lists the files it covers at the top, so
  add any new extracted module to that list.
- **⚠️ There are TWO Dataverse connectors and only one of them can cross
  environments** (16 Sep). `shared_commondataserviceforapps` ("Microsoft
  Dataverse") is the one that generates `MicrosoftDataverseService` with the
  `*WithOrganization` operations. `shared_commondataservice` ("Microsoft
  Dataverse (legacy)", formerly Common Data Service) is a **different API** and
  has none of them — this repo already uses it for 5 tables, which makes the
  names easy to confuse. When creating the connection in the maker portal, pick
  **"Microsoft Dataverse"**, *not* "Microsoft Dataverse (legacy)"; the first
  connection created for the Amr Space trial was the legacy one and could not
  be used. `pac connection list` shows the API id, which is the only reliable
  way to tell them apart. Note also that **`pac connection create` cannot make
  a user connection** — it requires `--application-id` and `--client-secret`,
  i.e. a service principal — so a user connection has to be made in the portal.
- **⚠️ `pac code add-data-source` can fail for EVERY table at once, with an
  empty error body** (16 Sep). Symptom:
  `Failed to get entity definition for table 'x' from organization '…': {}`.
  It ran successfully earlier the same day, then failed on a known-good table,
  in a known-good project, against the right org, on three consecutive
  attempts and again an hour later. **Do not conclude from this that a table is
  missing** — that is exactly the wrong inference, and it was drawn once in
  this session before a control test against a table that certainly exists
  showed the same failure. Adding a *connector* (no `-t`) is unaffected, because
  it needs no table metadata; only table registration is blocked.
- **`power-apps push` fails on a timeout roughly half the time** (16 Sep,
  sharpening the 12 Sep note; 17 Sep confirmed it is not one endpoint). It has
  failed on `POST …/generateResourceStorage` and, on 17 Sep, on
  `GET …/powerapps/environment?$filter=name eq '…'`. Pushes this week needed 1,
  2, 2, 1, 3 and 1 attempts. The push is idempotent — run it again; a failure
  followed by a success means the app is pushed once, not twice. A retry loop
  that stops on `pushed successfully` is the practical form.
  ⚠️ **A run of failures can be specific to one app** (17 Sep): Governance
  failed on `generateResourceStorage` 13 times straight while Leadership, pushed
  between those attempts, went through first time — identical staging folders,
  so nothing in the upload was at fault. Rapid retries did not help. **Spacing
  them a minute apart did**: it succeeded on the second spaced attempt. When
  immediate retries keep failing for one app only, wait between attempts rather
  than retrying harder.
- **⚠️ An environment can be reachable but missing from every CLI list — select
  it by URL** (17 Sep). Code App Development is absent from both `pac env list`
  and `pac admin list`, although the account is Admin there and it shows in the
  maker portal. `pac env select --environment <GUID>` searches those lists and
  fails with "No Dataverse organization was found matching the specified
  criteria"; `--environment https://<org>.crm4.dynamics.com/` connects directly and
  works. **That error does not mean you lack access** — try the URL before
  concluding anything, and confirm with `pac org who`.
- **Deploying an app to an environment other than DT New — the working recipe**
  (17 Sep). Use a staging folder so `apps/*/power.config.json` stays bound to DT
  New:
  1. `npm run build` in the repo.
  2. `pac env select --environment <target URL>` — the connector must be added
     while the target is the active environment.
  3. In an empty folder: `power-apps init --non-interactive --environment-id
     <target GUID> --app-type CodeApp --display-name "…" --build-path ./dist
     --file-entry-point index.html --app-url http://localhost:300x`.
  4. `pac code add-data-source -a shared_commondataserviceforapps -c <a
     connection that belongs to the TARGET environment>` — find it with
     `pac connection list --environment <target URL>`, API id must end
     `forapps`.
  5. Check `src/generated/services/MicrosoftDataverseService.ts` declares
     `dataSourceName = 'commondataserviceforapps'`, matching the bundle.
  6. Copy `apps/<app>/dist` into the folder and `power-apps push`, retrying on
     timeout. The first push writes the new appId into that folder's config.
  7. `pac env select` back to DT New.
  The staging config has **no `databaseReferences`**; nothing needs them, and in
  the target they would name tables that do not exist.
- **⚠️ Power Automate: `0x80060888 — Error in query syntax` never names the
  column** (13 Sep). It means Dataverse could not *parse* the text in a
  `Filter rows`, `Select columns` or `Order By` box — not that a column is wrong.
  A wrong column name gives a different message (`Could not find a property named
  'x'`), so seeing `0x80060888` tells you the names are fine and the string is
  not. Two things produce it, and neither is visible in the designer:
  **a line break** pasted into the box (documentation that wraps a long filter
  for readability is the usual source), and **an expression that resolved to
  nothing** — `_lm_businessunit_value eq @{outputs('UnitId')}` becomes
  `_lm_businessunit_value eq ` when the Compose is empty or missing. To find it,
  open the failed run → the failed action → **Inputs**, which shows the filter
  fully resolved; the gap after the `eq` is then obvious. Both bit the Meeting
  Occurrence flow on its first live run (§5).
- **⚠️ Power Apps blocks `frame-src app.powerbi.com` — a Power BI report cannot
  be embedded in this app, at all** (11 Sep). This is settled; do not spend time
  on it again. The host page's Content-Security-Policy is served by Power Apps
  and cannot be changed from the code app, and the block was **confirmed by
  evidence, not assumed**: a `securitypolicyviolation` listener fires with
  `violatedDirective: "frame-src"` and `blockedURI: "https://app.powerbi.com"`
  the moment the iframe is attached. What does *not* help, so don't retry it:
  rewriting the portal URL to `/reportEmbed`, adding `autoAuth=true`, passing
  `ctid`, the `powerbi-client` / `powerbi-client-react` libraries (they inject
  the same iframe into the same page), or signing the user in to Power BI on app
  open (the frame never loads far enough to *ask* for a login — the browser
  refuses the navigation before any request is sent). Two things do work and are
  both implemented on the Business intelligence screen: a **popup viewer**
  (`window.open`, a real top-level browsing context, so no `frame-src` applies)
  and a **native figures panel** rendering the numbers in the app's own markup.
  Note the earlier CSP evidence in this repo's history was `connect-src` (a
  URL-shortener fetch), which is a *different* directive — `frame-src` was
  verified separately.
- **⚠️ OneDrive can dehydrate a source file mid-session and leave it unreadable
  by the build** (12 Sep). Two files — `LeadershipApp.jsx` and
  `governance-modern.css` — became Files-On-Demand placeholders: file attributes
  `4199968` (`FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS`), stale modified timestamps,
  and a build failing with **`ERROR_CLOUD_FILE_VALIDATION_FAILED` (os error
  383)**. Only 2 of 117 tracked files were affected, so a green `git status` is
  no reassurance. **The placeholder cannot be hydrated back** by touching or
  copying it — the cloud copy is what got corrupted. Recovery route that worked:
  rebuild from the newest clean source (an off-OneDrive snapshot, or
  `git show HEAD:<path>`) and **replay the session's edits as file-based
  scripts**, then verify by grepping for the expected content — *not* by a green
  build, which only proves the file parses. This is the fourth OneDrive-caused
  failure recorded in this section. **Move the repo off OneDrive.**
- **⚠️ `.git` itself got corrupted — a missing packfile, not just a missing
  source file** (15 Sep, the fifth and worst OneDrive-caused failure recorded
  here). First symptom: VS Code's Source Control panel reported `Git: invalid
  object 100644 <hash> for '.power/schemas/dataverse/businessunits.Schema.json'`.
  `git fsck --full` found the real damage: one pack's `.idx`/`.rev` survived
  with **no matching `.pack` file**, plus roughly 50 leftover `tmp_pack_*`
  files (~2.5 GB) from failed transfers — consistent with OneDrive
  interrupting a `git gc`/fetch mid-write, the same failure mode as the
  dehydrated-file incidents above, just landing on `.git/objects` instead of a
  source file this time. **Recovery, without moving or renaming the working
  folder** (the top-level directory and `.git` were locked by a live process,
  almost certainly VS Code, so a folder swap wasn't an option): clone the
  same branch fresh to a short path outside OneDrive (a long path under this
  repo's own `OneDrive - Andalusia Group\...\scratchpad\` failed with
  `Filename too long` on Windows — use something like `/c/tmp/`; a dropped TLS
  connection mid-clone needed `-c http.postBuffer=524288000 -c
  http.version=HTTP/1.1` to retry through), remove the orphaned `.idx`/`.rev`,
  the stale `multi-pack-index`, and every `tmp_pack_*` file from the broken
  repo's `.git/objects/pack/`, then copy the complete pack triplet
  (`.pack`/`.idx`/`.rev`) from the verified fresh clone into that same
  directory. `git fsck --full` came back clean (one harmless dangling commit)
  with no folder rename, no `git clone --mirror` replace, and no lost commit
  history. **`git commit` and `git diff --cached` still worked throughout**,
  even with the pack missing, because they didn't need to read that
  particular object — so "the commit command still runs" is not proof the
  repository is intact; run `git fsck --full` when anything git-related
  throws an unfamiliar error, not just when a push fails outright.
- **`pac`/`power-apps push` times out on `generateResourceStorage`** (12 Sep) —
  `Network request failed for POST …/powerapps/generateResourceStorage?api-version=1.
  Connection timed out`. Authentication is fine (the CLI reports the connected
  account); the failure is the network reaching an Azure Private Link host. Retry
  first — it is usually transient. If it repeats, it is an IPv6/VPN path problem
  rather than anything in the app, and the push is safe to re-run: it is
  idempotent.
- **There is no lint, so hooks-after-early-return has to be scanned for by
  hand** (10 Sep). React error **#310** ("Rendered fewer hooks than expected")
  shipped twice from the same mistake: a `useState` added to a screen *below* an
  `if (…) return …`. Any component with an early return must have every hook
  above it. With oxlint blocked (see above), the substitute is a scan script that
  walks each `function Screen*`, finds the first `return` at the top level of the
  body, and flags any `use*(` call after it. Run it after adding state to an
  existing screen.
- **The CSS minifier rewrites media queries into range syntax, which breaks
  older Safari** (09 Sep). Lightning CSS emitted `@media (width<=760px)` from a
  `max-width:760px` source rule. Safari did not support that syntax until 16.4,
  so an iPad on iPadOS 15 or 16.0 silently ignored **every** responsive rule in
  the bundle. Fixed by pinning `build.cssTarget: 'chrome61'` in
  `vite.config.js`. This changes the emitted syntax only — no rule is altered.
  Check the built CSS, not the source, when a breakpoint "doesn't work" on a
  device.
- **A patch script that opens a file for writing empties it before it encodes
  anything.** `open(path,'w').write(text)` truncates the moment it opens; if the
  `write()` then raises, the file is left at **zero bytes** and the traceback
  says nothing about the loss. Python evaluates the `open()` call before the
  argument, so `open(path,'wb').write(text.encode('utf-8'))` fails exactly the
  same way. Encode into a variable on its own line first, *then* open. The
  trigger seen here was a lone surrogate reaching `encode()` — a doubled
  backslash in an escape like `\\ud83d` collapsing to a single one somewhere
  between the editor and the interpreter, which Python then reads as half a
  character. Write emoji as literal characters, not escapes.
  **Recovery, when it happens:** `git show HEAD:<path> > <path>`, re-run each
  patch script in order, and compare the character count each one prints against
  what it printed the first time. Matching counts prove the restored base was
  the same base, so nothing uncommitted was lost.
- **Backtick-quoted patch scripts get mangled by the shell.** Writing a
  JS/Python patch script inline through a shell heredoc strips template literals
  and backticks, producing a script that runs but patches the wrong text. Write
  patch scripts to a file with the Write tool and execute the file.

---

## 9. Remaining features checklist

Organized by what actually unblocks each item — not by how big it feels.

### Done
- [x] **Audit Grid scoring UI.** Built — `liveScoreGrid()` computes all 16
      questions from live data, and the full Facilitator→Chair lifecycle writes
      through the backend functions. **Still gated by Open Decision §7.1** —
      the UI only appears for `accred` (Accreditation Committee) occurrences,
      so resolving that decision may mean it should show for more (or fewer)
      occurrences than it does today. AG-10…AG-14 stay Not Applicable until
      Tasks/Decisions exist.
- [x] **Committee Scores tab gone live** (01 Sep) — `ScreenGrid` reads
      `fetchAuditGridInstances()` joined against `dvMeetingOccs` instead of
      seeded `db.grids`. See §5.
- [x] **Two silent-data-loss bugs in Work Queue/Meetings/Calendar, fixed**
      (01 Sep) — an overdue Meeting with partial attendance recording used to
      vanish from Work Queue, and any row with a blank/unrecognized
      `lm_meetingstatus`/`lm_status` used to vanish from every screen at
      once (41 of 44 live Meeting Occurrences were affected). See §5/§6.
- [x] **Reports & Plans citation-based composer, on seeded data** (02 Sep) —
      Register/Section templates/Paragraph pool/Reporting hierarchy, ported
      from `prototype.html`. **Deliberately reverted the tab from the live
      `dvReportOccs` flow back to seeded**, since that flow has no
      section/citation concept and no table exists for one yet. See §5's
      02 Sep entry and Open Decision §7.8 before building this onto real
      tables.

Nothing is currently sitting in a "ready to build, just not built yet" state —
the two items that were here (Edit/Cancel/Reschedule/Agenda, then Audit Grid
scoring) have both been picked up. Everything left below is blocked on
something, except the one item below that's now live at a base level.

### Live, base only — not the full feature
- [x] **Decisions, base plumbing.** `wlog_decisions` read + minimal create
      wired this session as its own list on the Decisions tab (§4/§5). What's
      still missing, in order: (1) a lookup column linking it to a Meeting
      Agenda Item / Report — Open Decision §7.7, deferred on purpose; (2) once
      that exists, embedding it into the Report/Meeting Follow-up tabs, which
      is the other half of the original ask; (3) the seeded Decision workflow
      (Direct/Authority-Check routing, Approval Cycle, Proposals) staying
      seeded-only until Open Decision §7.2 resolves — `wlog_decisions` was a
      deliberate choice not to build that onto this flatter table.

### Done (09-12 Sep)
- [x] **Whole-app responsiveness** — phones and iPads, both modules. Breakpoints
      at 1024 / 860 / 760 / 560 plus a coarse-pointer block. See §5 and §8 for
      the four bugs this surfaced, one of which (`cssTarget`) had been silently
      disabling responsiveness on older iPads.
- [x] **Meeting cadence: Twice Weekly, Twice Monthly, Semesterly** — three
      columns wired end to end. Annual still blocked on one column (below).
- [x] **Setup activity trail** — `lm_setupactivity` wired for create / edit /
      publish / approve / expire, and read live into the Activity tab.
- [x] **Version bump on re-publish** — was broken, now correct; see §6.
- [x] **Incremental child saves** — adding one BU or Attendee no longer rewrites
      the rest. Two known limits recorded in §6.
- [x] **Governance Settings merged into nine cards** — each setting appears
      exactly once. Still simulation-only; persistence is blocked below.
      ⚠️ **The whole screen was removed 14 Sep** — see §5. Kept here as the
      historical record of what was built, not as current state.
- [x] **Approved-only Ad Hoc pickers, with search** — both Meeting and Report.
- [x] **Search on the Meetings and Reports registers.**
- [x] **`Artifact` nav group** — Business intelligence, Reports / Plans,
      Reporting hierarchy, each in its own file under
      `src/modules/leadership/screens/`.

### Blocked — needs a new Dataverse column
- [ ] **Annual meetings** — add **`lm_month`** (1–12, 1 = January) to
      `lm_meetingtemplates`, matching the column already on
      `lm_report_templates`. The flow branch and the form change are written;
      only the column is missing. Until then the Meeting wizard shows a note
      where the Month dropdown belongs. See §6.

### Blocked — needs a new Dataverse table
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
- [x] **Reports & Plans content model — schema now largely exists** (04 Sep).
      Six tables registered this session (§5) on top of the two KPI tables from
      02 Sep. Open Decision §7.8 is answered and the plan's Part 1 is
      substantially done.
- [x] **Report Template Sections — built** (04 Sep, Governance Setup, create
      *and* edit). Diagnostic Angle plus multi-select KPI / Breakdown / Process /
      Child Template citations, with BU/Department scope filters and per-kind
      colour. Round-trip **not yet verified against live Dataverse**.
- [x] **Report Template create/edit round-trip audited and repaired** (05 Sep) —
      destination derived from the Team Channel, Stage stored in `lm_stage`,
      saved-name clashes caught, twice-weekly/twice-monthly/semesterly cadence
      completed. See §5. **Not yet verified against live Dataverse.**
- [x] **Report Template Review Chain per-unit lookups wired** (08 Sep) — saving now
      uses `lm_ReportTemplatePerBusinessUnit` / `lm_ReportTemplatePerRegion`, reads
      accept either pair, and the group-wide query null-checks all four. See §6.
      **Not yet verified against pre-06-Sep rows** — see the warning there.
- [ ] **Module split — foundation done, screens not moved** (08 Sep). `shared/format.js`,
      `shared/ui.jsx`, `store.jsx` and the `SCREENS` registry are in and green.
      Remaining: extract `domain.js`, then `seed.js`, then one screen file at a time
      (Settings → Grid → Meetings → Workspace → Calendar → Decisions → Reports →
      Minutes). Until a screen is in its own file, moving a tab to Governance is
      still a copy job out of a ~10k-line file.
- [ ] **`gridSubmitHours` is stored but unconsumed** (08 Sep) — the Audit Grid has no
      submission timer reading it. Still open: the value lives on in
      `DEFAULT_SETTINGS` (14 Sep, §5) even though its editing UI is gone. Either
      wire it into the Grid lifecycle or drop the setting entirely.
      ⚠️ **Do not confuse this with the per-Setup `gridSubmitHours` added 15 Sep**
      (§4, §5) — that one is a real Dataverse column (`lm_gridsubmithours`) on
      an individual Meeting Setup, persists correctly, and is a completely
      separate value from this global `DEFAULT_SETTINGS` one. Both are
      unconsumed by AG-16/AG-05 scoring today; fixing one does not fix the
      other, and which of the two (if either) should actually drive scoring
      is still an open design question.
- [x] **Two settings edited in two places — resolved by removal, not by choosing
      one place.** (08 Sep, moot 14 Sep) `momWriteupHours`/`momApprovalHours` used
      to appear as timing cards *and* value cards on Governance Settings. That
      whole screen is gone (§5), so there is now zero places to edit them from the
      UI, not one — the underlying duplication question no longer applies.
- [ ] **`qualifier` still does not survive an edit** — the last of the four audit
      gaps. The name is recomputed on every save and includes it, so a Template
      can silently rename itself. Needs somewhere to store it, or a decision that
      the qualifier lives only inside the derived name.
- [ ] **Meeting Occurrence generator (Power Automate).** Planned in full — the
      artifact in §10, rebuilt 08 Sep to the Report flow's structure with a 12-step
      build guide and the one-occurrence-per-unit rule. Blocked on its own open
      items: five of nine frequencies have no columns, there is no holidays table for
      the roll-forward, and Meeting Setups carry no times. Not built, only planned.
- [ ] **Report Occurrence generator (Power Automate).** Planned in full —
      `REPORT-OCCURRENCE-FLOW-PLAN.md`. Blocked on its own open items, chiefly
      the citation parent lookup, the missing month-of-year column (resolved
      05 Sep), and (07 Sep) confirming `lm_ChildReportTemplate`'s real
      logical name against live Dataverse. **Redesigned twice on 07 Sep** —
      see §5: occurrences now fan out one-per-department via Loop CD (not
      Loop DF's shared child table, which is now unused), and Child Report
      citations set a Template reference instead of guessing an occurrence.
      The flow itself is still not built, only planned.
- [ ] **Report/Plan Composition, execution side.** `lm_reportoccurrencesections`
      and `lm_reportsectioncitations` are registered but **nothing reads or
      writes them** — this is the Build-a-Report half, and the natural next
      step. The seeded composer in `LeadershipApp.jsx` (02 Sep) is the UI
      reference; porting it is likely far less work than building fresh.
- [ ] **Sharing.** `lm_reportoccurrenceshare` is registered, columns not yet
      inspected. The plan's open question about whether Dataverse record-sharing
      (`GrantAccess`) is reachable from this SDK at all is still unanswered.
- [ ] **Re-connect `DvReportDetail` to navigation** — orphaned since 02 Sep,
      still works against live Dataverse. No schema dependency; it was held back
      only by the "nothing until Part 1 exists" instruction, which has now
      largely lapsed.

### Blocked — needs a decision, not a table
See §7 in full. In priority order by what they unblock: Setup Type (Audit Grid),
authority-level location (seeded Decision workflow), Custom Report reviewers,
quorum definition, Decision↔Meeting/Report linking (§7.7, deferred on purpose).

### Paused — by explicit instruction, not by a blocker
- [ ] Real file storage for Report working copies (SharePoint upload or
      equivalent) — see §7.6. Don't pick this up without asking first.

### Smaller, self-contained gaps
- [x] **Commit the working tree.** Resolved — branch `leadership-practice`,
      HEAD `36b5e05` as of 15 Sep, with `64af9cc` and `36b5e05` both pushed to
      `origin/leadership-practice`. (The commit at `36b5e05` was made outside
      this file's own session narrative — worth noticing if `git log` and this
      file ever seem to disagree about what's committed; trust `git log`.)
- [x] ~~Settle whether `create` returns an id.~~ **Made moot 17 Sep**: the adapter
      supplies the primary key itself (§6). Still worth one
      `window.__xenvSmokeTest()` from the running app — it now reads the row
      back, which is the real proof a create landed in DT New.
- [ ] **Confirm Approve saves, against real latency** (17 Sep). Create a Meeting,
      publish, approve at once, then check DT New → `lm_meetingtemplates` →
      Data: **one** row, status Active / Approved. The timing fixes are verified
      only against a simulated Dataverse (§5).
- [x] ~~Correct the names in `REPORT-OCCURRENCE-FLOW-PLAN.md`~~ — done 17 Sep, all
      six (§5), with the empty-lookup Compose pattern noted at the top.
- [ ] **Correct the same six in the Report Occurrence Generator artifact**
      (`db1d9a44-8e51…`). Anyone building from the artifact rather than the `.md`
      still hits `BadRequest` / `ODataUnrecognizedPathException`.
- [ ] **Run one real Save draft in Build a report/plan** (17 Sep). The save diff is
      verified against mocks only. The first real save is also the first proof
      that `@odata.bind` lookups are accepted on creates through
      `CreateRecordWithOrganization` — which the rest of the app's child-row
      saves depend on too. Add a section with a KPI citation, save, then check
      DT New → `lm_reportoccurrencesections` and `lm_reportsectioncitations`.
- [ ] **Submit for review from Build, then confirm** the report shows In Review
      and a `lm_reportoccurrencehistories` row exists.
- [ ] **Paragraph citations and report sharing** are not supported in Build (§5):
      the first needs a target-section column on `lm_reportsectioncitations`, the
      second needs `lm_reportoccurrenceshare`'s columns inspected.
- [x] ~~Reporting hierarchy is still seeded.~~ **Stale — gone live 19-20 Sep**
      (§5), reading `lm_reportoccurrences` + `lm_reportsectioncitations` of
      kind Child Report. This line was never updated when that landed; left
      as a marker that this checklist can drift behind §5, not as current
      state. **21 Sep:** a second, independent tree was added on top —
      Report Templates, reading `lm_reporttemplatecontentchecklists` +
      `lm_reporttemplatesectionitems` — via a `seg-ctl` toggle on the same
      screen. See §5's 21 Sep entry. Not yet verified against live Dataverse
      (no known Template in DT New has a child-Template citation or file yet
      to check the graph against).
- [ ] **The DT New-hosted apps lack every 16–17 Sep fix** (Governance `7caa2fb2…`,
      Execution `0f077a0a…`). Only the Code App Development copies are current.
- [ ] **Confirm the Code App Development deployments against DT New** — now
      the current apps, `786c1b14…` Governance and `d61c6237…` Leadership
      (the 17 Sep ones above, `4912152c…`/`83db0ef8…`, are orphaned — see
      §5's "re-registered from scratch" entry). Sharpened by a real signal,
      not just a standing gap: the Governance app's KPI picker showed
      built-in sample data instead of live `strategy_kpises` rows when
      actually run there (§5/§6, "KPI-picker live-data warning"). Run
      `await window.__xenvSmokeTest()` from that app's browser console —
      result still pending — before assuming this is fixed by anything done
      so far.
- [x] ~~Create a `shared_commondataserviceforapps` connection in any environment
      that will host an app.~~ Done for both hosts used: Code App Development
      (`c83ec8cc…`) and Amr Space (`9787e3c9…`). Any *new* host still needs one —
      see the recipe in §8.
- [ ] **Delete the Amr Space copies** once Code App Development is confirmed:
      Governance `e78a0887…` (also bound to the wrong connection) and Leadership
      `936f78d8…`.
- [ ] **Keep the two staging folders' appIds somewhere durable — this already
      happened once.** `C:\tmp\cad-gov`/`C:\tmp\cad-exec` were lost, which is
      exactly why Code App Development now has two orphaned apps
      (`4912152c…`, `83db0ef8…`) alongside their live replacements
      (`786c1b14…`, `d61c6237…`, staged at `C:\tmp\cad-gov-new`/
      `C:\tmp\cad-exec-new` — see §5's 17 Sep "re-registered from scratch"
      entry). There is still no CLI command to reconnect to an existing code
      app without its original local folder, so losing these two again means
      repeating the exact same thing a third time. Worth deciding whether
      these become real app roots under `apps/`, committed to the repo,
      instead of living in `C:\tmp`.
- [ ] **Delete the three orphaned Code App Development apps** once the new
      ones (`786c1b14…` Governance, `d61c6237…` Leadership) are confirmed
      working: the old `4912152c…` and `83db0ef8…`, plus an unrelated
      `2ffd8322…` "Andalusia Pulse" app already sitting in that environment
      before any of this. No CLI delete-app command exists — this is a
      maker-portal action.
- [ ] **Grant Create/Write on the `lm_` tables in DT New to anyone who will use
      a remotely-hosted app.** The connection is not the permission, and the
      failure looks like a bug rather than a denial (§6). **No longer purely
      theoretical** — this is the leading (unconfirmed) explanation for the
      live KPI-read failure just found in the deployed Governance app, see
      §5's "KPI-picker live-data warning" entry. `window.__xenvSmokeTest()`
      will confirm or rule it out.
- [ ] **Decide whether the two apps keep all 45 `databaseReferences`.** Nothing
      reads them now that everything routes through the connector. The Amr Space
      trial config drops them entirely and is the proof of that; the two real
      app configs still carry them.
- [ ] **Retire the `--table` registrations, or keep them deliberately.** The 42
      generated per-table services are still on disk in both apps and are no
      longer imported by anything. They are harmless (tree-shaken out) but they
      are now a second, misleading answer to "how does this app reach table X".
- [ ] **Move the repo out of OneDrive** — **five** separate failures now traced
      to it (§8), one of which destroyed two source files and one of which
      corrupted `.git` itself (a missing packfile, 15 Sep) badly enough to need
      a manual repair from a fresh clone.
- [ ] **`src/modules/leadership/LeadershipApp-Nourhane.jsx` is a stray copy** —
      untracked, imported by nothing, and a pre-move snapshot (it still defines
      `BIEmbed`). Almost certainly a OneDrive conflict copy. Confirm and delete;
      leaving it there means a future grep finds two answers for every symbol.
- [ ] **Neither occurrence Department/Function table is read by the app.**
      `lm_reportoccurrencedepartmentfunctions` (06 Sep) and
      `lm_meetingoccurrencedepartmentfunction` (13 Sep) are both registered, and
      the Meeting flow now writes the second — but no screen reads either.
      Meeting Detail shows the single `lm_Department` lookup, which the generator
      deliberately leaves empty, so a generated meeting displays **no department
      at all**. Wiring the read is a `fetch…` in `dataverse.js` plus a row on the
      Occurrence rail.
- [ ] **A group-wide (Stage 3/4) meeting has no attendees.**
      `lm_meetingattendeeslists` links only to a per-unit row
      (`_lm_meetingtemplateperbusinessunit_value` /
      `_lm_meetingtemplateperregion_value`), and a group-wide Setup has no unit
      row — so these occurrences are generated with a chair, a facilitator and an
      agenda, and an empty roster. Needs a Setup-level lookup on
      `lm_meetingattendeeslists`. Now reachable rather than theoretical, because
      Stage 3/4 occurrences are generated as of 13 Sep (§5).
- [ ] **Attendee type is not reconciled** — switching Core → Supportive on an
      existing attendee does not persist (§6).
- [ ] `gridSubmitHours` is stored in `DEFAULT_SETTINGS`, but **nothing reads
      it** — see the fuller, up-to-date version of this item a few entries
      below, under "Smaller, self-contained gaps" (it now also has to be told
      apart from the *other*, per-Setup `gridSubmitHours` added 15 Sep). Its
      editing UI was Governance Settings, which was removed 14 Sep — the
      value is now frozen at whatever it last held, with no UI anywhere left
      to change it.
- [ ] `reviewTimeoutDays` still has **no UI control** on the merged Governance
      Settings list.
- [ ] The Effect-on-Grids card in Governance Settings still reads seeded
      `db.grids` rather than live data.
- [ ] Module split, remaining: `seed.js`, then the rest of the screens
      smallest-first (Settings → Grid → Meetings → Workspace → Calendar →
      Decisions → Reports → Minutes). Paused by instruction, not blocked.
- [ ] Optionally point the Business intelligence screen's `KpiPanel` at the
      registered `pm_kpiachievments` / `stf_kpiachievmentbreakdowns` for real
      figures instead of the seeded catalogue.
- [ ] `fetchSetups()` in `dataverse.js` is a literal stub
      (`return notWiredYet('fetchSetups')`) — confirm nothing still calls it, or
      implement it.
- [ ] Governance Setup's Report Template "destination SharePoint link" field has
      its own "Coming soon" placeholder, separate from the per-occurrence file
      field — same underlying pause as §7.6.
- [ ] Four narrow 100-character columns still need widening (§6) — a five-minute
      fix that unblocks usable Audit Grid evidence/reasons once that UI exists.
- [ ] Dead code, current as of 02 Sep (this list flips direction easily —
      check §5 before deleting anything on it): `MeetingDetail`, `MomDetail`,
      `MomEditBody` are still superseded seed-only components, safe to treat
      as reference-only. **`ReportDetail`/`RptTable` are NOT dead anymore** —
      they were revived 02 Sep as the citation composer. `NewReportModal`
      and `DvReportDetail` are the ones now unreferenced from any nav path
      (still fully working against live Dataverse, just orphaned) — see §5's
      02 Sep entry and Open Decision §7.8 before deleting either.

---

## 10. Reference

**`Data-Dictionary.xlsx` and `Data-Dictionary.md` (repo root, added 20 Sep)**
— every Dataverse table `src/services/dataverse.js` actually reads or
writes (56 tables, 428 columns), with each table's purpose and each
column's datatype and purpose. Scope is deliberately narrow: only columns
this app's code references, standard system columns
(createdon/modifiedby/statecode/etc.) omitted once rather than per table.
Built from `dataverse.js`'s own comments, the cached connector schema JSON
under `apps/governance/.power/schemas/`, and fresh `pac modelbuilder build`
pulls for the 8 tables added straight through `xenv.js` with no cached
schema (`lm_meetingcategories`, `stf_strategypocs`,
`stf_executioncategories`, `crd04_specialtieses`, `strategy_strategies`,
`lm_bireportdashboards`, `hx_taskses`, `and_microsoftgroupmembers`).

The `.xlsx` (rebuilt 20 Sep with `exceljs`, not the plain `xlsx` package, for
real styling) has **four** sheets: **Read Me** (scope/conventions/colour
key), **Overview** (one row per table, colour-tagged by area), **Data
Dictionary** (one row per column, flat and filterable — the search-across-
everything view), and **By Table** (one coloured, banner-headed section per
table with its own column list underneath, an index of hyperlinks at the
top jumping to each section — the read-top-to-bottom/printable view). The
`.md` mirrors the same content as headed Markdown sections with a linked
table of contents, for viewing in an editor or on GitHub without Excel.

**Untracked so far — not yet committed**, since generating it didn't need
committing to be useful; ask before adding either to git if that's wanted.
Regenerate rather than hand-edit if the schema moves again: the approach (5
JSON fact-files, one per area of the schema, merged into both outputs by
one script) is fast to redo, but the generation script itself wasn't kept
as a checked-in tool. ⚠️ **Closing the file in Excel before regenerating is
required** — an open `Data-Dictionary.xlsx` holds a lock that blocks
overwriting it (hit once already this session; no `~$...` lock file
appears, so don't rely on that as a signal that it's safe to write).

Four working documents were produced alongside an earlier version of this file:

- **BRD Conformance Ledger** — 29 divergences between the build and the BRD, each
  showing whether the prototype spec pointed the same way
  <https://claude.ai/code/artifact/f5edcacd-187a-4c69-bec5-aacff1a2ae68>
- **Build-Out Checklist** — 63 tickable items across tables, columns, services,
  screens, integrations and decisions
  <https://claude.ai/code/artifact/59f13ef0-773f-438e-b172-c24820fe0e66>
- **Report Occurrence Generator** — the weekly Report flow: **14 numbered steps
  plus two loop stages** (Loop D over units, Loop E over departments), covering all
  nine frequencies, the `lm_month` Annual branch, and the rule that a Report due on
  a weekend day is created on that day and rescheduled by its owner.
  <https://claude.ai/code/artifact/db1d9a44-8e51-401e-8054-a819c2eefe57>
- **Meeting Occurrence Generator** — **version 6, revised 13 Sep, same URL.** The
  weekly flow, a **12-step** build guide writing **4 tables** (the fourth is the
  Department/Function child rows added in version 6 — Loop F). One occurrence **per unit**, NOT per
  department: 2 BUs covering 10 departments produce 2 occurrences, not 20. Read
  the page rather than any earlier build: the step count has changed three times
  (12 → 11 → 12), and the 13 Sep pass fixed three defects that each produce a
  `400` on the first run plus one that fails silently — see §5 and §8.
  **Step 12 is new**: the group-wide Stage 3/4 branch, without which those Setups
  generate nothing. ⚠️ The **weekend rule is reversed from the 08 Sep version**: a
  meeting due on a Friday or Saturday is **created on that day** and rescheduled
  later by its owner, so the `BookedDate` roll-forward step is gone — but
  `DueDate`, a different Compose, is still required. Carries the 124330000-vs-1
  option-set trap in both its forms (see §6 — the two day-of-week columns on this
  table do not use the same numbering) and the two frequencies that still cannot
  fire.
  <https://claude.ai/code/artifact/6d7fefca-78cf-4172-a967-ce99bab2dbd1>

Three more were produced this session:

- **Feature Readiness** — every feature sorted by ready-now vs. blocked, with the
  exact prerequisite for each blocked item (kept up to date across this session —
  most of its "ready now" list is now in §5's "done" column instead)
  <https://claude.ai/code/artifact/8544c8a9-9875-404b-b562-fe4bb99766db>
- **Occurrence Detection Flow** — Power Automate build guide for detecting which
  Templates are due for an occurrence next week, plus the schema gaps (Twice
  Weekly/Monthly have no second-day field, Custom frequency has no rule field)
  that block full automation
  <https://claude.ai/code/artifact/f6d4a4e8-6138-4f7b-a183-6f50b47ceff8>
- **Testing the Audit Grid** — a test scenario built around one specific fixture
  (Accreditation Committee, 75% quorum, 2 agenda items, 4 required attendees),
  with the expected score worked out in advance (91.4%, 7 of 15 coverage) so the
  live scoring can be checked against a real prediction rather than eyeballed
  <https://claude.ai/code/artifact/8c97f86f-6daf-4558-9509-b8142f9c3170>

### A note on verification

Every schema claim in this file was read from the generated definitions in
`.power/schemas/dataverse/` or from the actual code in `src/services/dataverse.js`,
not from documentation. Where this file and the BRD disagree about what a column
contains, **this file describes what is actually deployed.**
