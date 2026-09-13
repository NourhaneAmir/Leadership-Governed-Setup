# Leadership Practice — Working Context

> Handoff notes for anyone (human or AI) picking this project up cold.
> Written 30 Aug 2026, updated 01 Sep 2026, updated 02 Sep 2026 (twice),
> updated 04 Sep 2026, updated 05 Sep 2026, updated 06 Sep 2026,
> updated 07 Sep 2026 (twice), updated 08 Sep 2026, updated 12 Sep 2026
> (covering 09-12 Sep), updated 13 Sep 2026, against branch `leadership-practice`.
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
| **Reports & Plans tab** (nav screen) | 🔴 **reverted from live to seeded, on purpose, 02 Sep** — was reading `lm_reportoccurrences` directly as of 01 Sep; rebuilt this session as the citation-based composer from `prototype.html` (sections that cite live KPIs/tactics/PM entries/issues/tasks/other reports), which has no Dataverse equivalent yet, so it now runs on seeded `db.reports`/`db.paragraphs`/`db.templates` instead. This was an explicit product-owner instruction, not a regression found by accident — see §5. |
| Authority Matrix + Approval Cycles | ✅ live, read-only by design (`AuthorityMatrixPanel`, embedded in Governance Settings) |
| **Audit Grid scoring** — Meeting Occurrence's own Grid tab | ✅ **live** (this session) — `liveScoreGrid()` computes all 16 questions from the live occurrence/Minutes/Template; full Facilitator→Chair lifecycle (score, evidence, submit, approve+publish, return, open a correction version) writes through the backend functions that were already built |
| **My Workspace (nav screen)** | ✅ **live** — reads its Work Queue, Upcoming panel and This Month stats directly off the full `dvMeetingOccs`/`dvReportOccs` arrays via `dvWorkItems()`. Two silent-data-loss bugs fixed here 01 Sep — see §5: an overdue Meeting with partial attendance recording used to vanish from Work Queue, and a blank/unrecognized status code used to vanish a row from every screen at once. Its Decisions filter tab still shows 0 because Decisions (below) only just went live. |
| **Decisions register** | 🟡 **partially live** (this session) — `wlog_decisions` read + minimal create wired as its own list on the Decisions tab, alongside (not replacing) the existing seeded Decision workflow. Not yet linked to the Meeting Agenda Item or Report that raised it — deferred by explicit instruction, see §5/§6/§7. |
| **Committee Scores (nav screen)** | ✅ **live** (01 Sep) — `ScreenGrid` now reads `fetchAuditGridInstances()` joined against `dvMeetingOccs`, instead of seeded `db.grids`. See §5 for the join details and the Approved-only Coverage/Score rule. |
| **Setup Activity trail** — the Activity tab on a Report/Meeting Setup | ✅ **live** (10 Sep) — `lm_setupactivity` is written on create, edit, publish, approve and expire, and the tab reads the real rows back for any Setup that has a `_dataverseId`. A Setup that has never been saved still shows the seeded sample trail. |
| **Artifact group** — Business intelligence, Reports / Plans, Reporting hierarchy | 🟡 **mixed** (11 Sep) — all three run on the app's own data rather than the prototype's parallel seed model, but that data is itself seeded: BI reports from `BI_REPORTS`, reports from `db.reports`, hierarchy edges derived from real `RPT:` paragraph citations. The Power BI report itself **cannot be embedded** — see §8. |
| Tasks, Comments, Governance Settings (persisted values) | ❌ **seeded demo data only** |

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
silently by the payload's `.filter(c=>c.text)`); the Setup Register defaults to
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
  already-registered table, not just a brand-new one. The plan assumes
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
lookup. **Anything citing a Template must source from `DV_REPORTS`**, capture the
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

### `lm_setupactivity` — the audit trail for Setup templates (10 Sep)
One table serving **both** Report and Meeting templates, registered as
`lm_setupactivity` (singular logical name, entity set `lm_setupactivities`). It is
a **flat, denormalised log** by design — it carries the Setup's Dataverse id as a
plain text column rather than two optional lookups, so one query returns the trail
for either kind.

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

---

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
      submission timer reading it. Either wire it into the Grid lifecycle or drop the
      third timing card.
- [ ] **Two settings are edited in two places** (08 Sep) — `momWriteupHours` and
      `momApprovalHours` appear as timing cards *and* as value cards on Governance
      Settings. They cannot disagree; decide whether to remove them from the grid.
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
- [ ] **Move the repo out of OneDrive** — four separate failures now traced to
      it (§8), one of which destroyed two source files.
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
- [ ] `gridSubmitHours` is stored in `DEFAULT_SETTINGS` and surfaced in
      Governance Settings, but **nothing reads it**. Either wire it into the
      Audit Grid submission window or drop it.
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
